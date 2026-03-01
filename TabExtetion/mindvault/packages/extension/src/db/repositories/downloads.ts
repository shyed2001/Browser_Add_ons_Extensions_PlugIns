// ============================================================
// MindVault — Downloads Repository
// Stores download METADATA ONLY — never file content.
// Provenance tracking: what was downloaded, from where, when.
// ============================================================

import type { Download, DownloadState } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';
import { getSessionKey, encryptString, decryptString } from '../../services/session-key';

/** Decrypt the notes field of a download if a session key is active. */
async function decryptDownload(dl: Download): Promise<Download> {
  const key = getSessionKey(dl.libraryId);
  if (!key) return dl;
  return { ...dl, notes: await decryptString(dl.notes, key) };
}

export async function getDownloadsByLibrary(
  libraryId: string,
  limit = 200
): Promise<Download[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readonly');
  const index = tx.objectStore(STORE.DOWNLOADS).index('libraryId');
  const all = await promisifyRequest<Download[]>(
    index.getAll(IDBKeyRange.only(libraryId))
  );
  const sorted = all.sort((a, b) => b.downloadedAt - a.downloadedAt).slice(0, limit);
  return Promise.all(sorted.map(decryptDownload));
}

export async function getDownloadById(id: string): Promise<Download | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readonly');
  const result = await promisifyRequest<Download | undefined>(
    tx.objectStore(STORE.DOWNLOADS).get(id)
  );
  if (!result) return null;
  return decryptDownload(result);
}

export async function getDownloadsByMimeType(
  libraryId: string,
  mimeType: string
): Promise<Download[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readonly');
  const index = tx.objectStore(STORE.DOWNLOADS).index('mimeType');
  const all = await promisifyRequest<Download[]>(
    index.getAll(IDBKeyRange.only(mimeType))
  );
  return all.filter((d) => d.libraryId === libraryId);
}

export async function createDownload(
  partial: Omit<Download, 'id'>
): Promise<Download> {
  const download: Download = {
    ...partial,
    id: generateUUID(),
  };
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.DOWNLOADS).put(download));
  return download;
}

export async function updateDownloadState(
  id: string,
  state: DownloadState
): Promise<void> {
  const download = await getDownloadById(id);
  if (!download) return;
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.DOWNLOADS).put({ ...download, state })
  );
}

export async function updateDownloadNotes(id: string, notes: string): Promise<void> {
  const download = await getDownloadById(id);
  if (!download) return;
  const key = getSessionKey(download.libraryId);
  const storedNotes = await encryptString(notes, key);
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.DOWNLOADS).put({ ...download, notes: storedNotes })
  );
}

export async function deleteDownload(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.DOWNLOADS).delete(id));
}

export async function getDownloadCount(libraryId: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE.DOWNLOADS, 'readonly');
  const index = tx.objectStore(STORE.DOWNLOADS).index('libraryId');
  return promisifyRequest<number>(index.count(IDBKeyRange.only(libraryId)));
}

/**
 * Find an existing download record by source URL (avoids duplicates).
 */
export async function findDownloadByUrl(
  libraryId: string,
  url: string
): Promise<Download | null> {
  const all = await getDownloadsByLibrary(libraryId);
  return all.find((d) => d.url === url) ?? null;
}
