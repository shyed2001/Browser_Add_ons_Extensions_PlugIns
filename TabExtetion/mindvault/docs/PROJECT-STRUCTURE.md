# MindVault — Project Structure
_Last updated: 2026-02-26 (Phase 3 Step 4 — companion web UI)_

```
mindvault/                              ← pnpm monorepo root
│
├── packages/
│   ├── shared/                         @mindvault/shared
│   │   └── src/
│   │       ├── types/
│   │       │   ├── entities.ts         Library, Session, SavedTab, Bookmark,
│   │       │   │                       HistoryEntry, Download, Tag, AuditLogEntry
│   │       │   └── legacy.ts           LegacyTabRecord (v1.1 schema)
│   │       ├── utils/
│   │       │   ├── rgyb.ts             RGYB repeat-indicator logic (unit tested)
│   │       │   ├── uuid.ts             generateUUID() wrapper
│   │       │   ├── dates.ts            locale string → unix ms parser
│   │       │   └── validation.ts       Type guards + JsonBackupSchema
│   │       ├── crypto/
│   │       │   ├── encryption.ts       AES-256-GCM (encryptField/decryptField)
│   │       │   └── key-derivation.ts   PBKDF2-SHA256 (deriveKey/generateSalt)
│   │       └── index.ts                Public re-exports
│   │
│   └── extension/                      @mindvault/extension (Chrome/Edge MV3)
│       ├── src/
│       │   ├── background/
│       │   │   ├── index.ts            Service worker entry point
│       │   │   ├── history-capture.ts  Full history import + live capture
│       │   │   └── download-capture.ts Metadata-only download capture
│       │   ├── popup/
│       │   │   ├── index.ts            Save tabs + RGYB indicator
│       │   │   ├── popup.html
│       │   │   └── popup.css
│       │   ├── dashboard/
│       │   │   ├── index.ts            Dashboard SPA (Sessions/Tabs/Bookmarks/
│       │   │   │                       History/Downloads/Settings views)
│       │   │   ├── dashboard.html      Options page (open_in_tab=true)
│       │   │   └── dashboard.css
│       │   ├── db/
│       │   │   ├── index.ts            openDB() + promisifyRequest() + closeDB()
│       │   │   ├── schema.ts           STORE enum + IndexedDB v2 schema
│       │   │   ├── migrations/
│       │   │   │   ├── v1-to-v2.ts     v1.1 chrome.storage → IndexedDB
│       │   │   │   └── runner.ts       Migration orchestrator
│       │   │   └── repositories/
│       │   │       ├── libraries.ts    CRUD (getDefaultLibrary uses getAll+filter)
│       │   │       ├── sessions.ts     CRUD (notes encrypted)
│       │   │       ├── saved-tabs.ts   CRUD + URL-dedup (notes encrypted)
│       │   │       ├── bookmarks.ts    CRUD + tree (description encrypted)
│       │   │       ├── history.ts      CRUD + star/important flags
│       │   │       ├── downloads.ts    CRUD (notes encrypted)
│       │   │       ├── tags.ts         CRUD + usage count
│       │   │       └── audit-log.ts    Append-only (fire-and-forget)
│       │   ├── services/
│       │   │   ├── export.ts           CSV/JSON/HTML/Netscape exporters
│       │   │   ├── import.ts           JSON backup parser + IDB writer
│       │   │   ├── mvault.ts           .mvault encrypted backup export/import
│       │   │   ├── rules-engine.ts     History "important" rules evaluator
│       │   │   └── session-key.ts      In-memory CryptoKey + encrypt/decrypt
│       │   ├── polyfill.ts             webextension-polyfill side-effect import
│       │   └── test-setup.ts           Vitest IDBFactory reset helper
│       ├── dist/                       ← BUILD OUTPUT — load this in Chrome/Edge
│       │   ├── manifest.json
│       │   ├── serviceWorker.js
│       │   ├── src/
│       │   │   ├── popup/popup.html
│       │   │   └── dashboard/dashboard.html
│       │   ├── assets/                 Hashed JS/CSS bundles
│       │   └── images/                 icon16/48/128.png
│       ├── manifest.json               MV3 source manifest (options_ui.page)
│       ├── manifest-firefox.json       MV2 Firefox manifest (browser_action)
│       ├── vite.config.ts              Build + Vitest config
│       ├── tsconfig.json
│       └── package.json
│
├── companion/                          Go daemon — mvaultd.exe (REST :47821)
│   ├── cmd/
│   │   └── mvaultd/
│   │       └── main.go                 Entry point (port, DB path, token)
│   ├── internal/
│   │   ├── api/
│   │   │   ├── server.go               Chi router + /ui/ file server (Go embed)
│   │   │   ├── api_test.go             10 httptest E2E tests
│   │   │   └── ui/                     Embedded web dashboard (baked into binary)
│   │   │       ├── index.html          SPA shell (sidebar nav, panels)
│   │   │       ├── style.css           Dark theme, responsive
│   │   │       ├── app.js              Vanilla JS SPA (Libraries→Sessions→Tabs,
│   │   │       │                       Search, Settings — 360 lines)
│   │   │       └── manifest.json       PWA manifest (installable as desktop app)
│   │   ├── db/
│   │   │   ├── sqlite.go               SQLite (modernc.org/sqlite) CRUD + Migrate
│   │   │   └── db_test.go              8 DB-level tests
│   │   └── config/
│   │       └── config.go               Token + DB path resolution
│   ├── bin/                            ← built binary (gitignored)
│   │   └── mvaultd.exe
│   ├── go.mod
│   └── go.sum
│
├── desktop/                            .NET MAUI desktop app (Phase 3)
│   ├── Models/
│   │   └── ApiModels.cs                Library, Session, Tab, SearchResult DTOs
│   ├── Services/
│   │   ├── CompanionApiClient.cs       Typed HttpClient (REST :47821)
│   │   └── TokenStore.cs              Token from %LOCALAPPDATA%\MindVault\token
│   ├── ViewModels/
│   │   ├── LibrariesViewModel.cs       ObservableObject + LoadCommand
│   │   ├── SessionsViewModel.cs        LoadCommand(libraryId)
│   │   └── TabsViewModel.cs            LoadCommand + SearchCommand + FilteredTabs
│   ├── Pages/
│   │   ├── LibrariesPage.xaml/.cs      Shell root; CollectionView of libraries
│   │   ├── SessionsPage.xaml/.cs       QueryProperty(libraryId)
│   │   ├── TabsPage.xaml/.cs           Search bar + RGYB BoxView indicator
│   │   └── SettingsPage.xaml/.cs       Companion status + token path
│   ├── Converters/
│   │   └── ValueConverters.cs          InvertedBool, StringToBool, IsNotNull,
│   │                                   ColourToColor (RGYB → hex)
│   ├── Platforms/                      MAUI boilerplate (auto-generated)
│   │   ├── Windows/                    Windows entry + Package manifest
│   │   ├── Android/                    Android stubs
│   │   ├── iOS/                        iOS stubs
│   │   ├── MacCatalyst/                Mac stubs
│   │   └── Tizen/                      Tizen stubs
│   ├── Resources/                      MAUI resources (auto-generated)
│   │   ├── AppIcon/                    SVG app icon
│   │   ├── Fonts/                      OpenSans Regular + Semibold
│   │   ├── Images/
│   │   ├── Splash/
│   │   └── Styles/                     Colors.xaml + Styles.xaml
│   ├── App.xaml/.cs                    Application + global converters
│   ├── AppShell.xaml/.cs               Flyout (Libraries + Settings) + routes
│   ├── MauiProgram.cs                  DI: HttpClient + Pages + ViewModels
│   ├── Properties/
│   │   └── launchSettings.json
│   └── MindVault.Desktop.csproj        net8.0-windows10.0.19041.0
│                                       CommunityToolkit.Mvvm 8.3.2
│
├── tools/
│   └── install-companion/
│       ├── install-windows.ps1         No-admin installer (HKCU registry)
│       ├── uninstall-windows.ps1       Removes daemon + registry keys
│       ├── install-mac.sh              Stub (Phase 3+)
│       └── install-linux.sh            Stub (Phase 3+)
│
├── docs/
│   ├── PLAN.md                         Master roadmap (Phases 0-4)
│   ├── ARCHITECTURE.md                 System architecture + layers
│   ├── SRS.md                          Software Requirements Specification
│   ├── SYSTEM-DESIGN.md                Detailed design decisions
│   ├── SETUP.md                        Installation + developer setup
│   ├── SETTINGS.md                     User-facing settings reference
│   ├── ENVIRONMENT.md                  Dev environment variables + paths
│   ├── CONFIGURATION.md                Runtime configuration reference
│   ├── PROJECT-STRUCTURE.md            ← this file
│   ├── DBMS-TABLES.md                  IndexedDB + SQLite table definitions
│   ├── ERD.md                          Entity Relationship Diagram
│   ├── ORD.md                          Object Relationship Diagram
│   ├── SCHEMA.md                       Full schema reference
│   ├── UI-UX-README.md                 UI/UX patterns + design decisions
│   ├── CI-CD-README.md                 Build + test pipeline
│   ├── REQUIREMENTS.md                 Functional + non-functional requirements
│   ├── DEPENDENCIES.md                 All third-party dependencies
│   ├── AI_FAQ.md                       AI-context FAQ for future sessions
│   ├── INSTALLATION_GUIDE.md           End-user + developer install guide
│   ├── ISSUES.md                       Known open issues
│   ├── SOLVED_ISSUES.md                Resolved issues log
│   ├── architecture/                   Diagrams + screenshots
│   └── progress/                       Per-session checkpoint + log files
│       ├── checkpoint-phase0.md
│       ├── checkpoint-phase1-complete.md
│       ├── checkpoint-phase2-complete.md
│       ├── session-2026-02-24.md
│       ├── session-prompt-log-2026-02-24.md
│       └── session-log-*.md            Previous session logs
│
├── CHANGELOG.md                        Full change history (all versions)
├── pnpm-workspace.yaml                 Workspace: packages/shared, packages/extension
├── package.json                        Root: scripts (test:all, build:all)
├── tsconfig.base.json                  Shared TS config
└── .gitignore
```

---

## Notes on Folder Structure

### Why `Platforms/` and `Resources/` inside `desktop/`?
These are **MAUI boilerplate** — every .NET MAUI project generates them. They are NOT
duplicates of anything else in the monorepo:
- `Platforms/` — platform-specific entry points (Windows WinUI3, Android Activity, iOS AppDelegate)
- `Resources/` — MAUI's asset pipeline (icons, fonts, splash screen, styles)
- `Pages/`, `ViewModels/`, `Models/`, `Services/`, `Converters/` — our custom code

### Why is `dist/` not in git?
`dist/` is in `.gitignore` (build output). To get it: run `C:\Temp\build-extension.bat`

### Why two manifests in `extension/`?
- `manifest.json` — Chrome/Edge MV3 (Manifest Version 3, `action`, `options_ui`)
- `manifest-firefox.json` — Firefox MV2 (`browser_action`, `background.scripts`)
  Vite build uses `manifest.json` by default; Firefox build would use the MV2 one.

---

## Key Architectural Patterns

### Repository Pattern
All IndexedDB access via `packages/extension/src/db/repositories/`. Each file owns
one object store and exports typed async functions.

### Boolean IDB Keys — Use In-Memory Filter
`IDBKeyRange.only(boolean)` throws `DataError` at runtime. Pattern: use `getAll()`
then `.filter()` in JS for boolean fields (`isDefault`, `isImportant`, `isPinned`).

### Encryption Transparency
Repositories call `getSessionKey(libraryId)`. If key active: encrypt on write,
decrypt on read. If no key (unencrypted library or locked): passthrough.

### Audit Log (Fire-and-Forget)
`logAction()` never throws. All callers: `void logAction(...)`.

### RGYB System
`repeatCount` on `SavedTab` → R/G/Y/B tier. Logic in `@mindvault/shared/utils/rgyb.ts`.
Colour mapping: R=#e74c3c, G=#2ecc71, Y=#f1c40f, B=#3498db.

### Companion Web Dashboard
The `companion/internal/api/ui/` directory is baked into the binary at compile time
via Go's `//go:embed ui` directive. The SPA is served at `http://127.0.0.1:47821/ui/`.
No separate file deployment needed — single EXE contains everything.
