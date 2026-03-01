// ============================================================
// MindVault — Bookmarks Repository Tests
// CRUD + tree operations
// ============================================================

import { describe, it, expect } from 'vitest';
import { DB_NAME, DB_VERSION, createSchema } from '../schema';
import {
  getBookmarksByLibrary,
  getChildBookmarks,
  getBookmarkById,
  getBookmarkByUrl,
  createBookmark,
  createFolder,
  updateBookmark,
  deleteBookmark,
  incrementBookmarkVisit,
  getBookmarkTree,
} from './bookmarks';
import { createLibrary } from './libraries';

// ---- Helpers -----------------------------------------------

let testLibraryId: string;

async function setupLibrary(): Promise<void> {
  const lib = await createLibrary({
    name: 'Test Library',
    icon: '📚',
    color: '#007bff',
    isDefault: true,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
  });
  testLibraryId = lib.id;
}

// ---- Tests -------------------------------------------------

describe('Bookmarks Repository', () => {
  beforeEach(async () => {
    await setupLibrary();
  });

  describe('createBookmark', () => {
    it('creates a bookmark with generated id and timestamps', async () => {
      const bm = await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'Test Bookmark',
        url: 'https://example.com',
        description: 'A test bookmark',
        tags: ['test'],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      expect(bm.id).toBeDefined();
      expect(bm.title).toBe('Test Bookmark');
      expect(bm.url).toBe('https://example.com');
      expect(bm.createdAt).toBeGreaterThan(0);
      expect(bm.modifiedAt).toBeGreaterThan(0);
    });
  });

  describe('createFolder', () => {
    it('creates a folder with type=folder and null url', async () => {
      const folder = await createFolder(testLibraryId, 'Research');

      expect(folder.type).toBe('folder');
      expect(folder.url).toBeNull();
      expect(folder.title).toBe('Research');
      expect(folder.parentId).toBeNull();
    });
  });

  describe('getBookmarksByLibrary', () => {
    it('returns all bookmarks for a library', async () => {
      await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'BM 1',
        url: 'https://one.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });
      await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'BM 2',
        url: 'https://two.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 2,
      });

      const all = await getBookmarksByLibrary(testLibraryId);
      expect(all).toHaveLength(2);
    });

    it('returns empty array for unknown library', async () => {
      const all = await getBookmarksByLibrary('nonexistent');
      expect(all).toHaveLength(0);
    });
  });

  describe('getChildBookmarks', () => {
    it('returns children of a folder', async () => {
      const folder = await createFolder(testLibraryId, 'Work');
      await createBookmark({
        libraryId: testLibraryId,
        parentId: folder.id,
        type: 'bookmark',
        title: 'Child BM',
        url: 'https://child.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      const children = await getChildBookmarks(testLibraryId, folder.id);
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe('Child BM');
    });

    it('returns root items when parentId is null', async () => {
      await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'Root BM',
        url: 'https://root.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      const roots = await getChildBookmarks(testLibraryId, null);
      expect(roots.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getBookmarkById', () => {
    it('returns bookmark by id', async () => {
      const bm = await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'Find Me',
        url: 'https://findme.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      const found = await getBookmarkById(bm.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Find Me');
    });

    it('returns null for nonexistent id', async () => {
      const found = await getBookmarkById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('getBookmarkByUrl', () => {
    it('finds bookmark by URL within a library', async () => {
      await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'URL Test',
        url: 'https://unique-url.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      const found = await getBookmarkByUrl(testLibraryId, 'https://unique-url.com');
      expect(found).not.toBeNull();
      expect(found!.title).toBe('URL Test');
    });

    it('returns null for nonexistent URL', async () => {
      const found = await getBookmarkByUrl(testLibraryId, 'https://no-such-url.com');
      expect(found).toBeNull();
    });
  });

  describe('updateBookmark', () => {
    it('updates a bookmark and refreshes modifiedAt', async () => {
      const bm = await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'Original',
        url: 'https://update.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      await updateBookmark({ ...bm, title: 'Updated', isFavorite: true });

      const updated = await getBookmarkById(bm.id);
      expect(updated!.title).toBe('Updated');
      expect(updated!.isFavorite).toBe(true);
      expect(updated!.modifiedAt).toBeGreaterThanOrEqual(bm.modifiedAt);
    });
  });

  describe('deleteBookmark', () => {
    it('removes a bookmark', async () => {
      const bm = await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'Delete Me',
        url: 'https://delete.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });

      await deleteBookmark(bm.id);

      const found = await getBookmarkById(bm.id);
      expect(found).toBeNull();
    });
  });

  describe('incrementBookmarkVisit', () => {
    it('increments visitCount by 1', async () => {
      const bm = await createBookmark({
        libraryId: testLibraryId,
        parentId: null,
        type: 'bookmark',
        title: 'Visit Me',
        url: 'https://visit.com',
        description: '',
        tags: [],
        visitCount: 3,
        isFavorite: false,
        sortOrder: 1,
      });

      await incrementBookmarkVisit(bm.id);

      const updated = await getBookmarkById(bm.id);
      expect(updated!.visitCount).toBe(4);
    });

    it('does nothing for folders', async () => {
      const folder = await createFolder(testLibraryId, 'No Visit');
      await incrementBookmarkVisit(folder.id);

      const found = await getBookmarkById(folder.id);
      expect(found!.visitCount).toBe(0);
    });
  });

  describe('getBookmarkTree', () => {
    it('builds a nested tree structure', async () => {
      const folder = await createFolder(testLibraryId, 'Parent Folder');
      await createBookmark({
        libraryId: testLibraryId,
        parentId: folder.id,
        type: 'bookmark',
        title: 'Child 1',
        url: 'https://child1.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 1,
      });
      await createBookmark({
        libraryId: testLibraryId,
        parentId: folder.id,
        type: 'bookmark',
        title: 'Child 2',
        url: 'https://child2.com',
        description: '',
        tags: [],
        visitCount: 0,
        isFavorite: false,
        sortOrder: 2,
      });

      const tree = await getBookmarkTree(testLibraryId);
      const folderNode = tree.find((n) => n.type === 'folder');
      expect(folderNode).toBeDefined();
      expect(folderNode!.children).toHaveLength(2);
      expect(folderNode!.children[0].title).toBe('Child 1');
      expect(folderNode!.children[1].title).toBe('Child 2');
    });

    it('returns empty array for empty library', async () => {
      const tree = await getBookmarkTree('nonexistent');
      expect(tree).toHaveLength(0);
    });
  });
});
