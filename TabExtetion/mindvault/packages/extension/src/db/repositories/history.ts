// ============================================================
// MindVault — History Repository
// Stores full browser history by date slice for efficient querying.
// "Important" flag is set by the rules engine (Phase 2).
// ============================================================

import type { HistoryEntry } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { toDateSlice } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';

export async function getHistoryByLibrary(
  libraryId: string,
  limit = 500
): Promise<HistoryEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readonly');
  const index = tx.objectStore(STORE.HISTORY_ENTRIES).index('libraryId');
  const all = await promisifyRequest<HistoryEntry[]>(
    index.getAll(IDBKeyRange.only(libraryId))
  );
  // Return most recent first, capped at limit
  return all.sort((a, b) => b.visitTime - a.visitTime).slice(0, limit);
}

export async function getHistoryByDateRange(
  libraryId: string,
  fromMs: number,
  toMs: number
): Promise<HistoryEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readonly');
  const index = tx.objectStore(STORE.HISTORY_ENTRIES).index('visitTime');
  const all = await promisifyRequest<HistoryEntry[]>(
    index.getAll(IDBKeyRange.bound(fromMs, toMs))
  );
  return all
    .filter((e) => e.libraryId === libraryId)
    .sort((a, b) => b.visitTime - a.visitTime);
}

export async function getHistoryByDate(
  libraryId: string,
  dateSlice: string
): Promise<HistoryEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readonly');
  const index = tx.objectStore(STORE.HISTORY_ENTRIES).index('visitDate');
  const all = await promisifyRequest<HistoryEntry[]>(
    index.getAll(IDBKeyRange.only(dateSlice))
  );
  return all.filter((e) => e.libraryId === libraryId);
}

export async function getImportantHistory(libraryId: string): Promise<HistoryEntry[]> {
  // Boolean is not a valid IDB key type — compound key [libraryId, true] fails.
  // Use the libraryId index and filter in memory instead.
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readonly');
  const index = tx.objectStore(STORE.HISTORY_ENTRIES).index('libraryId');
  const all = await promisifyRequest<HistoryEntry[]>(
    index.getAll(IDBKeyRange.only(libraryId))
  );
  return all.filter((e) => e.isImportant);
}

export async function getHistoryById(id: string): Promise<HistoryEntry | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readonly');
  const result = await promisifyRequest<HistoryEntry | undefined>(
    tx.objectStore(STORE.HISTORY_ENTRIES).get(id)
  );
  return result ?? null;
}

export async function createHistoryEntry(
  partial: Omit<HistoryEntry, 'id' | 'visitDate'>
): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    ...partial,
    id: generateUUID(),
    visitDate: toDateSlice(partial.visitTime),
  };
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.HISTORY_ENTRIES).put(entry));
  return entry;
}

/** Upsert: if URL already visited in this library on same day, update visitCount */
export async function upsertHistoryEntry(
  libraryId: string,
  url: string,
  title: string,
  visitTime: number,
  transition = 'link'
): Promise<HistoryEntry> {
  const dateSlice = toDateSlice(visitTime);
  const dayEntries = await getHistoryByDate(libraryId, dateSlice);
  const existing = dayEntries.find((e) => e.url === url);

  if (existing) {
    const updated: HistoryEntry = {
      ...existing,
      title,
      visitTime,
      visitCount: existing.visitCount + 1,
    };
    const db = await openDB();
    const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readwrite');
    await promisifyRequest(tx.objectStore(STORE.HISTORY_ENTRIES).put(updated));
    return updated;
  }

  return createHistoryEntry({
    libraryId,
    url,
    title,
    visitTime,
    visitCount: 1,
    transition,
    isImportant: false,
    isStarred: false,
    tags: [],
  });
}

export async function markHistoryStarred(id: string, starred: boolean): Promise<void> {
  const entry = await getHistoryById(id);
  if (!entry) return;
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.HISTORY_ENTRIES).put({ ...entry, isStarred: starred })
  );
}

export async function markHistoryImportant(id: string, important: boolean): Promise<void> {
  const entry = await getHistoryById(id);
  if (!entry) return;
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.HISTORY_ENTRIES).put({ ...entry, isImportant: important })
  );
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.HISTORY_ENTRIES).delete(id));
}

export async function getHistoryCount(libraryId: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE.HISTORY_ENTRIES, 'readonly');
  const index = tx.objectStore(STORE.HISTORY_ENTRIES).index('libraryId');
  return promisifyRequest<number>(index.count(IDBKeyRange.only(libraryId)));
}
