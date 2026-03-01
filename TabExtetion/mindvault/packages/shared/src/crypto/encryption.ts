// ============================================================
// MindVault — AES-256-GCM Encryption (WebCrypto API)
// Used in extension. Mirrors Go implementation in companion.
//
// Encrypted field format:
//   { ct: base64(ciphertext+tag), iv: base64(12 bytes) }
//   (GCM tag is appended to ciphertext by SubtleCrypto)
// ============================================================

export interface EncryptedField {
  ct: string; // base64: ciphertext + 16-byte GCM auth tag
  iv: string; // base64: 12-byte random IV (unique per encryption)
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param plaintext - The string to encrypt
 * @param key - A CryptoKey imported as AES-GCM, 256-bit
 * @returns EncryptedField with base64-encoded ciphertext+tag and IV
 */
export async function encryptField(plaintext: string, key: CryptoKey): Promise<EncryptedField> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    ct: arrayBufferToBase64(cipherBuffer),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt an EncryptedField back to a plaintext string.
 * @param encrypted - The EncryptedField to decrypt
 * @param key - The same CryptoKey used during encryption
 * @returns Decrypted plaintext string
 */
export async function decryptField(encrypted: EncryptedField, key: CryptoKey): Promise<string> {
  const iv = base64ToUint8Array(encrypted.iv);
  const cipherBuffer = base64ToArrayBuffer(encrypted.ct);

  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuffer);

  return new TextDecoder().decode(plainBuffer);
}

/**
 * Encrypt a field only if the library is encrypted.
 * Returns the plaintext unchanged if no key is provided.
 */
export async function maybeEncryptField(
  plaintext: string,
  key: CryptoKey | null
): Promise<string | EncryptedField> {
  if (!key) return plaintext;
  return encryptField(plaintext, key);
}

/**
 * Decrypt a field that may be plaintext (unencrypted library) or EncryptedField.
 */
export async function maybeDecryptField(
  value: string | EncryptedField,
  key: CryptoKey | null
): Promise<string> {
  if (!key || typeof value === 'string') return value as string;
  return decryptField(value, key);
}

// ---- Base64 helpers ----------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return uint8ArrayToBase64(bytes);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return base64ToUint8Array(base64).buffer;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
