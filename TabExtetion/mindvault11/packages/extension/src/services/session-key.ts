// ============================================================
// MindVault — Session Key Store
// Manages in-memory CryptoKey instances for encrypted libraries.
// Keys are never persisted — cleared on lock or page close.
// ============================================================

import { encryptField, decryptField } from '@mindvault/shared';
import type { EncryptedField } from '@mindvault/shared';

/**
 * In-memory map: libraryId → active CryptoKey.
 * Populated by the dashboard UI after password verification.
 * Consumed by repositories to encrypt/decrypt sensitive fields.
 */
const _keys = new Map<string, CryptoKey>();

/** Store an unlocked key for a library (called after password verify). */
export function setSessionKey(libraryId: string, key: CryptoKey): void {
  _keys.set(libraryId, key);
}

/** Remove the key for a library (explicit lock or password change). */
export function clearSessionKey(libraryId: string): void {
  _keys.delete(libraryId);
}

/** Return the active key for a library, or null if locked/not encrypted. */
export function getSessionKey(libraryId: string): CryptoKey | null {
  return _keys.get(libraryId) ?? null;
}

/** Remove all session keys (e.g. on extension unload or global lock). */
export function clearAllSessionKeys(): void {
  _keys.clear();
}

// ---- Encrypt/decrypt helpers for repository use ---------------

/**
 * Encrypt a string field and serialize to a JSON string for IndexedDB storage.
 * Returns plaintext unchanged when no key is provided.
 */
export async function encryptString(plaintext: string, key: CryptoKey | null): Promise<string> {
  if (!key) return plaintext;
  const ef = await encryptField(plaintext, key);
  return JSON.stringify(ef);
}

/**
 * Decrypt a field stored as either plaintext or a JSON-serialized EncryptedField.
 * Safely returns the raw string when no key is provided or the value is plaintext.
 */
export async function decryptString(stored: string, key: CryptoKey | null): Promise<string> {
  if (!key) return stored;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as EncryptedField).ct === 'string' &&
      typeof (parsed as EncryptedField).iv === 'string'
    ) {
      return await decryptField(parsed as EncryptedField, key);
    }
  } catch {
    // Not JSON-encoded — treat as plaintext (unencrypted library or legacy value)
  }
  return stored;
}
