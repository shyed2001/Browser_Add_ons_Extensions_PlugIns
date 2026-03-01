# MindVault — System Design

**Version:** 2.0  
**Last Updated:** 2026-02-22  

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — CAPTURE LAYER (Phase 0–2)                                 │
│  Browser Extension (Chrome → Firefox → Edge → Safari)               │
│  TypeScript + Vite + IndexedDB (WebCrypto AES-256-GCM encrypted)    │
│                                                                      │
│   [Popup]      [Dashboard]    [Background SW]   [Content Scripts]   │
│   Save tabs    Full data UI   Auto-capture       (future)            │
└────────────────────────┬────────────────────────────────────────────┘
                         │ chrome.runtime.connectNative
                         │ + REST fallback http://127.0.0.1:47821
┌────────────────────────▼────────────────────────────────────────────┐
│  TIER 2 — LOCAL COMPANION DAEMON (Phase 2+)                         │
│  Go binary (Windows Service / macOS LaunchAgent / Linux systemd)    │
│  SQLite per Library — AES-256-GCM field-level encryption            │
│                                                                      │
│   REST API :47821  │  Native Messaging Host  │  Export Engine       │
└────────────────────────┬────────────────────────────────────────────┘
                         │ (optional, offline-first, manual backup)
┌────────────────────────▼────────────────────────────────────────────┐
│  TIER 3 — CLOUD SYNC API (Phase 4)                                  │
│  Node.js/TS + PostgreSQL + Redis                                    │
│  Client-side encrypted before upload — zero-knowledge server        │
└──────────┬──────────────────────────────────────────────────────────┘
           │
   ┌───────┴─────────────────────┐
   │                             │
┌──▼──────────┐        ┌────────▼──────────────┐
│  Web App    │        │  Desktop / Mobile       │
│  (Phase 4)  │        │  .NET MAUI (Phase 3+)  │
│  Vanilla TS │        │  Connects via companion │
└─────────────┘        └────────────────────────┘
```

---

## Extension Internal Design

### Component Breakdown

```
Extension Process Model (MV3):
┌──────────────────────────────────────────────────────────────────┐
│  Service Worker (background/index.ts)                            │
│  ├─ Initialises on install/startup                               │
│  ├─ history-capture.ts — chrome.history.onVisited listener       │
│  ├─ download-capture.ts — chrome.downloads.onCreated listener    │
│  └─ (future) bookmark-sync.ts                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Extension Page: popup.html                                      │
│  ├─ Reads tabs from chrome.tabs API                              │
│  ├─ Saves to IndexedDB via repositories                          │
│  └─ Shows RGYB repeat indicators                                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Extension Page: dashboard.html (options_page)                   │
│  ├─ Library switcher (header dropdown)                           │
│  ├─ Views: Tabs / Sessions / Bookmarks / History / Downloads     │
│  ├─ Settings: Encryption, Export, Import                         │
│  └─ Reads/writes via repository layer                            │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow — Tab Save

```
User clicks popup "Save All Tabs"
        │
        ▼
chrome.tabs.query({ currentWindow: true })
        │
        ▼
createSession({ libraryId, name, tabCount, ... })
        │ ── encrypt notes (if key active) ──────────────►  IndexedDB: sessions
        ▼
for each tab:
  saveTabWithDedup(sessionId, libraryId, url, title, favicon)
        │ ── URL dedup check: libraryId_url index ──────►  IndexedDB: saved_tabs
        │ ── repeatCount++ if exists ──────────────────►  RGYB update
        │ ── logAction(CREATE/UPDATE) ─────────────────►  IndexedDB: audit_log
        ▼
Popup renders RGYB indicators from repeatCount
```

### Data Flow — History Capture

```
Extension installs / starts
        │
        ▼
importAllHistory(libraryId)           ← one-time paginated import (batches of 500)
        │
chrome.history.onVisited              ← live capture for new visits
        │
        ▼
createHistoryEntry({ libraryId, url, title, visitTime, visitDate, ... })
        │ ── store in IndexedDB: history_entries ──────────────────────────────►
        │
        ▼
runRulesEngine(libraryId, rules)      ← marks entries as isImportant=true/false
```

### Encryption Flow

```
User enables encryption (Settings tab):
  password ──► PBKDF2-SHA256(600k iterations) ──► CryptoKey (in-memory only)
  generateSalt() ──► stored in Library record
  SHA-256(rawKey+salt) ──► stored in Library record (for unlock verification)

Write path (e.g. saveTabWithDedup):
  notes ──► encryptString(notes, key) ──► JSON.stringify(EncryptedField{ct,iv}) ──► IDB

Read path (e.g. getTabsByLibrary):
  raw string from IDB ──► decryptString(raw, key)
    ├─ if JSON with {ct, iv} ──► AES-GCM decrypt ──► plaintext
    └─ if plain string ──► return as-is (unencrypted or no key)
```

---

## Companion Daemon Design (Phase 2 — Step 11)

### SQLite Schema (mirrors IndexedDB)

Same entities as IndexedDB but stored in SQLite.  
Sensitive fields encrypted at application level (AES-256-GCM, same algorithm as extension).

### REST API (port 47821)

```
Base: http://127.0.0.1:47821/api/v1
Auth: HMAC-SHA256 request signing (shared secret)

GET  /health
GET  /libraries
POST /libraries/:id/unlock    → { sessionToken }
POST /sync/push               → { accepted, conflicts }
GET  /sync/pull/:libraryId    → full library data
GET  /export/:libraryId       → JSON/CSV/mvault
```

### Native Messaging

Extension connects via `chrome.runtime.connectNative('com.mindvault.companion')`.  
Messages are newline-delimited JSON with 4-byte length prefix (Chrome native messaging protocol).

---

## Security Design

| Concern | Mitigation |
|---------|-----------|
| Data at rest | AES-256-GCM field-level encryption, key never stored |
| Key compromise | PBKDF2 600k iterations slows brute-force; key only in memory |
| MITM (companion) | localhost only (127.0.0.1), HMAC-SHA256 request signing |
| XSS | escHtml() on all user data rendered in innerHTML |
| CSP | Extension default MV3 policy (no unsafe-eval, no unsafe-inline) |
| Backup files | Self-contained, password-protected, no key material in file |
| Downloads metadata | Metadata only — file content never captured |

---

## Scalability Considerations

| Scenario | Handling |
|----------|---------|
| Large history (100k+ entries) | Paginated import (500/batch); IDB index queries (no full scan) |
| Many libraries | Library switcher dropdown; each library has its own key |
| Export large dataset | Streaming JSON.stringify; chunked download for .mvault |
| Companion sync | Push/pull with conflict detection via audit log timestamps |