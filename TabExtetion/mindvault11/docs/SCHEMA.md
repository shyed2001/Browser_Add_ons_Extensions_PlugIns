# MindVault — Type & Schema Reference

**Version:** 2.0  
**Date:** 2026-02-22  
**Source:** `packages/shared/src/types/index.ts`  

---

## 1. Core Entity Types

### Library
```typescript
interface Library {
  id: string;           // UUID
  name: string;         // Display name
  description?: string; // Optional description
  createdAt: number;    // Unix ms timestamp
  updatedAt: number;    // Unix ms timestamp
  isEncrypted: boolean; // Whether field encryption is enabled
  passwordSalt?: string;// Base64 PBKDF2 salt (null if not encrypted)
}
```

### Session
```typescript
interface Session {
  id: string;       // UUID
  libraryId: string;// FK → Library.id
  name: string;     // Session display name
  notes: string;    // Free text (encrypted if library has password)
  createdAt: number;
  updatedAt: number;
}
```

### SavedTab
```typescript
interface SavedTab {
  id: string;
  libraryId: string;
  sessionId: string | null; // null = unorganised
  url: string;
  title: string;
  favIconUrl?: string;
  savedAt: number;
  notes: string;            // Encrypted if library has password
  colour: RGYBColour;       // 'R' | 'G' | 'Y' | 'B' | null
  tags: string[];           // Array of Tag IDs
}
```

### Bookmark
```typescript
interface Bookmark {
  id: string;
  libraryId: string;
  parentId: string | null;  // null = root level
  title: string;
  url?: string;             // undefined for folders
  notes: string;            // Encrypted if library has password
  colour: RGYBColour;
  createdAt: number;
  isFolder: boolean;
}
```

### HistoryEntry
```typescript
interface HistoryEntry {
  id: string;
  libraryId: string;
  url: string;
  title?: string;
  visitTime: number;
  domain: string;     // Extracted for filtering (e.g. "github.com")
  isImportant: boolean;
}
```

### Download
```typescript
interface Download {
  id: string;
  libraryId: string;
  filename: string;
  url: string;
  mimeType?: string;
  fileSize?: number;
  downloadedAt: number;
  state: DownloadState;
  notes: string;          // Encrypted if library has password
}
```

### Tag
```typescript
interface Tag {
  id: string;
  libraryId: string;
  name: string;
  colour?: string;    // CSS hex colour
  createdAt: number;
}
```

### AuditLogEntry
```typescript
interface AuditLogEntry {
  id: string;
  libraryId: string;
  action: AuditAction;         // 'CREATE' | 'UPDATE' | 'DELETE'
  entityType: AuditEntityType; // 'tab' | 'session' | 'bookmark' | ...
  entityId: string;
  timestamp: number;
}
```

---

## 2. Scalar / Union Types

```typescript
// RGYB colour importance system
type RGYBColour = 'R' | 'G' | 'Y' | 'B' | null;

// Download lifecycle state
type DownloadState = 'in_progress' | 'complete' | 'error';

// Audit log action
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

// Audit entity type
type AuditEntityType = 'tab' | 'session' | 'bookmark' | 'history' | 'download' | 'tag';
```

---

## 3. EncryptedField

Returned by `encryptField()` from `@mindvault/shared/crypto`:

```typescript
interface EncryptedField {
  ct: string;  // Base64-encoded AES-GCM ciphertext
  iv: string;  // Base64-encoded 12-byte initialisation vector
}
```

**Storage pattern:** Encrypted fields are stored as `JSON.stringify(EncryptedField)` in the IndexedDB string fields (notes, description). On read, `decryptString()` detects the JSON format and decrypts; plain strings are returned as-is (backward compatibility).

---

## 4. JsonBackupSchema

The unencrypted JSON export format:

```typescript
interface JsonBackupSchema {
  library: Library;
  sessions: Session[];
  tabs: SavedTab[];
  bookmarks?: Bookmark[];
  tags?: Tag[];
  // downloads and history are NOT included in JSON export (privacy)
}
```

**File extension:** `.json`  
**Validator:** `isValidJsonBackup(data: unknown): data is JsonBackupSchema`

---

## 5. MvaultFile / MvaultHeader

The encrypted `.mvault` backup format:

```typescript
interface MvaultHeader {
  version: 1;          // Format version (always 1)
  salt: string;        // Base64-encoded 16-byte PBKDF2 salt
  iv: string;          // Base64-encoded 12-byte AES-GCM IV
  libraryId: string;   // Source library ID
  createdAt: number;   // Export timestamp (Unix ms)
}

interface MvaultFile {
  header: MvaultHeader;
  body: string;        // Base64-encoded AES-256-GCM ciphertext of JSON backup
}
```

**File extension:** `.mvault`  
**Type guard:** `isMvaultFile(v: unknown): v is MvaultFile`

---

## 6. STORE Enum

```typescript
// packages/extension/src/db/schema.ts
enum STORE {
  LIBRARIES      = 'libraries',
  SESSIONS       = 'sessions',
  SAVED_TABS     = 'savedTabs',
  BOOKMARKS      = 'bookmarks',
  HISTORY        = 'historyEntries',
  DOWNLOADS      = 'downloads',
  TAGS           = 'tags',
  AUDIT_LOG      = 'auditLog',
}

const DB_NAME    = 'mindvault-db';
const DB_VERSION = 4;
```

---

## 7. Validator Functions

```typescript
// @mindvault/shared
function isValidJsonBackup(data: unknown): data is JsonBackupSchema;
function isValidBookmark(data: unknown): data is Bookmark;
function isValidTag(data: unknown): data is Tag;
```

---

## 8. ImportResult

Returned by `importFromJson()`:

```typescript
interface ImportResult {
  success: boolean;
  libraryId: string;
  counts: {
    sessions: number;
    tabs: number;
    bookmarks: number;
    tags: number;
  };
  errors: string[];   // Per-entity error messages for failed writes
}
```

---

## 9. Crypto API Surface

```typescript
// packages/shared/src/crypto/index.ts
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
async function encryptField(plaintext: string, key: CryptoKey): Promise<EncryptedField>;
async function decryptField(field: EncryptedField, key: CryptoKey): Promise<string>;

// packages/extension/src/services/session-key.ts
function setSessionKey(libraryId: string, key: CryptoKey): void;
function clearSessionKey(libraryId: string): void;
function getSessionKey(libraryId: string): CryptoKey | null;
function clearAllSessionKeys(): void;

async function encryptString(text: string, key: CryptoKey | null): Promise<string>;
async function decryptString(stored: string, key: CryptoKey | null): Promise<string>;
```

**Crypto parameters:**
- Algorithm: AES-256-GCM
- Key derivation: PBKDF2-SHA256, 600,000 iterations, 16-byte salt
- IV: 12 bytes, random per encryption
- All via `globalThis.crypto.subtle` (WebCrypto API)
