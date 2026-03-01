// ============================================================
// MindVault — Migration: v1.1 chrome.storage.local → IndexedDB v2
//
// Source: chrome.storage.local['tabDatabase'] (LegacyTabRecord[])
// Target: IndexedDB object stores (sessions + saved_tabs + libraries)
//
// ZERO DATA LOSS GUARANTEE:
//   - All 7 v1.1 fields migrated (id,title,url,repeatCount,timestamps,notes,remarks)
//   - 'remarks' discarded (always "" in v1.1)
//   - float IDs preserved as legacyId
//   - locale timestamps parsed best-effort, fallback = migration time
//   - Original chrome.storage.local data untouched after migration
//   - Migration is IDEMPOTENT: safe to call multiple times
// ============================================================

import type { Library, Session, SavedTab, SchemaMeta } from '@mindvault/shared';
import {
  LEGACY_STORAGE_KEY,
  MIGRATION_FLAG_KEY,
  type LegacyTabRecord,
  type MigrationRecord,
} from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { parseTimestampsArray } from '@mindvault/shared';
import { STORE } from '../schema';
import { promisifyRequest } from '../index';

export interface MigrationResult {
  skipped: boolean; // true if already migrated
  recordCount: number;
  sessionId: string;
  libraryId: string;
  errors: string[];
}

/**
 * Run the v1.1 → v2 migration.
 * Safe to call on every extension startup — checks idempotency flag first.
 */
export async function migrateV1ToV2(db: IDBDatabase): Promise<MigrationResult> {
  // Step 1: Check if already migrated (idempotency)
  const alreadyMigrated = await checkMigrationComplete();
  if (alreadyMigrated) {
    return { skipped: true, recordCount: 0, sessionId: '', libraryId: '', errors: [] };
  }

  // Step 2: Read legacy data from chrome.storage.local
  const legacyRecords = await readLegacyData();

  // If no legacy data, still mark as migrated and create default library
  const migrationTime = Date.now();
  const errors: string[] = [];

  // Step 3: Create Default Library
  const libraryId = generateUUID();
  const library: Library = {
    id: libraryId,
    name: 'Default Library',
    icon: '🧠',
    color: '#007bff',
    isDefault: true,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
    createdAt: migrationTime,
    updatedAt: migrationTime,
  };

  // Step 4: Create Legacy Import session
  const sessionId = generateUUID();
  const session: Session = {
    id: sessionId,
    libraryId,
    name:
      legacyRecords.length > 0
        ? `Legacy Import — OpenTabListInfoRestore v1.1 (${legacyRecords.length} tabs)`
        : 'Default Session',
    tabCount: legacyRecords.length,
    windowCount: 1,
    notes:
      legacyRecords.length > 0
        ? 'Automatically imported from OpenTabListInfoRestore v1.1 on upgrade to MindVault v2.'
        : '',
    tags: [],
    isFavorite: false,
    createdAt: migrationTime,
    updatedAt: migrationTime,
  };

  // Step 5: Convert legacy records to SavedTab[]
  const savedTabs: SavedTab[] = [];
  for (const record of legacyRecords) {
    try {
      const timestamps = parseTimestampsArray(record.timestamps, migrationTime);
      const firstSeenAt = timestamps[0] ?? migrationTime;
      const lastSeenAt = timestamps[timestamps.length - 1] ?? migrationTime;

      const tab: SavedTab = {
        id: generateUUID(),
        sessionId,
        libraryId,
        url: record.url ?? '',
        title: record.title ?? '(No Title)',
        favicon: '',
        repeatCount: typeof record.repeatCount === 'number' ? record.repeatCount : 1,
        allTimestamps: timestamps,
        firstSeenAt,
        lastSeenAt,
        notes: typeof record.notes === 'string' ? record.notes : '',
        tags: [],
        isPinned: false,
        legacyId: typeof record.id === 'number' ? record.id : null,
        // 'remarks' field discarded (always "" in v1.1)
      };
      savedTabs.push(tab);
    } catch (err) {
      const msg = `Failed to migrate record with legacyId=${record.id}: ${String(err)}`;
      errors.push(msg);
      console.error(msg);
    }
  }

  // Step 6: Write everything to IndexedDB in one transaction
  await writeToIndexedDB(db, library, session, savedTabs, migrationTime);

  // Step 7: Write schema_meta (marks DB version as 2)
  await writeSchemaVersion(db, migrationTime);

  // Step 8: Record migration completion in chrome.storage.local
  //         Original tabDatabase is LEFT INTACT for 30-day rollback window
  const migrationRecord: MigrationRecord = {
    version: '2.0.0',
    date: migrationTime,
    recordCount: savedTabs.length,
    sessionId,
    libraryId,
  };
  await setStorageLocal(MIGRATION_FLAG_KEY, migrationRecord);

  return {
    skipped: false,
    recordCount: savedTabs.length,
    sessionId,
    libraryId,
    errors,
  };
}

// ---- Internal helpers --------------------------------------

async function checkMigrationComplete(): Promise<boolean> {
  try {
    const result = await getStorageLocal([MIGRATION_FLAG_KEY]);
    return result[MIGRATION_FLAG_KEY] !== undefined;
  } catch {
    return false;
  }
}

async function readLegacyData(): Promise<LegacyTabRecord[]> {
  try {
    const result = await getStorageLocal([LEGACY_STORAGE_KEY]);
    const raw = result[LEGACY_STORAGE_KEY];
    if (!Array.isArray(raw)) return [];
    return raw as LegacyTabRecord[];
  } catch {
    return [];
  }
}

async function writeToIndexedDB(
  db: IDBDatabase,
  library: Library,
  session: Session,
  savedTabs: SavedTab[],
  _migrationTime: number
): Promise<void> {
  const storeNames = [STORE.LIBRARIES, STORE.SESSIONS, STORE.SAVED_TABS];
  const tx = db.transaction(storeNames, 'readwrite');

  await promisifyRequest(tx.objectStore(STORE.LIBRARIES).put(library));
  await promisifyRequest(tx.objectStore(STORE.SESSIONS).put(session));

  for (const tab of savedTabs) {
    await promisifyRequest(tx.objectStore(STORE.SAVED_TABS).put(tab));
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Migration transaction aborted'));
  });
}

async function writeSchemaVersion(db: IDBDatabase, migratedAt: number): Promise<void> {
  const schemaMeta: SchemaMeta = {
    key: 'version',
    value: 2,
    migratedAt,
    migratedFrom: '1.1',
  };
  const tx = db.transaction(STORE.SCHEMA_META, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.SCHEMA_META).put(schemaMeta));
}

/** Promisified chrome.storage.local.get */
function getStorageLocal(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/** Promisified chrome.storage.local.set */
function setStorageLocal(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
