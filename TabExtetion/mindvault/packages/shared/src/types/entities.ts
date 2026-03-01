// ============================================================
// MindVault — Core Entity Types
// All timestamps are unix milliseconds (number) unless noted.
// All IDs are UUID v4 strings.
// ============================================================

// ---- Library (Profile / Company / Client namespace) --------

export interface Library {
  id: string;
  name: string;
  icon: string; // emoji e.g. "🧠"
  color: string; // hex e.g. "#007bff"
  isDefault: boolean;
  encryptionEnabled: boolean;
  encryptionSalt: string | null; // base64, 16 bytes — null if not encrypted
  encryptionKeyHash: string | null; // SHA-256(key+salt) for unlock verification
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
}

// ---- Session (snapshot of open tabs) -----------------------

export interface Session {
  id: string;
  libraryId: string;
  name: string;
  tabCount: number;
  windowCount: number;
  notes: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  /** Which browser saved this session — 'Chrome' | 'Firefox' | 'Edge' | 'Brave' | 'Opera' | 'Vivaldi' | '' */
  sourceBrowser?: string;
  /** Soft-delete flag: false = active (default), true = archived / hidden */
  archived?: boolean;
  /** Set to true once this session has been successfully pushed to companion SQLite.
   *  Used by syncAllUnpushedSessions() to skip already-synced sessions on reconnect. */
  syncedToCompanion?: boolean;
}

// ---- SavedTab (individual tab record) ----------------------

export interface SavedTab {
  id: string;
  sessionId: string;
  libraryId: string;
  url: string;
  title: string;
  favicon: string;
  repeatCount: number; // RGYB source — starts at 1
  allTimestamps: number[]; // unix ms array — replaces v1.1 locale strings
  firstSeenAt: number; // unix ms
  lastSeenAt: number; // unix ms
  notes: string;
  tags: string[];
  isPinned: boolean;
  legacyId: number | null; // v1.1 float ID preserved for reference
}

// ---- Bookmark ----------------------------------------------

export type BookmarkType = 'folder' | 'bookmark';

export interface Bookmark {
  id: string;
  libraryId: string;
  parentId: string | null; // null = root
  type: BookmarkType;
  title: string;
  url: string | null; // null for folders
  description: string;
  tags: string[];
  visitCount: number;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: number;
  modifiedAt: number;
}

// ---- HistoryEntry ------------------------------------------

export interface HistoryEntry {
  id: string;
  libraryId: string;
  url: string;
  title: string;
  visitTime: number; // unix ms — for range queries
  visitDate: string; // YYYY-MM-DD — for date-slice queries
  visitCount: number;
  transition: string; // chrome history transition type
  isImportant: boolean; // computed by rules engine
  isStarred: boolean;
  tags: string[];
}

// ---- Download (metadata only — never file content) ---------

export type DownloadState = 'complete' | 'interrupted' | 'in_progress';

export interface Download {
  id: string;
  libraryId: string;
  filename: string;
  url: string;
  finalUrl: string;
  fileSize: number; // bytes
  mimeType: string;
  downloadedAt: number; // unix ms
  state: DownloadState;
  referrer: string;
  notes: string;
  tags: string[];
}

// ---- Tag ---------------------------------------------------

export interface Tag {
  id: string;
  libraryId: string;
  name: string;
  color: string; // hex
  usageCount: number;
  createdAt: number;
}

// ---- AuditLog (append-only) --------------------------------

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditActor = 'extension' | 'companion' | 'import';
export type AuditEntityType =
  | 'library'
  | 'session'
  | 'saved_tab'
  | 'bookmark'
  | 'history_entry'
  | 'download'
  | 'tag';

export interface AuditLogEntry {
  id: string;
  libraryId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actor: AuditActor;
  timestamp: number;
  diffJson: string | null; // JSON string of before/after for UPDATE
  syncedAt: number | null;
}

// ---- SchemaMeta --------------------------------------------

export interface SchemaMeta {
  key: 'version';
  value: number; // e.g. 2
  migratedAt: number;
  migratedFrom: string; // e.g. "1.1"
}

// ---- History Rules -----------------------------------------

export type HistoryRuleOperator = 'gt' | 'eq' | 'lt' | 'gte' | 'lte';

export interface HistoryRule {
  id: string;
  name: string;
  enabled: boolean;
  condition:
    | { type: 'visit_count'; operator: HistoryRuleOperator; value: number }
    | { type: 'starred' }
    | { type: 'tagged'; tagName: string }
    | { type: 'domain'; pattern: string }
    | { type: 'date_range'; from: number; to: number };
}
