// ============================================================
// MindVault — Libraries Repository
// ============================================================

import type { Library } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';

export async function getDefaultLibrary(): Promise<Library | null> {
  // IDBKeyRange.only(true) fails — booleans are not valid IDB keys.
  // Fetch all libraries and filter in memory instead.
  const db = await openDB();
  const tx = db.transaction(STORE.LIBRARIES, 'readonly');
  const all = await promisifyRequest<Library[]>(tx.objectStore(STORE.LIBRARIES).getAll());
  return all.find(lib => lib.isDefault === true) ?? null;
}

export async function getAllLibraries(): Promise<Library[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.LIBRARIES, 'readonly');
  return promisifyRequest<Library[]>(tx.objectStore(STORE.LIBRARIES).getAll());
}

export async function getLibraryById(id: string): Promise<Library | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.LIBRARIES, 'readonly');
  const result = await promisifyRequest<Library | undefined>(
    tx.objectStore(STORE.LIBRARIES).get(id)
  );
  return result ?? null;
}

export async function createLibrary(
  partial: Omit<Library, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Library> {
  const now = Date.now();
  const library: Library = {
    ...partial,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDB();
  const tx = db.transaction(STORE.LIBRARIES, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.LIBRARIES).put(library));
  return library;
}

export async function updateLibrary(library: Library): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.LIBRARIES, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.LIBRARIES).put({ ...library, updatedAt: Date.now() })
  );
}
