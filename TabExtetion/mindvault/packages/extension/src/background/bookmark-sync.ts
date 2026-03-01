// ============================================================
// MindVault — Bookmark Sync (Background Service Worker)
// Imports and syncs chrome.bookmarks to IndexedDB bookmarks store.
// ============================================================

import {
  createBookmark,
  createFolder,
  getBookmarkByUrl,
  getBookmarksByLibrary,
  updateBookmark,
  deleteBookmark,
} from '../db/repositories/bookmarks';
import { pushBookmark } from '../services/companion-client';

/** Map Chrome bookmark node to our BookmarkType. */
function isFolder(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return node.url === undefined;
}

/**
 * Recursively import a Chrome bookmark tree node into IndexedDB.
 * Uses URL-based dedup for bookmarks, title-based for folders.
 *
 * @param node - Chrome BookmarkTreeNode
 * @param libraryId - Target library
 * @param parentId - MindVault parentId (null for roots)
 * @param order - Sort order index
 */
async function importNode(
  node: chrome.bookmarks.BookmarkTreeNode,
  libraryId: string,
  parentId: string | null,
  order: number
): Promise<string> {
  if (isFolder(node)) {
    // Create folder if it has a real title (skip Chrome root containers)
    if (!node.title) return parentId ?? '';

    const folder = await createFolder(libraryId, node.title, parentId);
    // Recurse into children
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      await importNode(children[i], libraryId, folder.id, i);
    }
    return folder.id;
  } else {
    // Bookmark — deduplicate by URL
    const url = node.url ?? '';
    if (!url) return '';

    const existing = await getBookmarkByUrl(libraryId, url);
    if (existing) return existing.id;

    const bm = await createBookmark({
      libraryId,
      parentId,
      type: 'bookmark',
      title: node.title ?? url,
      url,
      description: '',
      tags: [],
      visitCount: 0,
      isFavorite: false,
      sortOrder: order,
    });
    return bm.id;
  }
}

/**
 * Full sync: walk chrome.bookmarks.getTree() and import all entries.
 * Skips if library already has bookmarks (idempotent).
 */
export async function syncAllBookmarks(libraryId: string): Promise<number> {
  const existing = await getBookmarksByLibrary(libraryId);
  if (existing.length > 0) return existing.length;

  const [root] = await chrome.bookmarks.getTree();
  if (!root) return 0;

  let total = 0;
  const children = root.children ?? [];
  for (let i = 0; i < children.length; i++) {
    await importNode(children[i], libraryId, null, i);
    total++;
  }

  return total;
}

/**
 * Listen for live bookmark changes and sync to IndexedDB.
 */
function registerLiveSync(libraryId: string): void {
  chrome.bookmarks.onCreated.addListener(
    (_id: string, node: chrome.bookmarks.BookmarkTreeNode) => {
      void importNode(node, libraryId, null, Date.now()).then((bmId) => {
        if (!bmId || !node.url) return; // skip folders (no url)
        void pushBookmark(libraryId, {
          id: bmId,
          title: node.title ?? node.url,
          url: node.url ?? null,
          notes: '',
          isFolder: false,
        });
      });
    }
  );

  chrome.bookmarks.onRemoved.addListener(
    async (_id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => {
      // Find by URL (bookmarks) — best effort
      if (removeInfo.node.url) {
        const bm = await getBookmarkByUrl(libraryId, removeInfo.node.url);
        if (bm) await deleteBookmark(bm.id);
      }
    }
  );

  chrome.bookmarks.onChanged.addListener(
    async (_id: string, changeInfo: chrome.bookmarks.BookmarkChangesArg) => {
      if (!changeInfo.url) return;
      const bm = await getBookmarkByUrl(libraryId, changeInfo.url);
      if (!bm) return;
      await updateBookmark({ ...bm, title: changeInfo.title ?? bm.title });
    }
  );
}

/**
 * Full init: sync existing bookmarks, then start live sync.
 */
export async function initBookmarkSync(libraryId: string): Promise<void> {
  try {
    const count = await syncAllBookmarks(libraryId);
    console.log('MindVault: synced', count, 'bookmark root nodes for library', libraryId);
  } catch (err) {
    console.error('MindVault: bookmark sync failed', err);
  }

  registerLiveSync(libraryId);
}