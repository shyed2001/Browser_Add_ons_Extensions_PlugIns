// ============================================================
// MindVault — Migration Runner
// Orchestrates schema migrations based on old → new DB version.
// Add new cases here as the schema evolves (v2→v3, v3→v4, etc.)
// ============================================================

import { migrateV1ToV2 } from './v1-to-v2';

/**
 * Run all necessary migrations for a given version upgrade.
 * Called from db/index.ts onupgradeneeded handler.
 *
 * @param db       The IDBDatabase instance
 * @param oldVersion  The previous schema version (0 = fresh install)
 * @param newVersion  The target schema version
 */
export async function runMigrations(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number
): Promise<void> {
  console.warn(`MindVault: Running migrations from v${oldVersion} to v${newVersion}`);

  // Fresh install (0 → 2): run v1.1 chrome.storage.local migration
  // Also runs on first install even with no legacy data (creates Default Library)
  if (oldVersion < 2 && newVersion >= 2) {
    try {
      const result = await migrateV1ToV2(db);
      if (result.skipped) {
        console.warn('MindVault: Migration v1→v2 already completed, skipping.');
      } else {
        console.warn(
          `MindVault: Migration v1→v2 complete. ${result.recordCount} records imported.`,
          result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}` : ''
        );
      }
    } catch (err) {
      console.error('MindVault: Migration v1→v2 failed:', err);
      // Do NOT re-throw — extension must remain functional even if migration fails
      // The extension will fall back to creating a fresh empty DB
    }
  }

  // Future migrations: add here
  // if (oldVersion < 3 && newVersion >= 3) { await migrateV2ToV3(db); }
}
