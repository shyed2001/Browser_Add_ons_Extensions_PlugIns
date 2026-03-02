// ============================================================
// MindVault — Import Service
// Parses and validates JSON backups, writes data to IndexedDB.
// ============================================================

import {
  isValidJsonBackup,
  isValidBookmark,
  isValidTag,
  type JsonBackupSchema,
} from '@mindvault/shared';
import { openDB, promisifyRequest } from '../db/index';
import { STORE } from '../db/schema';

// ---- Types -------------------------------------------------

export interface ImportResult {
  success: boolean;
  libraryId: string;
  counts: {
    sessions: number;
    tabs: number;
    bookmarks: number;
    tags: number;
  };
  errors: string[];
}

// ---- Parse JSON backup -------------------------------------

/**
 * Read a File object and parse it as a MindVault JSON backup.
 * Validates the schema before returning.
 */
export async function parseJsonBackup(file: File): Promise<JsonBackupSchema> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file — could not parse.');
  }

  if (!isValidJsonBackup(parsed)) {
    throw new Error(
      'Invalid backup format — missing required fields (library, sessions, tabs).'
    );
  }

  return parsed;
}

// ---- Import to IndexedDB -----------------------------------

/**
 * Write a parsed JSON backup into IndexedDB.
 * Creates the library (or merges into existing default) and all child entities.
 */
export async function importFromJson(backup: JsonBackupSchema): Promise<ImportResult> {
  const errors: string[] = [];
  const db = await openDB();

  // Write library
  const library = backup.library;
  const libTx = db.transaction(STORE.LIBRARIES, 'readwrite');
  await promisifyRequest(libTx.objectStore(STORE.LIBRARIES).put(library));

  // Write sessions
  let sessionCount = 0;
  for (const session of backup.sessions) {
    try {
      const tx = db.transaction(STORE.SESSIONS, 'readwrite');
      await promisifyRequest(tx.objectStore(STORE.SESSIONS).put(session));
      sessionCount++;
    } catch (e) {
      errors.push(`Session "${session.name}": ${String(e)}`);
    }
  }

  // Write tabs
  let tabCount = 0;
  for (const tab of backup.tabs) {
    try {
      const tx = db.transaction(STORE.SAVED_TABS, 'readwrite');
      await promisifyRequest(tx.objectStore(STORE.SAVED_TABS).put(tab));
      tabCount++;
    } catch (e) {
      errors.push(`Tab "${tab.title}": ${String(e)}`);
    }
  }

  // Write bookmarks (optional in backup)
  let bookmarkCount = 0;
  if (Array.isArray(backup.bookmarks)) {
    for (const bm of backup.bookmarks) {
      if (!isValidBookmark(bm)) {
        errors.push(`Invalid bookmark skipped: ${JSON.stringify(bm).slice(0, 80)}`);
        continue;
      }
      try {
        const tx = db.transaction(STORE.BOOKMARKS, 'readwrite');
        await promisifyRequest(tx.objectStore(STORE.BOOKMARKS).put(bm));
        bookmarkCount++;
      } catch (e) {
        errors.push(`Bookmark "${bm.title}": ${String(e)}`);
      }
    }
  }

  // Write tags (optional in backup)
  let tagCount = 0;
  if (Array.isArray(backup.tags)) {
    for (const tag of backup.tags) {
      if (!isValidTag(tag)) {
        errors.push(`Invalid tag skipped: ${JSON.stringify(tag).slice(0, 80)}`);
        continue;
      }
      try {
        const tx = db.transaction(STORE.TAGS, 'readwrite');
        await promisifyRequest(tx.objectStore(STORE.TAGS).put(tag));
        tagCount++;
      } catch (e) {
        errors.push(`Tag "${tag.name}": ${String(e)}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    libraryId: library.id,
    counts: {
      sessions: sessionCount,
      tabs: tabCount,
      bookmarks: bookmarkCount,
      tags: tagCount,
    },
    errors,
  };
}

// ---- Validate import schema (convenience re-export) --------

export { isValidJsonBackup as validateImportSchema } from '@mindvault/shared';
