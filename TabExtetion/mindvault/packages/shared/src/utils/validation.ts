// ============================================================
// MindVault — Validation Utilities
// Type guards used by import.ts to validate data before writing.
// ============================================================

import type { Library, Session, SavedTab, Bookmark, Tag, HistoryEntry, Download } from '../types/entities';

// ---- Primitive helpers -------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(isNumber);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---- Entity type guards ------------------------------------

export function isValidLibrary(v: unknown): v is Library {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['name']) &&
    isBoolean(v['isDefault']) &&
    isBoolean(v['encryptionEnabled']) &&
    isNumber(v['createdAt']) &&
    isNumber(v['updatedAt'])
  );
}

export function isValidSession(v: unknown): v is Session {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['libraryId']) &&
    isString(v['name']) &&
    isNumber(v['tabCount']) &&
    isNumber(v['windowCount']) &&
    isStringArray(v['tags']) &&
    isBoolean(v['isFavorite']) &&
    isNumber(v['createdAt']) &&
    isNumber(v['updatedAt'])
  );
}

export function isValidSavedTab(v: unknown): v is SavedTab {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['sessionId']) &&
    isString(v['libraryId']) &&
    isString(v['url']) &&
    isString(v['title']) &&
    isNumber(v['repeatCount']) &&
    isNumberArray(v['allTimestamps']) &&
    isNumber(v['firstSeenAt']) &&
    isNumber(v['lastSeenAt'])
  );
}

export function isValidBookmark(v: unknown): v is Bookmark {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['libraryId']) &&
    (v['parentId'] === null || isString(v['parentId'])) &&
    (v['type'] === 'folder' || v['type'] === 'bookmark') &&
    isString(v['title']) &&
    isNumber(v['visitCount']) &&
    isBoolean(v['isFavorite']) &&
    isNumber(v['sortOrder']) &&
    isNumber(v['createdAt']) &&
    isNumber(v['modifiedAt'])
  );
}

export function isValidTag(v: unknown): v is Tag {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['libraryId']) &&
    isString(v['name']) &&
    isNumber(v['usageCount']) &&
    isNumber(v['createdAt'])
  );
}

export function isValidHistoryEntry(v: unknown): v is HistoryEntry {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['libraryId']) &&
    isString(v['url']) &&
    isNumber(v['visitTime']) &&
    isString(v['visitDate']) &&
    isNumber(v['visitCount']) &&
    isBoolean(v['isImportant']) &&
    isBoolean(v['isStarred'])
  );
}

export function isValidDownload(v: unknown): v is Download {
  if (!isObject(v)) return false;
  return (
    isString(v['id']) &&
    isString(v['libraryId']) &&
    isString(v['filename']) &&
    isString(v['url']) &&
    isNumber(v['downloadedAt'])
  );
}

// ---- JSON backup schema validation -------------------------

export interface JsonBackupSchema {
  exportedAt: string;
  library: Library;
  sessions: Session[];
  tabs: SavedTab[];
  bookmarks?: Bookmark[];
  tags?: Tag[];
  history?: HistoryEntry[];
  downloads?: Download[];
}

export function isValidJsonBackup(v: unknown): v is JsonBackupSchema {
  if (!isObject(v)) return false;
  if (!isString(v['exportedAt'])) return false;
  if (!isValidLibrary(v['library'])) return false;
  if (!Array.isArray(v['sessions']) || !v['sessions'].every(isValidSession)) return false;
  if (!Array.isArray(v['tabs']) || !v['tabs'].every(isValidSavedTab)) return false;
  return true;
}
