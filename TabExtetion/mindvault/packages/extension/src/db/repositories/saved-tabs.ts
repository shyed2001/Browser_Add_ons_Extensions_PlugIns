// ============================================================
// MindVault — SavedTabs Repository
// Handles URL-based deduplication (RGYB repeat tracking)
// ============================================================

import type { SavedTab } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';
import { logAction } from './audit-log';
import { getSessionKey, encryptString, decryptString } from '../../services/session-key';

/** Decrypt the notes field of a tab if a session key is active. */
async function decryptTab(tab: SavedTab): Promise<SavedTab> {
  const key = getSessionKey(tab.libraryId);
  if (!key) return tab;
  return { ...tab, notes: await decryptString(tab.notes, key) };
}

export async function getTabsBySession(sessionId: string): Promise<SavedTab[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.SAVED_TABS, 'readonly');
  const index = tx.objectStore(STORE.SAVED_TABS).index('sessionId');
  const rows = await promisifyRequest<SavedTab[]>(index.getAll(IDBKeyRange.only(sessionId)));
  return Promise.all(rows.map(decryptTab));
}

export async function getTabsByLibrary(libraryId: string): Promise<SavedTab[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.SAVED_TABS, 'readonly');
  const index = tx.objectStore(STORE.SAVED_TABS).index('libraryId');
  const rows = await promisifyRequest<SavedTab[]>(index.getAll(IDBKeyRange.only(libraryId)));
  return Promise.all(rows.map(decryptTab));
}

export async function findTabByUrl(libraryId: string, url: string): Promise<SavedTab | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.SAVED_TABS, 'readonly');
  const index = tx.objectStore(STORE.SAVED_TABS).index('libraryId_url');
  // Get all tabs for this library+url combination
  const results = await promisifyRequest<SavedTab[]>(
    index.getAll(IDBKeyRange.only([libraryId, url]))
  );
  return results[0] ?? null;
}

export async function getTabById(id: string): Promise<SavedTab | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.SAVED_TABS, 'readonly');
  const result = await promisifyRequest<SavedTab | undefined>(
    tx.objectStore(STORE.SAVED_TABS).get(id)
  );
  if (!result) return null;
  return decryptTab(result);
}

/**
 * Save a tab to the session. Handles URL-based deduplication:
 * - If URL already exists in library → increment repeatCount, push timestamp
 * - If new URL → create new record
 * Returns the saved/updated tab.
 */
export async function saveTabWithDedup(
  sessionId: string,
  libraryId: string,
  url: string,
  title: string,
  favicon: string
): Promise<SavedTab> {
  const now = Date.now();
  const existing = await findTabByUrl(libraryId, url);

  if (existing) {
    // URL exists — increment repeat count (RGYB logic)
    const updated: SavedTab = {
      ...existing,
      title, // Update title in case it changed
      favicon,
      repeatCount: existing.repeatCount + 1,
      allTimestamps: [...existing.allTimestamps, now],
      lastSeenAt: now,
      sessionId, // Update to current session
    };
    const db = await openDB();
    const tx = db.transaction(STORE.SAVED_TABS, 'readwrite');
    await promisifyRequest(tx.objectStore(STORE.SAVED_TABS).put(updated));
    void logAction({ libraryId, action: 'UPDATE', entityType: 'saved_tab', entityId: updated.id });
    return updated;
  }

  // New URL — create fresh record
  const tab: SavedTab = {
    id: generateUUID(),
    sessionId,
    libraryId,
    url,
    title,
    favicon,
    repeatCount: 1,
    allTimestamps: [now],
    firstSeenAt: now,
    lastSeenAt: now,
    notes: '',
    tags: [],
    isPinned: false,
    legacyId: null,
  };
  const db = await openDB();
  const tx = db.transaction(STORE.SAVED_TABS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.SAVED_TABS).put(tab));
  void logAction({ libraryId, action: 'CREATE', entityType: 'saved_tab', entityId: tab.id });
  return tab;
}

export async function updateTabNotes(id: string, notes: string): Promise<void> {
  const db = await openDB();
  const existing = await getTabById(id);
  if (!existing) return;
  const key = getSessionKey(existing.libraryId);
  const storedNotes = await encryptString(notes, key);
  const tx = db.transaction(STORE.SAVED_TABS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.SAVED_TABS).put({ ...existing, notes: storedNotes }));
}

export async function deleteTab(id: string): Promise<void> {
  const existing = await getTabById(id);
  const db = await openDB();
  const tx = db.transaction(STORE.SAVED_TABS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.SAVED_TABS).delete(id));
  if (existing) {
    void logAction({ libraryId: existing.libraryId, action: 'DELETE', entityType: 'saved_tab', entityId: id });
  }
}

export async function getTopRepeatedTabs(libraryId: string, limit = 20): Promise<SavedTab[]> {
  const all = await getTabsByLibrary(libraryId);
  return all.sort((a, b) => b.repeatCount - a.repeatCount).slice(0, limit);
}
