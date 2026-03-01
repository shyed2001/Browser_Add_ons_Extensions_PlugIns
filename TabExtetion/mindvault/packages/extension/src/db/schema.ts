// ============================================================
// MindVault — IndexedDB Schema Definitions
// Schema version 2 (migrated from v1.1 chrome.storage.local)
// ============================================================

export const DB_NAME = 'mindvault';
export const DB_VERSION = 2;

/** Object store names — use these constants everywhere, never raw strings */
export const STORE = {
  LIBRARIES: 'libraries',
  SESSIONS: 'sessions',
  SAVED_TABS: 'saved_tabs',
  BOOKMARKS: 'bookmarks',
  HISTORY_ENTRIES: 'history_entries',
  DOWNLOADS: 'downloads',
  TAGS: 'tags',
  AUDIT_LOG: 'audit_log',
  SCHEMA_META: 'schema_meta',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

/**
 * Create all IndexedDB object stores and indexes.
 * Called during onupgradeneeded for a fresh install (version 0 → 2).
 * For future schema migrations (version 2 → 3 etc), add cases in db/migrations/runner.ts
 */
export function createSchema(db: IDBDatabase): void {
  // ---- libraries ----
  if (!db.objectStoreNames.contains(STORE.LIBRARIES)) {
    const libraries = db.createObjectStore(STORE.LIBRARIES, { keyPath: 'id' });
    libraries.createIndex('isDefault', 'isDefault', { unique: false });
  }

  // ---- sessions ----
  if (!db.objectStoreNames.contains(STORE.SESSIONS)) {
    const sessions = db.createObjectStore(STORE.SESSIONS, { keyPath: 'id' });
    sessions.createIndex('libraryId', 'libraryId', { unique: false });
    sessions.createIndex('createdAt', 'createdAt', { unique: false });
    sessions.createIndex('isFavorite', 'isFavorite', { unique: false });
    sessions.createIndex('libraryId_createdAt', ['libraryId', 'createdAt'], { unique: false });
  }

  // ---- saved_tabs ----
  if (!db.objectStoreNames.contains(STORE.SAVED_TABS)) {
    const savedTabs = db.createObjectStore(STORE.SAVED_TABS, { keyPath: 'id' });
    savedTabs.createIndex('sessionId', 'sessionId', { unique: false });
    savedTabs.createIndex('libraryId', 'libraryId', { unique: false });
    savedTabs.createIndex('url', 'url', { unique: false });
    savedTabs.createIndex('repeatCount', 'repeatCount', { unique: false });
    savedTabs.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
    savedTabs.createIndex('libraryId_url', ['libraryId', 'url'], { unique: false });
  }

  // ---- bookmarks ----
  if (!db.objectStoreNames.contains(STORE.BOOKMARKS)) {
    const bookmarks = db.createObjectStore(STORE.BOOKMARKS, { keyPath: 'id' });
    bookmarks.createIndex('libraryId', 'libraryId', { unique: false });
    bookmarks.createIndex('parentId', 'parentId', { unique: false });
    bookmarks.createIndex('url', 'url', { unique: false });
    bookmarks.createIndex('libraryId_parentId', ['libraryId', 'parentId'], { unique: false });
  }

  // ---- history_entries ----
  if (!db.objectStoreNames.contains(STORE.HISTORY_ENTRIES)) {
    const history = db.createObjectStore(STORE.HISTORY_ENTRIES, { keyPath: 'id' });
    history.createIndex('libraryId', 'libraryId', { unique: false });
    history.createIndex('visitTime', 'visitTime', { unique: false });
    history.createIndex('visitDate', 'visitDate', { unique: false });
    history.createIndex('isImportant', 'isImportant', { unique: false });
    history.createIndex('url', 'url', { unique: false });
    history.createIndex('libraryId_visitTime', ['libraryId', 'visitTime'], { unique: false });
    history.createIndex('libraryId_isImportant', ['libraryId', 'isImportant'], { unique: false });
  }

  // ---- downloads ----
  if (!db.objectStoreNames.contains(STORE.DOWNLOADS)) {
    const downloads = db.createObjectStore(STORE.DOWNLOADS, { keyPath: 'id' });
    downloads.createIndex('libraryId', 'libraryId', { unique: false });
    downloads.createIndex('downloadedAt', 'downloadedAt', { unique: false });
    downloads.createIndex('mimeType', 'mimeType', { unique: false });
    downloads.createIndex('url', 'url', { unique: false });
    downloads.createIndex('libraryId_downloadedAt', ['libraryId', 'downloadedAt'], {
      unique: false,
    });
  }

  // ---- tags ----
  if (!db.objectStoreNames.contains(STORE.TAGS)) {
    const tags = db.createObjectStore(STORE.TAGS, { keyPath: 'id' });
    tags.createIndex('libraryId', 'libraryId', { unique: false });
    tags.createIndex('libraryId_name', ['libraryId', 'name'], { unique: true });
  }

  // ---- audit_log ----
  if (!db.objectStoreNames.contains(STORE.AUDIT_LOG)) {
    const audit = db.createObjectStore(STORE.AUDIT_LOG, { keyPath: 'id' });
    audit.createIndex('timestamp', 'timestamp', { unique: false });
    audit.createIndex('entityType', 'entityType', { unique: false });
    audit.createIndex('libraryId', 'libraryId', { unique: false });
    audit.createIndex('libraryId_timestamp', ['libraryId', 'timestamp'], { unique: false });
  }

  // ---- schema_meta ----
  if (!db.objectStoreNames.contains(STORE.SCHEMA_META)) {
    db.createObjectStore(STORE.SCHEMA_META, { keyPath: 'key' });
  }
}
