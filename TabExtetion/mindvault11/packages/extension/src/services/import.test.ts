// ============================================================
// MindVault — Import Service Tests
// JSON roundtrip: export → import → data matches original
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { STORE } from '../db/schema';
import type { Library, Session, SavedTab, Bookmark, Tag } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { isValidJsonBackup, type JsonBackupSchema } from '@mindvault/shared';
import { importFromJson, parseJsonBackup } from './import';
import { openDB, closeDB } from '../db/index';

// ---- Helpers -----------------------------------------------

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ---- Test data ---------------------------------------------

const now = Date.now();

function makeLibrary(): Library {
  return {
    id: generateUUID(),
    name: 'Test Library',
    icon: '📚',
    color: '#007bff',
    isDefault: true,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeSession(libraryId: string): Session {
  return {
    id: generateUUID(),
    libraryId,
    name: 'Test Session',
    tabCount: 2,
    windowCount: 1,
    notes: 'Test notes',
    tags: ['test'],
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

function makeTab(sessionId: string, libraryId: string, url: string, title: string): SavedTab {
  return {
    id: generateUUID(),
    sessionId,
    libraryId,
    url,
    title,
    favicon: '',
    repeatCount: 3,
    allTimestamps: [now - 2000, now - 1000, now],
    firstSeenAt: now - 2000,
    lastSeenAt: now,
    notes: 'Tab note',
    tags: ['research'],
    isPinned: false,
    legacyId: null,
  };
}

function makeBookmark(libraryId: string): Bookmark {
  return {
    id: generateUUID(),
    libraryId,
    parentId: null,
    type: 'bookmark',
    title: 'Test Bookmark',
    url: 'https://bookmark.example.com',
    description: 'A bookmark',
    tags: ['saved'],
    visitCount: 5,
    isFavorite: true,
    sortOrder: 1,
    createdAt: now,
    modifiedAt: now,
  };
}

function makeTag(libraryId: string): Tag {
  return {
    id: generateUUID(),
    libraryId,
    name: 'research',
    color: '#ff0000',
    usageCount: 3,
    createdAt: now,
  };
}

function createTestBackup(): JsonBackupSchema {
  const library = makeLibrary();
  const session = makeSession(library.id);
  const tab1 = makeTab(session.id, library.id, 'https://google.com', 'Google');
  const tab2 = makeTab(session.id, library.id, 'https://github.com', 'GitHub');
  const bookmark = makeBookmark(library.id);
  const tag = makeTag(library.id);

  return {
    exportedAt: new Date().toISOString(),
    library,
    sessions: [session],
    tabs: [tab1, tab2],
    bookmarks: [bookmark],
    tags: [tag],
  };
}

// ---- Tests -------------------------------------------------

describe('Import Service', () => {
  beforeEach(() => {
    // closeDB clears the cached singleton so openDB() creates a fresh connection
    // on the new IDBFactory that test-setup.ts provides
    closeDB();
  });

  describe('parseJsonBackup', () => {
    it('parses valid JSON backup from file', async () => {
      const backup = createTestBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const file = new File([blob], 'backup.json');

      const parsed = await parseJsonBackup(file);
      expect(parsed.library.name).toBe('Test Library');
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.tabs).toHaveLength(2);
    });

    it('rejects invalid JSON', async () => {
      const blob = new Blob(['not json at all'], { type: 'application/json' });
      const file = new File([blob], 'bad.json');

      await expect(parseJsonBackup(file)).rejects.toThrow('Invalid JSON');
    });

    it('rejects JSON missing required fields', async () => {
      const blob = new Blob([JSON.stringify({ foo: 'bar' })], { type: 'application/json' });
      const file = new File([blob], 'incomplete.json');

      await expect(parseJsonBackup(file)).rejects.toThrow('Invalid backup format');
    });
  });

  describe('importFromJson', () => {
    it('imports all entities to IndexedDB', async () => {
      const backup = createTestBackup();
      const result = await importFromJson(backup);

      expect(result.success).toBe(true);
      expect(result.counts.sessions).toBe(1);
      expect(result.counts.tabs).toBe(2);
      expect(result.counts.bookmarks).toBe(1);
      expect(result.counts.tags).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('writes library to IndexedDB', async () => {
      const backup = createTestBackup();
      await importFromJson(backup);

      const db = await openDB();
      const libraries = await getAllFromStore<Library>(db, STORE.LIBRARIES);
      expect(libraries).toHaveLength(1);
      expect(libraries[0].name).toBe('Test Library');
      db.close();
    });

    it('writes sessions to IndexedDB', async () => {
      const backup = createTestBackup();
      await importFromJson(backup);

      const db = await openDB();
      const sessions = await getAllFromStore<Session>(db, STORE.SESSIONS);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Test Session');
      db.close();
    });

    it('writes tabs with correct data', async () => {
      const backup = createTestBackup();
      await importFromJson(backup);

      const db = await openDB();
      const tabs = await getAllFromStore<SavedTab>(db, STORE.SAVED_TABS);
      expect(tabs).toHaveLength(2);

      const google = tabs.find((t) => t.url === 'https://google.com');
      expect(google).toBeDefined();
      expect(google!.title).toBe('Google');
      expect(google!.repeatCount).toBe(3);
      expect(google!.allTimestamps).toHaveLength(3);
      db.close();
    });

    it('writes bookmarks to IndexedDB', async () => {
      const backup = createTestBackup();
      await importFromJson(backup);

      const db = await openDB();
      const bookmarks = await getAllFromStore<Bookmark>(db, STORE.BOOKMARKS);
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].title).toBe('Test Bookmark');
      expect(bookmarks[0].visitCount).toBe(5);
      db.close();
    });

    it('writes tags to IndexedDB', async () => {
      const backup = createTestBackup();
      await importFromJson(backup);

      const db = await openDB();
      const tags = await getAllFromStore<Tag>(db, STORE.TAGS);
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('research');
      db.close();
    });

    it('handles backup without optional bookmarks/tags', async () => {
      const backup = createTestBackup();
      delete backup.bookmarks;
      delete backup.tags;

      const result = await importFromJson(backup);
      expect(result.success).toBe(true);
      expect(result.counts.bookmarks).toBe(0);
      expect(result.counts.tags).toBe(0);
    });

    it('returns libraryId in result', async () => {
      const backup = createTestBackup();
      const result = await importFromJson(backup);
      expect(result.libraryId).toBe(backup.library.id);
    });
  });

  describe('JSON roundtrip (export → import → data matches)', () => {
    it('imported data matches exported data exactly', async () => {
      const original = createTestBackup();

      // "Export" — serialize to JSON string
      const exported = JSON.stringify(original);

      // "Import" — parse and write to DB
      const parsed = JSON.parse(exported) as unknown;
      expect(isValidJsonBackup(parsed)).toBe(true);

      const result = await importFromJson(parsed as JsonBackupSchema);
      expect(result.success).toBe(true);

      // Verify each entity matches
      const db = await openDB();

      const libraries = await getAllFromStore<Library>(db, STORE.LIBRARIES);
      expect(libraries[0].id).toBe(original.library.id);
      expect(libraries[0].name).toBe(original.library.name);

      const sessions = await getAllFromStore<Session>(db, STORE.SESSIONS);
      expect(sessions[0].id).toBe(original.sessions[0].id);
      expect(sessions[0].tabCount).toBe(original.sessions[0].tabCount);

      const tabs = await getAllFromStore<SavedTab>(db, STORE.SAVED_TABS);
      expect(tabs).toHaveLength(original.tabs.length);
      for (const origTab of original.tabs) {
        const imported = tabs.find((t) => t.id === origTab.id);
        expect(imported).toBeDefined();
        expect(imported!.url).toBe(origTab.url);
        expect(imported!.title).toBe(origTab.title);
        expect(imported!.repeatCount).toBe(origTab.repeatCount);
        expect(imported!.allTimestamps).toEqual(origTab.allTimestamps);
        expect(imported!.notes).toBe(origTab.notes);
      }

      const bookmarks = await getAllFromStore<Bookmark>(db, STORE.BOOKMARKS);
      expect(bookmarks[0].id).toBe(original.bookmarks![0].id);
      expect(bookmarks[0].url).toBe(original.bookmarks![0].url);

      const tags = await getAllFromStore<Tag>(db, STORE.TAGS);
      expect(tags[0].id).toBe(original.tags![0].id);
      expect(tags[0].name).toBe(original.tags![0].name);

      db.close();
    });
  });
});
