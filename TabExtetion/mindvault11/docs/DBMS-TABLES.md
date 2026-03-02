# MindVault — DBMS Tables Reference

**Version:** 4.4
**Date:** 2026-03-01
**Database:** IndexedDB (`mindvault-db`, version 4) + Companion SQLite (`mindvault.db`)

---

## IndexedDB Limitations

Before reading the tables, note key IndexedDB constraints:

- **No foreign keys** — referential integrity enforced by application code only
- **No compound indexes with null/boolean** — queries on nullable or boolean fields use in-memory `.filter()` after a full-store read
- **No SQL** — all queries are key-range scans or full-store reads
- **Compound keys not supported for null values** — `getChildBookmarks(lib, null)` uses memory filter
- **No transactions across multiple stores in one atomic unit** — multi-store writes use sequential transactions

---

## Store: `libraries`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| name | string | No | No | Display name |
| description | string | Yes | No | Optional description |
| createdAt | number (ms) | No | No | Unix timestamp |
| updatedAt | number (ms) | No | No | Unix timestamp |
| isEncrypted | boolean | No | No | Whether field encryption is enabled |
| passwordSalt | string (base64) | Yes | No | 16-byte PBKDF2 salt (null if not encrypted) |

**Indexes:** none

**Example:**
```json
{
  "id": "lib-abc123",
  "name": "Personal",
  "description": "My main library",
  "createdAt": 1708560000000,
  "updatedAt": 1708560000000,
  "isEncrypted": true,
  "passwordSalt": "dGVzdHNhbHQxMjM0NTY="
}
```

---

## Store: `sessions`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| name | string | No | No | Session display name |
| notes | string | Yes | Yes* | Free text notes |
| tabCount | number | No | No | Number of tabs in session |
| windowCount | number | No | No | Number of browser windows |
| tags | string[] | No | No | Array of tag IDs |
| isFavorite | boolean | No | No | User-starred flag |
| sourceBrowser | string | Yes | No | 'Chrome' \| 'Firefox' \| 'Edge' \| '' |
| archived | boolean | Yes | No | Soft-delete: true = hidden from default view |
| createdAt | number (ms) | No | No | Creation timestamp |
| updatedAt | number (ms) | No | No | Last update timestamp |
| syncedToCompanion | boolean | Yes | No | **v4.4.0**: true = pushed to SQLite; skipped on next sync pass |

**Indexes:** `libraryId`

*Stored as `JSON.stringify({ct, iv})` when encrypted; plaintext string otherwise.

---

## Store: `savedTabs`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| sessionId | string | Yes | No | FK → sessions.id (null = unorganised) |
| url | string | No | No | Full page URL |
| title | string | No | No | Page title |
| favIconUrl | string | Yes | No | Favicon URL |
| savedAt | number (ms) | No | No | When tab was saved |
| notes | string | Yes | Yes* | User notes |
| colour | string | Yes | No | 'R', 'G', 'Y', 'B' or null |
| tags | string[] | No | No | Array of tag IDs |

**Indexes:** `libraryId`, `sessionId`, `colour`

*Encrypted field — see note in sessions store above.

---

## Store: `bookmarks`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| parentId | string | Yes | No | FK → bookmarks.id (null = root) |
| title | string | No | No | Bookmark/folder title |
| url | string | Yes | No | URL (null for folders) |
| notes | string | Yes | Yes* | User notes |
| colour | string | Yes | No | 'R', 'G', 'Y', 'B' or null |
| createdAt | number (ms) | No | No | Creation timestamp |
| isFolder | boolean | No | No | true if this is a folder node |

**Indexes:** `libraryId`, `parentId`

**Note:** `getChildBookmarks(libraryId, null)` cannot use compound index with null — filters in memory.

---

## Store: `historyEntries`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| url | string | No | No | Visited URL |
| title | string | Yes | No | Page title at visit time |
| visitTime | number (ms) | No | No | When the page was visited |
| domain | string | No | No | Extracted domain for filtering |
| isImportant | boolean | No | No | User-starred flag |

**Indexes:** `libraryId`, `domain`

**Note:** `isImportant === true` filter applied in memory (boolean compound index limitation).

---

## Store: `downloads`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| filename | string | No | No | Downloaded file name |
| url | string | No | No | Source URL of download |
| mimeType | string | Yes | No | MIME type (e.g. application/pdf) |
| fileSize | number | Yes | No | File size in bytes |
| downloadedAt | number (ms) | No | No | Download start timestamp |
| state | string | No | No | 'in_progress' \| 'complete' \| 'error' |
| notes | string | Yes | Yes* | User notes |

**Indexes:** `libraryId`, `mimeType`

---

## Store: `tags`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| name | string | No | No | Tag display name |
| colour | string | Yes | No | Optional hex colour |
| createdAt | number (ms) | No | No | Creation timestamp |

**Indexes:** `libraryId`

---

## Store: `auditLog`

**Key path:** `id` | **Auto-increment:** No

| Field | Type | Nullable | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| id | string (UUID) | No | No | Primary key |
| libraryId | string | No | No | FK → libraries.id |
| action | string | No | No | 'CREATE' \| 'UPDATE' \| 'DELETE' |
| entityType | string | No | No | 'tab' \| 'session' \| 'bookmark' \| 'download' \| 'history' \| 'tag' |
| entityId | string | No | No | ID of the affected entity |
| timestamp | number (ms) | No | No | When the action occurred |

**Indexes:** `libraryId`

**Note:** Audit log writes are fire-and-forget (`void logAction(...)`). Errors are silently swallowed to never block the main data operation.

---

## IndexedDB Schema Version History

| Version | Changes |
|---------|---------|
| 1 | Initial schema: libraries, sessions, savedTabs |
| 2 | Added bookmarks, tags |
| 3 | Added historyEntries, downloads, auditLog |
| 4 | Added compound indexes; passwordSalt + isEncrypted on libraries |

---

## Companion SQLite Schema (`mindvault.db`)

**Engine:** `modernc.org/sqlite` (pure Go, no CGo) | **File:** `~/.mindvault/mindvault.db`
**Conflict strategy:** `INSERT OR IGNORE` on sessions + tabs (idempotent re-push, v4.4.0)

### Table: `libraries`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | TEXT PK | No | UUID from extension IDB |
| name | TEXT | No | Library display name |
| is_encrypted | INTEGER | No | 0=false, 1=true |
| password_salt | TEXT | Yes | PBKDF2 salt (base64) |
| created_at | INTEGER | No | Unix ms |
| updated_at | INTEGER | No | Unix ms |

### Table: `sessions`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | TEXT PK | No | UUID from extension IDB |
| library_id | TEXT FK | No | → libraries.id |
| name | TEXT | No | Session name |
| notes | TEXT | Yes | Free text (not encrypted in SQLite) |
| created_at | INTEGER | No | Unix ms |
| updated_at | INTEGER | No | Unix ms |
| source_browser | TEXT | Yes | 'Chrome', 'Firefox', etc. (migration 002) |
| archived | INTEGER | No | 0=active, 1=archived (migration 002) |

### Table: `saved_tabs`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | TEXT PK | No | UUID from extension IDB |
| library_id | TEXT FK | No | → libraries.id |
| session_id | TEXT FK | Yes | → sessions.id (null = unorganised) |
| url | TEXT | No | Full page URL |
| title | TEXT | No | Page title |
| fav_icon_url | TEXT | Yes | Favicon URL |
| saved_at | INTEGER | No | Unix ms |
| notes | TEXT | Yes | User notes (plaintext) |
| colour | TEXT | Yes | 'R', 'G', 'Y', 'B' or NULL |

### SQLite Migration History
| Migration | File | Changes |
|-----------|------|---------|
| 001 | 001_initial.sql | All tables + indexes |
| 002 | 002_source_browser.sql | `source_browser` + `archived` on sessions |
