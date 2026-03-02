# MindVault — Entity Relationship Diagram

**Version:** 4.4
**Date:** 2026-03-01

---

## Entity Relationship Diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────┐
│                         LIBRARY                              │
│  PK id (UUID)                                                │
│     name                                                     │
│     description?                                             │
│     isEncrypted (bool)                                       │
│     passwordSalt?                                            │
│     createdAt, updatedAt                                     │
└───┬──────────┬───────────┬──────────┬──────────┬────────────┘
    │ 1        │ 1         │ 1        │ 1        │ 1
    │ *        │ *         │ *        │ *        │ *
    ▼          ▼           ▼          ▼          ▼
┌────────┐ ┌─────────┐ ┌────────┐ ┌───────┐ ┌──────────┐
│SESSION      │ │SAVED_TAB│ │HISTORY │ │DOWNLD │ │BOOKMARK  │
│id (PK)      │ │id (PK)  │ │id (PK) │ │id(PK) │ │id (PK)   │
│libId(F)     │ │libId(F) │ │libId(F)│ │libId  │ │libId (F) │
│name         │ │sesId(F?)│ │url     │ │(F)    │ │parentId? │◄─┐
│notes*       │ │url      │ │title?  │ │file   │ │title     │  │
│tabCount     │ │title    │ │visitTime│ │url   │ │url?      │  │self
│windowCount  │ │favicon? │ │domain  │ │mime?  │ │notes*    │  │ref
│tags[]       │ │savedAt  │ │isImpt  │ │size?  │ │colour?   │  │
│isFavorite   │ │notes*   │ └────────┘ │dlAt   │ │createdAt │──┘
│sourceBrowser│ │colour?  │            │state  │ │isFolder  │
│archived?    │ │tags[]   │            │notes* │ └──────────┘
│syncedToComp?│ └─────────┘            └───────┘
│created,upd  │
└─────────────┘
┌────────┐      │                            ┌──────────┐
│  TAG   │      │ FK: sessions (optional)    │AUDIT_LOG │
│id (PK) │      │                            │id (PK)   │
│libId(F)│      └────────────────────────    │libId (F) │
│name    │     SAVED_TAB.sessionId is null   │action    │
│colour? │     for unorganised tabs          │entityType│
│created │                                   │entityId  │
└────────┘                                   │timestamp │
                                             └──────────┘
```

**Legend:**
- `(PK)` = Primary Key
- `(F)` = Foreign Key (application-enforced, not DB-enforced)
- `*` = Encrypted when library password is set
- `?` = Nullable field
- `1` = "one" side of relationship
- `*` = "many" side of relationship

---

## Cardinality Table

| Parent | Child | Cardinality | Notes |
|--------|-------|-------------|-------|
| Library | Session | 1 : N | Each session belongs to exactly one library |
| Library | SavedTab | 1 : N | Tabs scoped to a library |
| Library | Bookmark | 1 : N | Bookmarks scoped to a library |
| Library | HistoryEntry | 1 : N | History scoped to a library |
| Library | Download | 1 : N | Downloads scoped to a library |
| Library | Tag | 1 : N | Tags scoped to a library |
| Library | AuditLog | 1 : N | Audit entries scoped to a library |
| Session | SavedTab | 1 : N (optional) | Tab.sessionId may be null |
| Bookmark | Bookmark | 1 : N (self) | Folder → children via parentId |

---

## Key Design Decisions

### No True Foreign Keys
IndexedDB has no referential integrity. Cascade deletes (e.g., delete session → delete its tabs) are implemented in the repository layer by:
1. Querying child records by `sessionId` index
2. Deleting them in a loop before deleting the parent

### Library Isolation
All stores have a `libraryId` field + index. Every query is scoped to a single library using `IDBKeyRange.only(libraryId)`. There is no cross-library data access.

### Bookmark Self-Reference
The `parentId` field on Bookmark points to another Bookmark in the same library. Root bookmarks have `parentId = null`. The tree is reconstructed in memory by grouping children by `parentId`.

### Encrypted Fields
Fields marked `*` store either:
- A plain string (when encryption is disabled)
- `JSON.stringify({ ct: "<base64>", iv: "<base64>" })` (when enabled)

The decrypt function detects which format is stored and handles both transparently.

---

## Companion SQLite ERD (mirror of extension IDB)

```
┌──────────────┐    1:N    ┌────────────────┐    1:N    ┌───────────────┐
│  libraries   │──────────►│   sessions     │──────────►│  saved_tabs   │
│  id (PK)     │           │  id (PK)       │           │  id (PK)      │
│  name        │           │  library_id(F) │           │  library_id(F)│
│  is_encrypted│           │  name          │           │  session_id(F)│
│  password_salt│          │  notes         │           │  url, title   │
│  created_at  │           │  source_browser│           │  fav_icon_url │
│  updated_at  │           │  archived(0/1) │           │  saved_at     │
└──────────────┘           │  created_at    │           │  notes        │
       │                   │  updated_at    │           │  colour       │
       │ 1:N               └────────────────┘           └───────────────┘
       ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  bookmarks   │  │   history    │  │  downloads   │
│  (same as    │  │  (same as    │  │  (same as    │
│   IDB)       │  │   IDB)       │  │   IDB)       │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Key differences: SQLite vs IndexedDB**
| Aspect | IndexedDB (extension) | SQLite (companion) |
|--------|-----------------------|--------------------|
| Archived | `boolean` | `INTEGER 0/1` |
| Session sync flag | `syncedToCompanion?: boolean` | N/A (IDB-only) |
| Notes encryption | Supported | Not encrypted (stored plaintext) |
| tabCount/windowCount | In IDB Session | Not in SQLite sessions table |
| INSERT conflict | JS-level check | `INSERT OR IGNORE` (v4.4.0) |

## Future Entities (Planned)

| Entity | Phase | Description |
|--------|-------|-------------|
| `syncLog` | 4 | Cloud sync operation log (per session push/pull) |
| `collections` | 4 | Cross-session curated collections |
