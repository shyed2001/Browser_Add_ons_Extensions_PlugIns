# MindVault — Object/Module Relationship Diagram

**Version:** 2.0  
**Date:** 2026-02-22  

---

## Module Dependency Graph

```
packages/shared/src/
  index.ts ──────────────────────────────────────────────────────┐
  types/index.ts      (Library, Session, SavedTab, etc.)         │
  crypto/index.ts     (deriveKey, encryptField, decryptField)     │
  utils/uuid.ts       (generateUUID)                             │
  validators/index.ts (isValidJsonBackup, isValidBookmark, etc.) │
                                                                  │
packages/extension/src/                          imports @mindvault/shared
  db/
    schema.ts         (STORE enum, DB_VERSION)    ◄── all repos
    index.ts          (openDB, closeDB, promisifyRequest)  ◄── all repos
    repositories/
      libraries.ts    ◄── session-key.ts, schema, db/index
      sessions.ts     ◄── session-key.ts, schema, db/index, audit-log
      saved-tabs.ts   ◄── session-key.ts, schema, db/index, audit-log
      bookmarks.ts    ◄── session-key.ts, schema, db/index, audit-log
      history.ts      ◄── schema, db/index
      downloads.ts    ◄── session-key.ts, schema, db/index
      tags.ts         ◄── schema, db/index
      audit-log.ts    ◄── schema, db/index (no circular: doesn't import other repos)

  services/
    session-key.ts    ◄── @mindvault/shared (crypto)
    import.ts         ◄── @mindvault/shared (validators), db/index, schema
    export.ts         ◄── repositories/* (all), @mindvault/shared
    mvault.ts         ◄── @mindvault/shared (crypto), services/import, services/export
    rules.ts          ◄── @mindvault/shared (types)

  background/
    index.ts          ◄── capture/history, capture/downloads, capture/bookmarks
    capture/
      history.ts      ◄── repositories/history, repositories/libraries
      downloads.ts    ◄── repositories/downloads, repositories/libraries
      bookmarks.ts    ◄── repositories/bookmarks, repositories/libraries

  popup/
    index.ts          ◄── repositories/saved-tabs, repositories/sessions,
                          repositories/libraries, services/rules

  dashboard/
    index.ts          ◄── repositories/* (all), services/* (all)
```

---

## Layering Rules (Enforced by Convention)

| Layer | May Import | Must NOT Import |
|-------|-----------|-----------------|
| `@mindvault/shared` | nothing | anything from extension |
| `db/schema.ts` | nothing | anything from extension |
| `db/index.ts` | db/schema | repositories, services, UI |
| `db/repositories/*` | db/index, db/schema, services/session-key, @mindvault/shared | other repositories, UI, background |
| `services/session-key.ts` | @mindvault/shared | repositories, UI |
| `services/import.ts` | @mindvault/shared, db/index, db/schema | UI, session-key |
| `services/export.ts` | repositories/*, @mindvault/shared | UI, session-key |
| `services/mvault.ts` | services/import, services/export, @mindvault/shared | UI |
| `services/rules.ts` | @mindvault/shared | anything else |
| `background/*` | repositories/*, services/* | UI (popup/dashboard) |
| `popup/index.ts` | repositories/*, services/* | background, dashboard |
| `dashboard/index.ts` | repositories/*, services/* | background, popup |

---

## Key Object Relationships

### `EncryptedField` ↔ Repository Fields
```
EncryptedField { ct: string, iv: string }
  ↕ JSON.stringify / JSON.parse
Stored as plain string in IndexedDB
  ↕ detected by services/session-key.ts → decryptString()
Plaintext string in application memory
```

### `JsonBackupSchema` ↔ Import/Export Services
```
export.ts → exportToJson(libraryId) → JsonBackupSchema → File download
import.ts ← parseJsonBackup(File) ← JsonBackupSchema ← File.text()
             importFromJson(schema) → IndexedDB stores
```

### `MvaultFile` ↔ .mvault Backup
```
mvault.ts → exportMvault(libraryId, password)
  → exportToJson() → JSON string
  → PBKDF2(password, salt) → AES-256-GCM key
  → encryptField(json, key) → { ct, iv }
  → MvaultFile { header: { version, salt, iv, libraryId, createdAt }, body: base64(ct) }
  → File download

mvault.ts ← importMvault(file, password)
  ← parse MvaultFile
  ← PBKDF2(password, header.salt) → key
  ← decryptField(body, key) → JSON string
  ← importFromJson(parsed schema)
```

### `session-key.ts` ↔ Repositories
```
sessionKeyMap: Map<libraryId, CryptoKey>  (module-level, memory-only)

Repository.createX(partial):
  key = getSessionKey(partial.libraryId)      // null if not unlocked
  storedNotes = await encryptString(notes, key)  // passthrough if no key
  IDB.put({ ...entity, notes: storedNotes })

Repository.getX(id):
  raw = IDB.get(id)
  return decryptX(raw)    // decryptString detects JSON vs plaintext
```

---

## Circular Dependency Prevention

The following pairs MUST NOT import each other:
- `session-key.ts` ↔ any repository (would create cycle via db/index)
- `audit-log.ts` ↔ any other repository (fire-and-forget only)
- `dashboard/index.ts` ↔ any service (one-way: dashboard imports services)
- `export.ts` ↔ `import.ts` (independent services)
