# MindVault — Architecture Document

**Version:** 4.4
**Date:** 2026-03-01

---

## 1. Architectural Overview

MindVault follows a **layered, offline-first** architecture with zero cloud dependencies.

```
┌─────────────────────────────────────────────────────┐
│                  Browser Extension (MV3)             │
│  ┌──────────┐  ┌──────────────────────────────────┐ │
│  │  Popup   │  │         Dashboard (SPA)           │ │
│  │  (Quick  │  │  Sessions │ History │ Downloads   │ │
│  │  Save)   │  │  Bookmarks│ Settings│ Export/Import│ │
│  └────┬─────┘  └─────────────────────┬────────────┘ │
│       │                              │              │
│  ┌────▼──────────────────────────────▼────────────┐ │
│  │            Service Layer                        │ │
│  │  import.ts │ export.ts │ mvault.ts │ rules.ts   │ │
│  │            session-key.ts                       │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │                              │
│  ┌────────────────────▼────────────────────────────┐ │
│  │           Repository Layer (IndexedDB)           │ │
│  │  libraries │ sessions │ saved-tabs │ bookmarks  │ │
│  │  history   │ downloads│ tags       │ audit-log  │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │                              │
│  ┌────────────────────▼────────────────────────────┐ │
│  │         Background Service Worker               │ │
│  │  capture/history │ capture/downloads            │ │
│  │  capture/bookmarks │ nativeMessaging bridge     │ │
│  └────────────────────┬────────────────────────────┘ │
└───────────────────────┼─────────────────────────────┘
                        │ Native Messaging (JSON)
┌───────────────────────▼─────────────────────────────┐
│           Go Companion Daemon (optional)             │
│  REST :47821 │ SQLite mirror │ Full-text search      │
│  cmd/mvaultd │ internal/api  │ internal/db           │
└───────────────────────┬─────────────────────────────┘
                        │ REST :47821 (localhost)
┌───────────────────────▼─────────────────────────────┐
│       .NET MAUI Desktop App (Phase 3)                │
│  Pages/ │ ViewModels/ │ Services/CompanionApiClient  │
│  Libraries │ Sessions │ Tabs │ Search                │
└─────────────────────────────────────────────────────┘
```

---

## 2. Extension Internal Architecture

### 2.1 Package Structure
```
packages/
  shared/          @mindvault/shared — types, crypto, validators
  extension/       @mindvault/extension — browser extension
```

### 2.2 Layering Rules
1. **Presentation** (popup/, dashboard/) may import from Service and Repository
2. **Service** (services/) may import from Repository; never from Presentation
3. **Repository** (db/repositories/) imports from db/ and services/session-key only
4. **Background** (background/) may import from Repository and services/
5. **Shared** package has no internal dependencies — only exports

### 2.3 Data Flow — Tab Save
```
User clicks "Save Tab"
  → popup/index.ts: chrome.tabs.query({active: true})
  → services/rules.ts: applyRules(tab) → auto-tag/colour
  → db/repositories/saved-tabs.ts: createSavedTab(partial)
    → encryptString(notes, sessionKey)   [if password set]
    → IDBObjectStore.put(tab)
    → logAction({action: 'CREATE', entityType: 'tab'})  [fire & forget]
  → popup re-renders count
```

### 2.4 Data Flow — Offline Sync (v4.4.0 ISSUE-011 fix)
```
Extension service worker wakes (browser start / install / update)
  → onStartup() in background/index.ts
  → await bootstrapCompanion(library)   ← ensures library exists in SQLite
  → void syncAllUnpushedSessions()      ← ISSUE-011 fix
    → getAllLibraries()                  ← IDB: get all libraries
    → for each lib:
        getSessionsByLibrary(lib.id)     ← IDB: all sessions
        .filter(s => !s.syncedToCompanion)  ← skip already-pushed
        for each unsynced session:
          pushSession(lib.id, payload)   ← POST /libraries/{id}/sessions (INSERT OR IGNORE)
          pushTabs(lib.id, tabs[])       ← POST /libraries/{id}/tabs (INSERT OR IGNORE)
          markSessionSynced(session.id)  ← IDB: set syncedToCompanion=true
    → silent on all errors (companion optional)
```

### 2.5 Data Flow — History Capture
```
chrome.history.onVisited fires
  → background/capture/history.ts: handler(historyItem)
  → getActiveLibraryId()
  → createHistoryEntry(partial)
  → IDBObjectStore.put(entry)
```

---

## 3. Data Architecture

### 3.1 IndexedDB Schema (v4)
| Store | Key | Indexes | Description |
|-------|-----|---------|-------------|
| libraries | id | — | Library roots |
| sessions | id | libraryId | Tab groups |
| savedTabs | id | libraryId, sessionId, colour | Saved tabs |
| bookmarks | id | libraryId, parentId | Bookmarks |
| historyEntries | id | libraryId, domain | History |
| downloads | id | libraryId, mimeType | Downloads |
| tags | id | libraryId | User-defined tags |
| auditLog | id | libraryId | Audit trail |

### 3.2 Encryption Architecture
```
Password (user input)
  → PBKDF2-SHA256 (600,000 iter, 16-byte salt)
  → AES-256-GCM CryptoKey
  → stored in memory as sessionKeyMap[libraryId]

Field encryption:
  plaintext → AES-256-GCM(key, 12-byte IV) → { ct: base64, iv: base64 }
  → JSON.stringify → stored in DB as string

Field decryption:
  stored string → JSON.parse (if { ct, iv }) → AES-GCM decrypt → plaintext
  plain string → returned as-is (backward compat)
```

### 3.3 .mvault Backup Format
```json
{
  "header": {
    "version": 1,
    "salt": "<base64-16-bytes>",
    "iv": "<base64-12-bytes>",
    "libraryId": "<uuid>",
    "createdAt": 1234567890
  },
  "body": "<base64(AES-GCM(JSON backup))>"
}
```

---

## 4. Background Service Worker Architecture

```
background/index.ts (entry point)
  ├── capture/history.ts     — chrome.history.onVisited listener
  ├── capture/downloads.ts   — chrome.downloads.onChanged listener
  ├── capture/bookmarks.ts   — chrome.bookmarks.onCreated listener
  └── nativeMessaging.ts     — chrome.runtime.connectNative bridge
```

Service worker lifecycle:
- MV3 service workers are ephemeral — they wake on events and sleep when idle
- All state is persisted in IndexedDB; no in-memory state in service worker
- Session keys are NOT available in service worker (encryption is UI-side only)

---

## 5. Companion Daemon Architecture

```
cmd/mvaultd/main.go          — entry point, signal handling, migration on boot
internal/
  api/
    server.go                — net/http mux, CORS, no-cache, auth middleware, all routes
    handlers/handlers.go     — ALL HTTP handlers in one file (~550 lines)
    ui/                      — embedded web UI (index.html, style.css, app.js ~1700 lines, sw.js)
  db/
    sqlite.go                — ALL DB CRUD + migrations helper (~450 lines, modernc.org/sqlite)
    migrations/              — 001_initial.sql, 002_source_browser.sql
  auth/
    token.go                 — shared secret generation + file persistence
  messaging/
    native.go                — native messaging stdin/stdout protocol (stdin→handler→stdout)
```

### REST API Map (v4.4.0)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /token | No | Fetch auth token (localhost only) |
| GET | /health | No | Daemon health check |
| GET | /libraries | Yes | List all libraries |
| POST | /libraries | Yes | Create library |
| GET | /libraries/{id} | Yes | Get library by id |
| PATCH | /libraries/{id} | Yes | Rename library |
| DELETE | /libraries/{id} | Yes | Delete library + all data |
| GET | /libraries/{id}/sessions | Yes | List sessions in library |
| POST | /libraries/{id}/sessions | Yes | Create/push session (`INSERT OR IGNORE`) |
| PATCH | /libraries/{id}/sessions/{sid} | Yes | Update session (name, notes, archived) |
| DELETE | /libraries/{id}/sessions/{sid} | Yes | Delete session (+ tabs if `?deleteTabs=true`) |
| GET | /libraries/{id}/tabs | Yes | List tabs in library |
| POST | /libraries/{id}/tabs | Yes | Create/push tab (`INSERT OR IGNORE`) |
| PATCH | /tabs/{id} | Yes | Update tab notes |
| DELETE | /tabs/{id} | Yes | Delete tab by id |
| GET | /libraries/{id}/bookmarks | Yes | List bookmarks |
| POST | /libraries/{id}/bookmarks | Yes | Create bookmark |
| GET | /libraries/{id}/history | Yes | List history |
| POST | /libraries/{id}/history | Yes | Create history entry |
| GET | /libraries/{id}/downloads | Yes | List downloads |
| POST | /libraries/{id}/downloads | Yes | Create download record |
| GET | /sessions | Yes | All sessions (cross-library) |
| GET | /tabs | Yes | All tabs (cross-library, LEFT JOIN sessions+libraries) |
| GET | /search | Yes | Full-text search (`?q=&libId=`) |

Auth: `X-MindVault-Token: <token>` header on all `Yes` endpoints.
Token: generated at first run, stored in `~/.mindvault/token`.

---

## 6. Desktop App Architecture (Phase 3)

```
desktop/
  MindVault.Desktop.csproj    — .NET 8 MAUI project
  MauiProgram.cs              — DI container, HttpClient registration
  AppShell.xaml               — Shell navigation (tabbed sidebar)
  Pages/
    LibrariesPage.xaml/.cs    — Library list (loads on startup)
    SessionsPage.xaml/.cs     — Sessions within selected library
    TabsPage.xaml/.cs         — Tabs with search support
    SettingsPage.xaml/.cs     — Companion URL, token config
  ViewModels/
    LibrariesViewModel.cs     — ObservableCollection<Library>
    SessionsViewModel.cs      — ObservableCollection<Session>
    TabsViewModel.cs          — ObservableCollection<Tab> + search
    SettingsViewModel.cs      — Companion health check
  Services/
    CompanionApiClient.cs     — HttpClient wrapper (GET /libraries, /sessions, /tabs, /search)
  Models/
    Library.cs │ Session.cs │ Tab.cs │ SearchResult.cs │ HealthResponse.cs
```

MVVM Data Flow:
```
Page (XAML binding) ←→ ViewModel ([ObservableProperty]) → CompanionApiClient → companion REST
```

Key patterns:
- `[ObservableProperty]` / `[RelayCommand]` from CommunityToolkit.Mvvm 8.3.2
- All Tab references aliased as `MvTab` to avoid ambiguity with `Microsoft.Maui.Controls.Tab`
- `CompanionApiClient` registered as singleton via `MauiProgram.cs` DI
- `HttpClient` base address: `http://127.0.0.1:47821`

---

## 7. Build Architecture

```
Vite + @samrum/vite-plugin-web-extension
  Input:  manifest.json (declares all entry points)
  Output: dist/
    manifest.json           — processed manifest
    serviceWorker.js        — bundled background SW
    src/popup/popup.html    — popup entry
    src/dashboard/dashboard.html — dashboard entry
    images/                 — icon assets
```

Build modes:
- `vite build` — production build (minified)
- `vite build --watch` — dev mode (incremental rebuild)
- `vitest run` — unit tests (fake-indexeddb + happy-dom)

---

## 8. Security Architecture

| Threat | Mitigation |
|--------|-----------|
| XSS in popup/dashboard | No `innerHTML`; all DOM writes via `textContent` or typed DOM APIs |
| Key extraction | Session keys in JS memory only; never written to storage |
| Backup password exposure | Backup password separate from library password; PBKDF2 makes brute-force costly |
| Native messaging abuse | Token validation on every request; token generated per-install |
| Content Security Policy | MV3 enforces strict CSP; no eval, no remote scripts |

---

## 9. Testing Architecture

```
vitest (unit, per-package)
  packages/extension/
    *.test.ts — uses fake-indexeddb + happy-dom
    test-setup.ts — resets IDB factory per test, closes DB connections
  packages/shared/
    *.test.ts — pure TypeScript, Node environment

Coverage targets:
  - Repositories: 100% (all CRUD paths)
  - Crypto services: 100% (encrypt/decrypt/derive)
  - Validators: 100%
  - Background capture: 80%+
```

---

## 10. Deployment Architecture

### Chrome / Edge Extension (Phase 2 — complete)
1. `vite build` → `dist/` folder (39 modules, 32 kB)
2. Load unpacked in `chrome://extensions` or `edge://extensions` (dev)
3. Enable Developer mode → "Load unpacked" → select `packages/extension/dist/`
4. Package as `.crx` for distribution (future)

### Companion Daemon (Phase 2 — complete)
1. `go build -o bin/mvaultd.exe ./cmd/mvaultd` (from `companion/`)
2. Run `C:\Temp\install-mv-companion.ps1` — copies binary, writes manifest JSON, sets registry keys
3. Daemon starts automatically; verify at `http://127.0.0.1:47821/health`
4. Registry keys set: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion`
   and `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.mindvault.companion`

### MAUI Desktop App (Phase 3 — in progress)
1. `dotnet restore desktop/MindVault.Desktop.csproj`
2. `dotnet build desktop/MindVault.Desktop.csproj -f net8.0-windows10.0.19041.0`
3. Run: `dotnet run --project desktop/MindVault.Desktop.csproj -f net8.0-windows10.0.19041.0`
4. Requires companion daemon running on port 47821
5. Helper bat: `C:\Temp\build-maui.bat`
