// ============================================================
// MindVault — Legacy v1.1 Schema Types
// Used exclusively by the migration script v1-to-v2.ts
// DO NOT use these types in new code.
// ============================================================

/**
 * The exact shape of a record stored in chrome.storage.local['tabDatabase']
 * by OpenTabListInfoRestore v1.1.
 *
 * Key characteristics:
 * - id: Date.now() + Math.random() → decimal float (e.g. 1706000627452.847)
 * - timestamps: array of toLocaleString() strings — locale-dependent, NOT ISO
 * - remarks: always "" — safe to discard
 */
export interface LegacyTabRecord {
  id: number; // float: Date.now() + Math.random()
  title: string;
  url: string; // duplicate-detection key (exact case-sensitive match)
  repeatCount: number; // starts at 1, increments on each duplicate save
  timestamps: string[]; // toLocaleString() formatted — e.g. "2/22/2026, 10:30:45 AM"
  notes: string;
  remarks: string; // always "" in v1.1 — discard during migration
}

/**
 * The storage key used by v1.1 in chrome.storage.local
 */
export const LEGACY_STORAGE_KEY = 'tabDatabase' as const;

/**
 * The migration completion flag stored in chrome.storage.local after v2 migration
 */
export interface MigrationRecord {
  version: string; // '2.0.0'
  date: number; // unix ms
  recordCount: number;
  sessionId: string; // UUID of the "Legacy Import" session created
  libraryId: string; // UUID of the "Default Library" created
}

export const MIGRATION_FLAG_KEY = 'migration_v2_complete' as const;
