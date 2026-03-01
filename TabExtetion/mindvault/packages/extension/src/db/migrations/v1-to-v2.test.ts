// ============================================================
// MindVault — Migration v1→v2 Tests
// Verifies ZERO DATA LOSS from v1.1 chrome.storage.local schema
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { migrateV1ToV2 } from './v1-to-v2';
import { DB_NAME, DB_VERSION, createSchema } from '../schema';
import { STORE } from '../schema';
import { LEGACY_STORAGE_KEY, MIGRATION_FLAG_KEY } from '@mindvault/shared';
import type { LegacyTabRecord } from '@mindvault/shared';

// ---- Helpers -----------------------------------------------

/** Open a fresh IndexedDB for each test */
function openTestDB(): Promise<IDBDatabase> {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => createSchema((e.target as IDBOpenDBRequest).result);
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

/** Read all records from a store */
function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Setup chrome mock with controlled storage */
function setupChromeMock(
  legacyData: LegacyTabRecord[] | null,
  alreadyMigrated = false
): void {
  const storageData: Record<string, unknown> = {};
  if (legacyData !== null) storageData[LEGACY_STORAGE_KEY] = legacyData;
  if (alreadyMigrated) storageData[MIGRATION_FLAG_KEY] = { version: '2.0.0' };

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn((_keys: string[], callback: (result: Record<string, unknown>) => void) => {
          callback(storageData);
        }),
        set: vi.fn((_data: Record<string, unknown>, callback: () => void) => {
          callback();
        }),
      },
    },
    runtime: { lastError: null },
  });
}

// ---- Test data ---------------------------------------------

const LEGACY_RECORDS: LegacyTabRecord[] = [
  {
    id: 1706000627452.847,
    title: 'Google',
    url: 'https://google.com',
    repeatCount: 5,
    timestamps: ['2/22/2026, 10:30:45 AM', '2/21/2026, 3:15:20 PM'],
    notes: 'Main search',
    remarks: '',
  },
  {
    id: 1706000999999.123,
    title: 'GitHub',
    url: 'https://github.com',
    repeatCount: 1,
    timestamps: ['2/20/2026, 9:00:00 AM'],
    notes: '',
    remarks: '',
  },
  {
    id: 1706001234567.456,
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org',
    repeatCount: 12,
    timestamps: ['1/1/2026, 12:00:00 PM', '1/15/2026, 8:30:00 AM', '2/18/2026, 7:45:00 PM'],
    notes: 'Reference docs',
    remarks: '', // always empty in v1.1
  },
];

// ---- Tests -------------------------------------------------

describe('migrateV1ToV2 — zero data loss guarantee', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips migration if already complete (idempotency)', async () => {
    setupChromeMock(LEGACY_RECORDS, true);
    const db = await openTestDB();
    const result = await migrateV1ToV2(db);
    expect(result.skipped).toBe(true);
    db.close();
  });

  it('creates Default Library when no legacy data exists', async () => {
    setupChromeMock(null);
    const db = await openTestDB();
    const result = await migrateV1ToV2(db);

    expect(result.skipped).toBe(false);
    expect(result.errors).toHaveLength(0);

    const libraries = await getAllFromStore<{ name: string; isDefault: boolean }>(
      db, STORE.LIBRARIES
    );
    expect(libraries).toHaveLength(1);
    expect(libraries[0]?.name).toBe('Default Library');
    expect(libraries[0]?.isDefault).toBe(true);
    db.close();
  });

  it('migrates all legacy records — correct count', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    const result = await migrateV1ToV2(db);

    expect(result.recordCount).toBe(3);
    expect(result.errors).toHaveLength(0);

    const tabs = await getAllFromStore(db, STORE.SAVED_TABS);
    expect(tabs).toHaveLength(3);
    db.close();
  });

  it('preserves repeatCount exactly', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ url: string; repeatCount: number }>(
      db, STORE.SAVED_TABS
    );

    const google = tabs.find((t) => t.url === 'https://google.com');
    const github = tabs.find((t) => t.url === 'https://github.com');
    const mdn = tabs.find((t) => t.url === 'https://developer.mozilla.org');

    expect(google?.repeatCount).toBe(5);
    expect(github?.repeatCount).toBe(1);
    expect(mdn?.repeatCount).toBe(12);
    db.close();
  });

  it('preserves notes field', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ url: string; notes: string }>(db, STORE.SAVED_TABS);

    const google = tabs.find((t) => t.url === 'https://google.com');
    const mdn = tabs.find((t) => t.url === 'https://developer.mozilla.org');

    expect(google?.notes).toBe('Main search');
    expect(mdn?.notes).toBe('Reference docs');
    db.close();
  });

  it('preserves titles', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ url: string; title: string }>(db, STORE.SAVED_TABS);
    const google = tabs.find((t) => t.url === 'https://google.com');
    expect(google?.title).toBe('Google');
    db.close();
  });

  it('stores original float legacyId', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ url: string; legacyId: number }>(db, STORE.SAVED_TABS);
    const google = tabs.find((t) => t.url === 'https://google.com');
    expect(google?.legacyId).toBeCloseTo(1706000627452.847, 1);
    db.close();
  });

  it('converts timestamps array to unix ms (sorted ascending)', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ url: string; allTimestamps: number[] }>(
      db, STORE.SAVED_TABS
    );
    const mdn = tabs.find((t) => t.url === 'https://developer.mozilla.org');

    expect(Array.isArray(mdn?.allTimestamps)).toBe(true);
    expect(mdn?.allTimestamps).toHaveLength(3);

    // Should be sorted ascending
    const ts = mdn?.allTimestamps ?? [];
    expect(ts[0]).toBeLessThan(ts[1] as number);
    expect(ts[1]).toBeLessThan(ts[2] as number);
    db.close();
  });

  it('sets firstSeenAt < lastSeenAt for multi-timestamp records', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{
      url: string;
      firstSeenAt: number;
      lastSeenAt: number;
    }>(db, STORE.SAVED_TABS);

    const mdn = tabs.find((t) => t.url === 'https://developer.mozilla.org');
    expect(mdn?.firstSeenAt).toBeLessThan(mdn?.lastSeenAt as number);
    db.close();
  });

  it('all tabs linked to same session and library', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    const result = await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ sessionId: string; libraryId: string }>(
      db, STORE.SAVED_TABS
    );
    for (const tab of tabs) {
      expect(tab.sessionId).toBe(result.sessionId);
      expect(tab.libraryId).toBe(result.libraryId);
    }
    db.close();
  });

  it('creates exactly 1 session with correct tab count', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const sessions = await getAllFromStore<{ tabCount: number; name: string }>(
      db, STORE.SESSIONS
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tabCount).toBe(3);
    expect(sessions[0]?.name).toContain('Legacy Import');
    db.close();
  });

  it('discards remarks field (never stored)', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<Record<string, unknown>>(db, STORE.SAVED_TABS);
    for (const tab of tabs) {
      expect('remarks' in tab).toBe(false);
    }
    db.close();
  });

  it('assigns new UUID string ids (not legacy float ids)', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const tabs = await getAllFromStore<{ id: string }>(db, STORE.SAVED_TABS);
    for (const tab of tabs) {
      expect(typeof tab.id).toBe('string');
      // UUID v4 format
      expect(tab.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
    db.close();
  });

  it('writes schema_meta with version=2', async () => {
    setupChromeMock(LEGACY_RECORDS);
    const db = await openTestDB();
    await migrateV1ToV2(db);

    const meta = await getAllFromStore<{ key: string; value: number }>(db, STORE.SCHEMA_META);
    const versionMeta = meta.find((m) => m.key === 'version');
    expect(versionMeta?.value).toBe(2);
    db.close();
  });

  it('handles records with missing/invalid timestamps gracefully', async () => {
    const badRecord: LegacyTabRecord = {
      id: 1700000000000.1,
      title: 'Bad Timestamp Page',
      url: 'https://example.com',
      repeatCount: 2,
      timestamps: ['not-a-date', 'also-not-a-date'],
      notes: '',
      remarks: '',
    };
    setupChromeMock([badRecord]);
    const db = await openTestDB();
    const result = await migrateV1ToV2(db);

    // Should succeed despite bad timestamps (fallback to migration time)
    expect(result.recordCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    const tabs = await getAllFromStore<{ allTimestamps: number[] }>(db, STORE.SAVED_TABS);
    expect(tabs[0]?.allTimestamps).toHaveLength(2);
    // All should be valid numbers
    tabs[0]?.allTimestamps.forEach((ts) => expect(typeof ts).toBe('number'));
    db.close();
  });
});
