// ============================================================
// MindVault — .mvault Encrypted Backup Format
//
// File format:
//   { header: { version, salt, iv, libraryId, createdAt },
//     body: base64(AES-256-GCM(JSON-encoded backup)) }
//
// The backup password is independent from the library password.
// ============================================================

import { generateSalt, deriveKey } from '@mindvault/shared';
import { encryptField, decryptField } from '@mindvault/shared';
import type { JsonBackupSchema } from '@mindvault/shared';
import { getBookmarksByLibrary } from '../db/repositories/bookmarks';
import { getSessionsByLibrary } from '../db/repositories/sessions';
import { getTagsByLibrary } from '../db/repositories/tags';
import { getTabsByLibrary } from '../db/repositories/saved-tabs';
import { getHistoryByLibrary } from '../db/repositories/history';
import { getDownloadsByLibrary } from '../db/repositories/downloads';
import { getLibraryById } from '../db/repositories/libraries';
import { importFromJson } from './import';
import type { ImportResult } from './import';

// ---- Types -------------------------------------------------

export interface MvaultHeader {
  version: 1;
  salt: string;      // base64 16-byte PBKDF2 salt (for backup password)
  iv: string;        // base64 12-byte AES-GCM IV
  libraryId: string; // library this backup belongs to
  createdAt: number; // unix ms
}

export interface MvaultFile {
  header: MvaultHeader;
  body: string; // base64: AES-256-GCM(JSON-encoded JsonBackupSchema)
}

// ---- Export ------------------------------------------------

/**
 * Export a library as an encrypted .mvault backup file.
 * The backup password is independent from the library's own password.
 * Triggers a browser file download.
 */
export async function exportMvault(libraryId: string, password: string): Promise<void> {
  const library = await getLibraryById(libraryId);
  if (!library) throw new Error('Library not found');

  // Collect all data (reads return decrypted values from repositories)
  const [sessions, tabs, bookmarks, tags, history, downloads] = await Promise.all([
    getSessionsByLibrary(libraryId),
    getTabsByLibrary(libraryId),
    getBookmarksByLibrary(libraryId),
    getTagsByLibrary(libraryId),
    getHistoryByLibrary(libraryId, 50_000),
    getDownloadsByLibrary(libraryId, 5_000),
  ]);

  const backup: JsonBackupSchema = {
    exportedAt: new Date().toISOString(),
    library,
    sessions,
    tabs,
    bookmarks,
    tags,
    history,
    downloads,
  };

  // Derive a key from the backup password
  const salt = generateSalt();
  const key = await deriveKey(password, salt);

  // Encrypt the JSON body
  const plaintext = JSON.stringify(backup);
  const encrypted = await encryptField(plaintext, key);

  const file: MvaultFile = {
    header: {
      version: 1,
      salt,
      iv: encrypted.iv,
      libraryId,
      createdAt: Date.now(),
    },
    body: encrypted.ct,
  };

  const json = JSON.stringify(file, null, 2);
  const safeName = library.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `mindvault-${safeName}-${new Date().toISOString().slice(0, 10)}.mvault`;
  triggerDownload('data:application/json;charset=utf-8,' + encodeURIComponent(json), filename);
}

// ---- Import ------------------------------------------------

/**
 * Import a .mvault backup file.
 * Prompts the user for the backup password, decrypts, then writes to IndexedDB.
 * Returns an ImportResult with counts and any errors.
 */
export async function importMvault(file: File, password: string): Promise<ImportResult> {
  const text = await file.text();

  let mvault: unknown;
  try {
    mvault = JSON.parse(text);
  } catch {
    throw new Error('Could not parse .mvault file — invalid JSON.');
  }

  if (!isMvaultFile(mvault)) {
    throw new Error('Invalid .mvault format — missing header or body.');
  }

  // Derive the decryption key
  const key = await deriveKey(password, mvault.header.salt);

  // Decrypt body
  let plaintext: string;
  try {
    plaintext = await decryptField({ ct: mvault.body, iv: mvault.header.iv }, key);
  } catch {
    throw new Error('Decryption failed — incorrect password or corrupted file.');
  }

  let backup: unknown;
  try {
    backup = JSON.parse(plaintext);
  } catch {
    throw new Error('Decrypted content is not valid JSON — file may be corrupted.');
  }

  // Re-use the existing JSON import service
  return importFromJson(backup as JsonBackupSchema);
}

// ---- Type guard --------------------------------------------

function isMvaultFile(v: unknown): v is MvaultFile {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o['body'] !== 'string') return false;
  const h = o['header'];
  if (typeof h !== 'object' || h === null) return false;
  const hdr = h as Record<string, unknown>;
  return (
    hdr['version'] === 1 &&
    typeof hdr['salt'] === 'string' &&
    typeof hdr['iv'] === 'string' &&
    typeof hdr['libraryId'] === 'string' &&
    typeof hdr['createdAt'] === 'number'
  );
}

// ---- Helper ------------------------------------------------

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
