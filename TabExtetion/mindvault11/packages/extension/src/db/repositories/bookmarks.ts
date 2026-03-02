// ============================================================
// MindVault — Bookmarks Repository
// Supports flat and hierarchical (folder/bookmark) storage.
// ============================================================

import type { Bookmark, BookmarkType } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';
import { logAction } from './audit-log';
import { getSessionKey, encryptString, decryptString } from '../../services/session-key';

/** Decrypt the description field of a bookmark if a session key is active. */
async function decryptBookmark(bm: Bookmark): Promise<Bookmark> {
  const key = getSessionKey(bm.libraryId);
  if (!key) return bm;
  return { ...bm, description: await decryptString(bm.description, key) };
}

export async function getBookmarksByLibrary(libraryId: string): Promise<Bookmark[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.BOOKMARKS, 'readonly');
  const index = tx.objectStore(STORE.BOOKMARKS).index('libraryId');
  const rows = await promisifyRequest<Bookmark[]>(index.getAll(IDBKeyRange.only(libraryId)));
  return Promise.all(rows.map(decryptBookmark));
}

export async function getChildBookmarks(
  libraryId: string,
  parentId: string | null
): Promise<Bookmark[]> {
  // IndexedDB compound keys don't support null, so for root items
  // we fall back to filtering all library bookmarks by parentId
  if (parentId === null) {
    const all = await getBookmarksByLibrary(libraryId);
    return all.filter((b) => b.parentId === null);
  }
  const db = await openDB();
  const tx = db.transaction(STORE.BOOKMARKS, 'readonly');
  const index = tx.objectStore(STORE.BOOKMARKS).index('libraryId_parentId');
  return promisifyRequest<Bookmark[]>(
    index.getAll(IDBKeyRange.only([libraryId, parentId]))
  );
}

export async function getBookmarkById(id: string): Promise<Bookmark | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.BOOKMARKS, 'readonly');
  const result = await promisifyRequest<Bookmark | undefined>(
    tx.objectStore(STORE.BOOKMARKS).get(id)
  );
  if (!result) return null;
  return decryptBookmark(result);
}

export async function getBookmarkByUrl(
  libraryId: string,
  url: string
): Promise<Bookmark | null> {
  const all = await getBookmarksByLibrary(libraryId);
  return all.find((b) => b.type === 'bookmark' && b.url === url) ?? null;
}

export async function createBookmark(
  partial: Omit<Bookmark, 'id' | 'createdAt' | 'modifiedAt'>
): Promise<Bookmark> {
  const now = Date.now();
  const key = getSessionKey(partial.libraryId);
  const storedDescription = await encryptString(partial.description, key);
  const bookmark: Bookmark = {
    ...partial,
    description: storedDescription,
    id: generateUUID(),
    createdAt: now,
    modifiedAt: now,
  };
  const db = await openDB();
  const tx = db.transaction(STORE.BOOKMARKS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.BOOKMARKS).put(bookmark));
  void logAction({ libraryId: bookmark.libraryId, action: 'CREATE', entityType: 'bookmark', entityId: bookmark.id });
  // Return decrypted version to caller
  return { ...bookmark, description: partial.description };
}

export async function createFolder(
  libraryId: string,
  name: string,
  parentId: string | null = null
): Promise<Bookmark> {
  return createBookmark({
    libraryId,
    parentId,
    type: 'folder' as BookmarkType,
    title: name,
    url: null,
    description: '',
    tags: [],
    visitCount: 0,
    isFavorite: false,
    sortOrder: Date.now(),
  });
}

export async function updateBookmark(bookmark: Bookmark): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.BOOKMARKS, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.BOOKMARKS).put({ ...bookmark, modifiedAt: Date.now() })
  );
}

export async function deleteBookmark(id: string): Promise<void> {
  const existing = await getBookmarkById(id);
  const db = await openDB();
  const tx = db.transaction(STORE.BOOKMARKS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.BOOKMARKS).delete(id));
  if (existing) {
    void logAction({ libraryId: existing.libraryId, action: 'DELETE', entityType: 'bookmark', entityId: id });
  }
}

/** Increment visitCount when user clicks a bookmark */
export async function incrementBookmarkVisit(id: string): Promise<void> {
  const bookmark = await getBookmarkById(id);
  if (!bookmark || bookmark.type !== 'bookmark') return;
  await updateBookmark({ ...bookmark, visitCount: bookmark.visitCount + 1 });
}

/**
 * Get full bookmark tree as nested structure.
 * Roots are items where parentId === null.
 */
export interface BookmarkNode extends Bookmark {
  children: BookmarkNode[];
}

export async function getBookmarkTree(libraryId: string): Promise<BookmarkNode[]> {
  const all = await getBookmarksByLibrary(libraryId);
  const byParent = new Map<string | null, Bookmark[]>();

  for (const bm of all) {
    const key = bm.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(bm);
  }

  function buildNodes(parentId: string | null): BookmarkNode[] {
    const items = byParent.get(parentId) ?? [];
    return items
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((bm) => ({ ...bm, children: buildNodes(bm.id) }));
  }

  return buildNodes(null);
}
