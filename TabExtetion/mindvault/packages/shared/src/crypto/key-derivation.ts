// ============================================================
// MindVault — PBKDF2-SHA256 Key Derivation (WebCrypto API)
// Per-library key derivation for AES-256-GCM encryption.
//
// Security parameters (OWASP 2024):
//   Algorithm:   PBKDF2-SHA256
//   Iterations:  600,000
//   Salt:        16 bytes random (stored per library, NOT secret)
//   Output:      32 bytes (256-bit AES key)
// ============================================================

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

/**
 * Generate a new random 16-byte salt for a library.
 * Store this in the library record (it is NOT secret).
 * @returns base64-encoded salt string
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return uint8ArrayToBase64(salt);
}

/**
 * Derive an AES-256-GCM CryptoKey from a password + salt.
 * This is the in-memory session key — NEVER store this.
 *
 * @param password - User's library password
 * @param saltBase64 - base64-encoded 16-byte salt from library record
 * @returns CryptoKey for AES-GCM operations
 */
export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password);
  const salt = base64ToUint8Array(saltBase64);

  // Import raw password as key material
  const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, [
    'deriveKey',
  ]);

  // Derive the AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_BITS },
    false, // not extractable — key stays in memory only
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a verification hash: SHA-256(rawKey bytes + salt bytes).
 * Store this in the library record to verify correct password on unlock
 * WITHOUT storing the key itself.
 *
 * Note: We export a PBKDF2-derived key for hashing purposes only.
 * A separate non-extractable key is used for actual encryption.
 */
export async function generateKeyVerificationHash(
  password: string,
  saltBase64: string
): Promise<string> {
  const passwordBytes = new TextEncoder().encode(password);
  const salt = base64ToUint8Array(saltBase64);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, [
    'deriveKey',
  ]);

  // Derive an extractable key for hashing
  const extractableKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_BITS },
    true, // extractable — only for generating the verification hash
    ['encrypt', 'decrypt']
  );

  // Export raw key bytes
  const rawKey = await crypto.subtle.exportKey('raw', extractableKey);

  // Concatenate rawKey + salt
  const combined = new Uint8Array(rawKey.byteLength + salt.byteLength);
  combined.set(new Uint8Array(rawKey), 0);
  combined.set(salt, rawKey.byteLength);

  // SHA-256 hash of the combination
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return uint8ArrayToBase64(new Uint8Array(hashBuffer));
}

/**
 * Verify that a password matches the stored key verification hash.
 * @returns true if the password is correct
 */
export async function verifyPassword(
  password: string,
  saltBase64: string,
  storedHash: string
): Promise<boolean> {
  try {
    const computedHash = await generateKeyVerificationHash(password, saltBase64);
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

// ---- Base64 helpers ----------------------------------------

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
