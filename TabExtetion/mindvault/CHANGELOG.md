# MindVault Changelog

## [4.4.0] — 2026-03-01 — ISSUE-011 Fix: IndexedDB → SQLite Auto-Sync

### Summary
Sessions saved while companion was offline auto-sync to SQLite on next reconnect.
`INSERT OR IGNORE` makes all pushes idempotent. ISSUE-011 closed.

### Backend
- **`sqlite.go`**: `CreateSession` + `CreateTab` → `INSERT OR IGNORE` (idempotent re-push)

### Extension
- **`entities.ts`** (shared): `Session.syncedToCompanion?: boolean` — tracks push status
- **`sessions.ts`**: `markSessionSynced(id)` — sets flag after successful sync
- **`companion-client.ts`**: `pushSession()` → `Promise<boolean>`; added `syncAllUnpushedSessions()`
  scans all IDB libs/sessions, pushes unsynced ones + tabs, marks synced
- **`background/index.ts`**: `onStartup()` awaits `bootstrapCompanion` then calls `syncAllUnpushedSessions()`

### Companion UI
- **`index.html`**: ISSUE-011 notice updated to reflect auto-sync behaviour

### Tests: 27/27 Go · 116/116 TS

---

## [4.3.0] — 2026-02-28 — Column Resize, Library Context Menu, Export Enhancements, Notes Editing

### Summary
All-Tabs master panel fully revamped: 11-column CSS-grid with drag-resize, column visibility
toggle, text wrap (rows expand), clickable URLs, editable notes (saved via PATCH /tabs/{id}),
per-tab delete action, repeat count. Library sidebar now has right-click context menu (Rename /
Delete). Export toolbar added to companion and extension. Username included in default library
naming. ISSUE-011 informational notice added.

### Backend (companion)
- **`sqlite.go`**: Added `TabPatch` struct, `OsUsername()`, `UpdateTab()`. Refactored
  `MigrateDefaultLibraryNames()` → `MigrateDefaultLibraryNamesAs(username)` for testability.
  Default library names now include OS username: "Default (Chrome — DellVostro)".
- **`handlers.go`**: Added `PatchTab` (PATCH /tabs/{id}) and `DeleteTabByID` (DELETE /tabs/{id})
  handlers. `PushSession` auto-rename now includes username.
- **`server.go`**: Registered `PATCH /tabs/{id}` and `DELETE /tabs/{id}` routes.

### Companion UI
- **`app.js`**: Column visibility persisted to `localStorage('mv-col-vis')`; widths to
  `mv-col-widths`. New helpers: `applyColWidthsToCSS`, `wireResizeHandles`, `wireTabsToolbar`,
  `wireLibContextMenu`, `showLibCtxMenu`, `masterTabsExport`. Full `renderMasterTabsTable`
  replacement with 11 columns, notes textarea, open/delete actions, repeat count.
  Library contextmenu → right-click menu. ISSUE-011 notice shown on all-tabs switch.
- **`index.html`**: Export toolbar, column visibility menu (11 checkboxes), library right-click
  context menu (`#libCtxMenu`), ISSUE-011 notice div.
- **`style.css`**: 11-column CSS custom property grid, `align-items:start` for row height
  expansion, sticky header, text-wrap styles, resize handle, toolbar, visibility menu,
  issue notice, notes textarea, action buttons.

### Extension
- **`export.ts`**: Added `exportText()` — plain text (Title TAB URL per line).
- **`dashboard.html`**: Added Export Text button; `.th-resize-handle` spans in all `<th>` cells.
- **`dashboard.css`**: Added `th { position:relative }`, `.th-resize-handle` styles,
  text-wrap for `td.col-title` / `td.col-url`.
- **`dashboard/index.ts`**: Imported `exportText`, wired button, added `wireTableResize()`
  with pointer-event drag resize + `localStorage('mv-ext-col-widths')` persistence.

### Tests
- 27/27 Go tests passing
- 116/116 TS tests passing
- Extension build: 40 modules, clean

---

## [4.2.1] — 2026-02-28 — SW Cache Fix, No-Cache Middleware, Retroactive Library Rename, All Tabs Rich Table

### Summary
Fixes a critical service-worker cache freeze that caused browsers to serve the stale v4.1.0
UI files even after the binary was updated. Adds `Cache-Control: no-cache` headers to the Go
file server. Introduces a one-time startup migration that retroactively renames existing
"Default Library" entries to "Default (Chrome/Firefox/…)" based on their sessions' browser.
Upgrades the companion All Tabs panel to a rich 7-column sortable CSS-grid table matching
the extension dashboard.

### Fixed — companion web UI (`ui/`)
- **Service-worker cache freeze** (`sw.js`): `CACHE_NAME` bumped `mv-ui-v1` → `mv-ui-v4`.
  Browser detects the changed `sw.js`, installs the new service worker, and deletes the stale
  cache — all UI assets (app.js, style.css, index.html) are now served fresh.
- **`Cache-Control: no-cache, must-revalidate`** (`server.go`): new `noCacheUI` middleware
  wraps `http.FileServer` for the `/ui/` route so browsers always revalidate against the
  binary-embedded assets. Prevents stale-cache recurrence after future updates.

### Added — companion (Go)
- **`MigrateDefaultLibraryNames()` ** (`sqlite.go`): startup migration that finds all
  libraries still named exactly `"Default Library"`, queries their sessions for the dominant
  `source_browser`, and renames each to `"Default (Chrome)"` / `"Default (Firefox)"` etc.
  Idempotent — already-renamed libraries are unaffected.
- Called in `main.go` immediately after `database.Migrate()`.

### Added — companion web UI (`ui/`)
- **All Tabs rich table** (`app.js` + `style.css` + `index.html`):
  - Replaced flat `.tab-list` rows with a 7-column CSS-grid table (`.tab-table-wrap`).
  - Columns: **Colour** · **Title + favicon** · **Domain** · **Session** (clickable) ·
    **Library** · **Browser** · **Saved** (date).
  - Sortable column headers — click to toggle asc/desc on `savedAt`, `title`, `domain`,
    `sessionName`, `libraryName`, `sourceBrowser`.
  - Session cell click navigates to that session's tabs in the library view.
  - Search also filters on `sessionName`, `libraryName`, `sourceBrowser` (not just title/URL).
- **`domainOf(url)` helper** (`app.js`): shared helper used by both `renderMasterTabsTable()`
  and `renderTabs()` — replaces duplicate inline try/catch IIFE.
- **Tab struct extended** (`sqlite.go`): `SessionName`, `LibraryName`, `SourceBrowser`
  optional fields (populated via LEFT JOIN in `ListAllTabs()`, `nil` in per-library responses).
- **`ListAllTabs()` rewritten** (`sqlite.go`): now LEFT JOINs `sessions` and `libraries`
  tables so the API response for `GET /tabs` includes session/library metadata per tab.

### Tests
- **116 TS tests** — all passing (vitest)
- **27 Go tests** — all passing (go test ./...)

---

## [4.2.0] — 2026-02-28 — Theme Switcher, Library Rename, Auto-Rename Fix

### Summary
Companion web UI now has 4 selectable themes (Dark/Mid Dark/Mid Light/Light) persisted in
`localStorage`. Library names are editable inline (dblclick in sidebar). Auto-rename of
"Default Library" now fires on every session push (not just the first). New `PATCH /libraries/{id}`
REST endpoint for library rename.

### Fixed — companion (Go)
- **Auto-rename condition**: removed `count == 1` guard — any session push to a "Default Library"
  from a known browser now triggers rename to `"Default (Chrome/Firefox/…)"` regardless of how
  many sessions the library already contains.

### Added — companion (Go)
- **`PATCH /libraries/{id}`**: new endpoint; body `{ "name": "…" }` renames the library.
  Returns `204 No Content`. Handler `PatchLibrary` in `handlers.go`; route in `server.go`.

### Added — companion web UI (`ui/`)
- **Theme switcher** (`style.css` + `app.js`):
  - 4 themes: **Dark** (default `#0f0f10`), **Mid Dark** (Catppuccin-inspired `#1e1e2e`),
    **Mid Light** (`#e8e8f0`), **Light** (`#f5f5f7`).
  - Implemented via `:root[data-theme="…"]` CSS custom-property overrides — zero JS color code.
  - Theme persisted in `localStorage('mv-theme')` and restored in `boot()` before first paint.
  - **Appearance** settings card added to Settings page with 4 toggle buttons; active button
    highlighted with `--accent` background.
- **Library inline rename** (`app.js`):
  - Double-click any library name in the sidebar to enter inline edit mode.
  - Input styled with `--accent` border (`.lib-rename-input` in `style.css`).
  - Enter/blur commits via `PATCH /libraries/{id}`; Escape cancels — both reload sidebar.
  - `committed` guard prevents double-submit.

## [4.1.0] — 2026-02-27 — Multi-Library, Session Management & List Views

### Summary
Cross-browser multi-library support with full session management. Sessions now show as
sortable list views with inline rename, archive/restore, and delete (keep tabs or cascade).
New master "All Sessions" and "All Tabs" cross-library views in the companion sidebar.
Extension popup now lets you choose which library to save to.

### Added — companion (Go)
- **DB migration 002**: `source_browser TEXT` and `archived INTEGER` columns on `sessions`.
- **`GET/POST/PATCH /libraries/{libId}/sessions`**: PATCH supports `name` and `archived` fields;
  `?archived=true` query param returns all sessions including archived ones.
- **`DELETE /libraries/{libId}/sessions/{id}?deleteTabs=true`**: cascade deletes all tabs in session.
- **`GET /sessions`**: master cross-library sessions list (all libraries merged).
- **`GET /tabs`**: master cross-library tabs list (all libraries merged).
- **`sessionSortCol`/`sessionSortDir`**: server-side ordering (`createdAt DESC` default).
- **Auto-rename library**: on first session push, if library is named "Default Library" and
  `source_browser != ""`, rename to `"Default (Chrome)"` / `"Default (Firefox)"` etc.

### Changed — companion web UI (`ui/`)
- **`index.html`**: 5 sidebar nav buttons (📚 Libraries, 📋 All Sessions, 🗂️ All Tabs, 🔍 Search,
  ⚙️ Settings); sessions toolbar with archived toggle; master sessions + master tabs panels;
  context menu div with all 6 session actions.
- **`style.css`**: replaced `.session-card` grid with `.session-table-wrap` CSS-grid list view;
  added `.sessions-toolbar`, `.toggle-archived`, `.session-row`, `.sr-*` column classes,
  sortable header arrows, `.archived-badge`, `.ctx-menu` + item styles.
- **`app.js`** (complete rewrite ~1100 lines): `renderSessionsTable()` — unified renderer used for
  both per-library and master views; sortable columns (Name/Date/Tabs); right-click + ⋯ button
  context menu; inline dblclick rename with `committed` guard; archive/restore; delete (keep tabs
  or cascade); `loadMasterSessions()` + `loadMasterTabs()` for cross-library panels;
  `fmtDate()` smart date formatting; `apiPatch()` helper.

### Added — extension (TypeScript)
- **`entities.ts`**: `sourceBrowser?: string` and `archived?: boolean` on `Session` interface.
- **`companion-client.ts`**: `detectBrowser()` exported; `pushSession()` auto-injects
  `sourceBrowser`; `PushSessionPayload` extended with `sourceBrowser?`.
- **`popup.html` + `popup.css` + `popup/index.ts`**: library dropdown ("Save to Library:") above
  session name input; remembers last selection in `chrome.storage.local`; success message shows
  library name.
- **`dashboard/dashboard.html`**: sessions toolbar with archived toggle; context menu; container
  class changed from `sessions-grid` → `sessions-table-wrap`.
- **`dashboard/dashboard.css`**: replaced `.sessions-grid` / `.session-card` with CSS-grid list
  view styles matching companion; added sessions toolbar, context menu, `.archived-badge`.
- **`dashboard/index.ts`**: `renderSessionsTable()` with sortable columns and ⋯ menu; context menu
  (open, rename, archive/restore, delete, delete+tabs); inline rename with `committed` guard;
  `sortSessions()`, `fmtDate()`, `showSessionContextMenu()`, `handleSessionAction()`,
  `doRenameSession()`; imports `updateSession`, `deleteSession`, `getTabsBySession`.

### Fixed
- **`db_test.go`**: `TestListSessions` updated to pass `archived=false` to `ListSessions(libID, false)`.

### Tests
- **116 TS tests** — all passing (vitest)
- **27 Go tests** — all passing (go test ./...)
- **40 Chrome modules** built (vite)

---

## [4.0.0] — 2026-02-26 — Phase 3 Complete

### Phase 3 Summary (Steps 1–12)
All Phase 3 steps complete. Companion web dashboard fully functional — served at
`http://127.0.0.1:47821/ui/`, installable as a PWA. All libraries, sessions, tabs,
bookmarks, history, and downloads are browsable and searchable. Bookmark import,
browser-smart installer, auto-start Task Scheduler toggle, and DELETE cascade all ship.

### 2026-02-26 — Steps 10+11: Bookmark Importer + Auto-Start

#### Added — Step 10 (bookmark importer)
- **`ui/app.js`** — `parseNetscapeHTML()`: DOMParser walks `<A>`/`<H3>` from browser HTML export.
- `parseChromiumJSON()`: recursive walk of Chromium JSON `roots.*` (bookmark_bar/other/synced).
- `importBookmarks()`: sequential POST to `/libraries/:id/bookmarks` with progress callback.
- `renderImportCard()` + `wireImportCard()`: Settings card — library picker, file input,
  format auto-detect (`.json` → JSON, else Netscape HTML), live progress + result summary.
- `renderSettings()` updated to include import card and call `wireImportCard()`.

#### Added — Step 11 (auto-start)
- **`handlers/autostart.go`** — `GetAutostart`, `EnableAutostart`, `DisableAutostart` via
  `schtasks.exe` (Windows built-in, no admin required, `/RL LIMITED`).
- **`server.go`** — `GET/POST/DELETE /autostart` routes (protected).
- **`ui/app.js`** — `apiDel()` helper; `renderSettings()` fetches `/autostart` state;
  Auto-Start card shows Task Scheduler status with ▶ Enable / ⏹ Disable toggle.

---

## [Unreleased] — 2026-02-26 — Phase 3 Steps 7+8: PWA + Smart Installer

### 2026-02-26 — Step 8: Smart browser installer in Settings panel

#### Added — Step 8
- **`ui/app.js`** — `BROWSERS[]` (6 entries), `detectBrowser()` (UA + Brave API),
  `renderBrowserInstallCard()` (current browser first + "← you" badge, dim others,
  "Open extensions page ↗" link per browser). `renderSettings()` uses it.
- Verified: Chrome detected, 6 rows, badge present.

---

## [Unreleased] — 2026-02-26 — Phase 3 Step 7: PWA Service Worker + Install Prompt

### 2026-02-26 — Session 8: PWA offline cache + install prompt + SVG icon

#### Added — Step 7
- **`ui/sw.js`** (141 lines) — cache-first for `/ui/*`; network-first for API;
  pre-caches shell assets on install; purges old caches on activate.
- **`ui/icon.svg`** — SVG app icon, maskable-zone compliant, dark+purple+MV.
- **`ui/manifest.json`** — scope, display_override, SVG icons (any+maskable).
- **`ui/index.html`** — SW registration + `#installBtn` in sidebar footer.
- **`ui/app.js`** — `beforeinstallprompt` capture → button → prompt on click.
- **`ui/style.css`** — `.install-btn` purple button styles.

#### Verified: SW activated, /ui/sw.js + /ui/icon.svg → 200, Install button visible

---

## [Unreleased] — 2026-02-26 — Phase 3 Step 9: DELETE handlers

### 2026-02-26 — Session 7: DELETE endpoints — library/session/tab/bookmark/history/download

#### Added
- **`companion/internal/db/sqlite.go`** — `DeleteLibrary` (cascades all children),
  `DeleteSession` (tabs remain, session_id→NULL), `DeleteTab`, `DeleteBookmark`
  (cascades child bookmarks), `DeleteHistoryEntry`, `DeleteDownload`.
- **`companion/internal/api/handlers/handlers.go`** — Replaced 3×501 stubs
  (DeleteLibrary/Session/Tab) + added DeleteBookmark/DeleteHistoryEntry/DeleteDownload.
  All return 204 No Content on success.
- **`companion/internal/api/server.go`** — DELETE routes:
  `/libraries/{libId}/bookmarks/{id}`, `/libraries/{libId}/history/{id}`,
  `/libraries/{libId}/downloads/{id}`.

#### Verified: all 6 DELETE endpoints → 204, Go tests 27 passing

---

## [Unreleased] — 2026-02-26 — Phase 3: Bookmarks / History / Downloads pipeline

### 2026-02-26 — Session 6: Bookmarks / History / Downloads — Companion DB + API + Extension push + Web UI

#### Added — Companion DB (`companion/internal/db/sqlite.go`)
- **`Bookmark` struct + `CreateBookmark()` + `ListBookmarks()`** — `INSERT OR IGNORE` by id;
  list ordered by `created_at`.
- **`HistoryEntry` struct + `UpsertHistoryEntry()` + `ListHistory()`** — `INSERT OR IGNORE`
  by id; list ordered by `visit_time DESC LIMIT 500`.
- **`Download` struct + `CreateDownload()` + `ListDownloads()`** — `INSERT OR IGNORE` by id;
  list ordered by `downloaded_at DESC`.
- **`Search()` fixed** — empty `libraryID` now searches all libraries (`WHERE (? = '' OR
  library_id = ?)`). Results now span tabs + bookmarks + history (sequential queries with
  explicit `rows.Close()` between each to avoid single-connection deadlock).

#### Added — Companion API (`companion/internal/api/`)
- **`handlers/handlers.go`** — `ListBookmarks`, `CreateBookmark`, `ListHistory`,
  `CreateHistoryEntry`, `ListDownloads`, `CreateDownload` handlers. `Search` handler
  updated: `libId` query param is now optional.
- **`server.go`** — 6 new routes:
  `GET/POST /libraries/{libId}/bookmarks`,
  `GET/POST /libraries/{libId}/history`,
  `GET/POST /libraries/{libId}/downloads`.

#### Added — Extension push pipeline (`packages/extension/src/`)
- **`services/companion-client.ts`** — `PushBookmarkPayload`, `PushHistoryPayload`,
  `PushDownloadPayload` interfaces; `pushBookmark()`, `pushHistoryEntry()`,
  `pushDownload()` functions (all fire-and-forget, silent on error).
- **`background/history-capture.ts`** — live `onVisited` handler now chains
  `.then(entry => pushHistoryEntry(...))` after `upsertHistoryEntry`.
- **`background/download-capture.ts`** — live `onCreated` handler now chains
  `.then(dl => pushDownload(...))` with `interrupted → error` state mapping for
  companion DB CHECK constraint.
- **`background/bookmark-sync.ts`** — live `onCreated` handler now chains
  `.then(bmId => pushBookmark(...))` after `importNode` (skips folder nodes).

#### Added — Web UI (`companion/internal/api/ui/`)
- **`index.html`** — `sessionsPanel` extended: renamed `sessionCount → entityCount`;
  added `.lib-nav` sub-nav bar (Sessions | Bookmarks | History | Downloads);
  added `bookmarkList`, `historyList`, `downloadList` divs (hidden by default).
- **`style.css`** — `.lib-nav`, `.lnav-btn`, `.lnav-btn.active` tab-underline styles.
- **`app.js`** (now ~500 lines):
  - `showLibContent(type)` — toggles active list + updates active lnav-btn.
  - lnavBtns click handlers — load data on first demand.
  - `loadBookmarks(libId)` / `renderBookmarks(items)` — fetches `/libraries/:id/bookmarks`,
    renders rows with folder/link icons, url links.
  - `loadHistory(libId)` / `renderHistory(items)` — fetches `/libraries/:id/history`,
    renders rows with favicon, domain, visit time.
  - `loadDownloads(libId)` / `renderDownloads(items)` — fetches `/libraries/:id/downloads`,
    renders rows with filename, url, size, state badge.

#### Rebuilt + Verified
- Companion binary rebuilt (`go build ./cmd/mvaultd`), reinstalled, daemon restarted (PID 6072).
- Extension rebuilt (`npx vite build`), 40 modules, BUILD_EXIT=0.
- **143 tests passing** (116 TS + 27 Go), 0 failures.
```
GET /ui/           → 200
GET /libraries/:id/bookmarks  → 200
GET /libraries/:id/history    → 200
GET /libraries/:id/downloads  → 200
GET /search?q=test            → 200
TS tests: 116 passed, 0 failed
Go tests: ok internal/api 0.378s, ok internal/db 1.174s
```

---

## [Unreleased] — 2026-02-26 — Phase 3: Web Dashboard Search + Settings + Docs

### 2026-02-26 — Session 5: Web UI Search/Settings + INSTALLATION_GUIDE + Doc updates

#### Added — Phase 3 Step 4: Search + Settings panels in companion web dashboard
- **`companion/internal/api/ui/index.html`** (extended) — sidebar nav tabs row (Libraries 📚 |
  Search 🔍 | Settings ⚙️); `searchPanel` section (global search input + library picker);
  `settingsPanel` section (companion status, install guide, paths).
- **`companion/internal/api/ui/style.css`** (extended) — `.sidebar-nav`, `.snav-btn`,
  `.snav-btn.active`, `.search-lib-picker`, `.settings-card`, `.settings-row`, `.install-step` styles.
- **`companion/internal/api/ui/app.js`** (extended, 360 lines total):
  - Nav tab click handlers — toggles between Libraries/Search/Settings views
  - `populateSearchLibPicker()` — fills library dropdown from cached data
  - `doSearch()` — 320ms debounced, calls `GET /search?q=&libId=`, renders results
  - `renderSearchResults()` — renders hit cards with keyword highlighting
  - `highlight()` — marks matched text with yellow `<mark>` tags
  - `renderSettings()` — fetches `/health` + `/libraries`, renders 3 info cards
    (Companion Status, Install Browser Extension, Companion Install Path)
- **`docs/INSTALLATION_GUIDE.md`** (new) — comprehensive end-user + developer install guide:
  Quick Install (companion + extension for all browsers), PWA install, developer setup,
  daemon management, file locations, registry keys, uninstall, troubleshooting.

#### Updated — Reference docs
- **`docs/SETUP.md`** — removed MAUI section, added companion web dashboard section, updated
  prerequisites (no .NET SDK), updated helper scripts table, fixed API path.
- **`docs/PROJECT-STRUCTURE.md`** — added `companion/internal/api/ui/` tree with all 4 files;
  added `INSTALLATION_GUIDE.md` to docs list; updated architectural notes (Go embed pattern).
- **`docs/AI_FAQ.md`** — updated phase status (Phase 3 = companion web UI, not MAUI);
  updated project description (all-browser); updated test counts (143); updated companion
  daemon description (web dashboard, PWA, all browsers); removed MAUI RGYB converter note;
  added INSTALLATION_GUIDE to key files table.

#### Rebuilt
- Companion binary rebuilt with `go build ./cmd/mvaultd` — updated embedded UI files
  (index.html + style.css + app.js) baked in via `//go:embed ui`. New binary installed to
  `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`, daemon restarted.

#### Verified
```
GET /ui/  → 200, sidebar nav tabs present (Libraries/Search/Settings)
GET /ui/app.js → 200, 360 lines (search + settings handlers present)
Companion PID: 1616, running on :47821
```

---

## [Unreleased] — 2026-02-25 — Phase 3: Companion Web UI + Full Browser Support

### 2026-02-25 — Session 4: Firefox fix + Companion Web Dashboard + Multi-browser

#### Fixed
- **Firefox popup empty tab list (SOLVED-013)** — `chrome.tabs.query({currentWindow:true})`
  resolves to the popup's own window in Firefox MV2 (0 tabs). Fixed by switching to
  `browser.tabs.query({lastFocusedWindow:true})` using the `webextension-polyfill` import.
  Also filtered `moz-extension://`, `edge://`, `opera://`, `brave://`, `vivaldi://` URLs
  from `handleSave()` alongside existing `chrome://` / `about:` filters.
- **Firefox `manifest-firefox.json`** — added `"*://*/*"` and `"file:///*"` to `permissions`
  so `tab.url` / `tab.title` are reliably readable in all Firefox modes (incl. temporary).
- **Companion CORS for Firefox (SOLVED-014)** — `corsMiddleware` now reflects the request
  `Origin` header for `moz-extension://`, `safari-extension://`, `http://127.0.0.1`,
  `http://localhost`, and `null` (PWA) origins. Firefox extension sync now works.

#### Added — Phase 3 Step 3: Companion Web Dashboard
- **`companion/internal/api/ui/index.html`** — SPA shell: sidebar (library list + New button),
  sessions panel, tabs panel with live search, welcome screen, new-library modal.
- **`companion/internal/api/ui/style.css`** — dark responsive theme (`--bg #0f0f10`,
  `--accent #7c6aff`), RGYB colour dots, sidebar + card layouts, mobile breakpoint.
- **`companion/internal/api/ui/app.js`** — vanilla JS SPA: `GET /token` bootstrap, libraries
  list, sessions per library, tabs per session, live title/URL search, create library modal,
  HTML-escape helper, error states throughout.
- **`companion/internal/api/ui/manifest.json`** — PWA manifest: standalone display,
  theme `#7c6aff`, `start_url: /ui/`.
- **`companion/internal/api/server.go`** — `//go:embed ui` + `fs.Sub` + `/ui/` file server;
  redirects `/` and `/ui` → `/ui/`; `strings` import added.
- **`C:\Temp\install-mv-companion.ps1`** (updated) — detects and registers native messaging
  for Chrome, Chrome Beta/Dev, Chromium, Edge, Edge Beta, Brave, Opera, Opera GX, Vivaldi,
  Arc. Shows which browsers were found vs skipped. Prints dashboard URL after install.

#### Architecture decision recorded
Replaced .NET MAUI as Phase 3 primary with companion-served web UI:
- **Before:** Extension + Companion + MAUI desktop = 3 installs, Windows-only
- **After:** Extension + Companion (serves `/ui/`) = 2 installs, any browser, PWA-installable
  `desktop/` scaffold kept in repo for potential future native features.

#### Verified
```
GET /ui/          → 200, MindVault title present, app.js linked
GET /             → 301 → /ui/
GET /ui/app.js    → 200, 9177 bytes
GET /token        → 200 {"token":"2adcf18f..."}
GET /health       → 200 {"status":"ok","version":"0.1.0"}
Chrome build:   40 modules → dist/
Firefox build:  41 modules → dist-firefox/
Go tests:       27 passing (19 API + 8 DB)
TS tests:      116 passing, 0 failures
```

---

## [Unreleased] — 2026-02-24 — Phase 3: MAUI Scaffold + Companion Sync Pipeline

### 2026-02-24 — Session 3: Extension → Companion Sync Pipeline (commit 97f0b45)

#### Added
- **`packages/extension/src/services/companion-client.ts`** (new, 172 lines) — fire-and-forget
  HTTP client for the companion REST API:
  - `bootstrapCompanion(library)` — fetches token from `GET /token`, checks if library exists
    via `GET /libraries/{id}`, creates it if missing; called on every extension startup
  - `pushSession(libraryId, payload)` — POST session to companion after every Save All
  - `pushTabs(libraryId, tabs[])` — parallel-push all tabs via `Promise.allSettled()`; one tab
    failure does not block others
  - `clearCompanionToken()` — clears cached token from `chrome.storage.local`
  - Token cached under `mv_companion_token` in `chrome.storage.local`; fetched fresh on each
    bootstrap (GET /token is unauthenticated, localhost-only)
- **`companion/internal/api/handlers/handlers.go`** — sync support additions:
  - `idOrNew(id string) string` — uses caller-provided ID if non-empty, else generates new UUID;
    allows extension to pass its own IDB-generated IDs so records stay consistent across stores
  - `GetToken` handler — unauthenticated `GET /token` endpoint returns the daemon's auth token;
    safe because companion binds to `127.0.0.1` only (no remote access)
  - Optional `id` field added to `createLibraryReq`, `createSessionReq`, `createTabReq`
  - `tabCount` field added to `createSessionReq`

#### Modified
- **`companion/internal/api/server.go`** — `handlers.New(db, token)` (token threaded through),
  `GET /token` route registered without auth middleware
- **`packages/extension/src/background/index.ts`** — calls `bootstrapCompanion()` on every
  startup/install with correct Library field mapping
  (`encryptionEnabled` → `isEncrypted`, `encryptionSalt` → `passwordSalt`)
- **`packages/extension/src/popup/index.ts`** — after every `handleSave()` IDB write, fires
  `pushSession()` + `pushTabs()` (both void / fire-and-forget); uses `SavedTab.favicon` (not
  `favIconUrl`) — consistent with entity types

#### Architecture note
All sync calls are **fire-and-forget** — extension is fully standalone if companion is offline.
IDs are preserved across IndexedDB and companion SQLite because extension passes its own IDs.

#### Test Results
```
Go companion:  27 passed (19 API + 8 DB) — all passing (cached)
TypeScript:   116 passed (no regressions)
Firefox build: 41 modules → dist-firefox/ (companion-client chunk included)
Chrome build:  40 modules → dist/ (companion-client-DFf2MSEM.js chunk)
Total:        143 passed, 0 failed
```

#### Companion Rebuilt + Reinstalled
- Binary rebuilt: `companion/bin/mvaultd.exe`
- Installed to `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`
- Daemon restarted — health: `{"status":"ok","version":"0.1.0"}`
- Token endpoint verified: `GET /token` → `{"token":"2adcf18f..."}`

---

### 2026-02-24 — Session 2: Phase 3 Step 5 (partial) — Firefox MV2 Build + Fix

#### Fixed
- **`packages/extension/manifest-firefox.json`** — changed `options_page` to `options_ui.page`
  (identical fix as SOLVED-001 for Chrome). The `@samrum/vite-plugin-web-extension` plugin
  only processes `options_ui.page`; `options_page` was silently skipped, meaning the dashboard
  was excluded from the Firefox build output entirely.
- **`docs/SETUP.md`** — corrected Firefox loading instructions which incorrectly said to
  load `manifest-firefox.json` from the source folder. Firefox cannot execute TypeScript;
  always load the compiled `dist-firefox/` folder.

#### Added
- **`packages/extension/vite.config.firefox.ts`** — Firefox-specific Vite build config
  - Uses `manifest-firefox.json` (MV2) instead of `manifest.json` (MV3)
  - Outputs to `dist-firefox/` (separate from Chrome/Edge `dist/`)
  - Identical alias and build settings as the Chrome config
- **`packages/extension/package.json`** — added `build:firefox` script:
  `vite build --config vite.config.firefox.ts`
- **`docs/SETUP.md`** — new §5 "How to Access MindVault" table (popup / dashboard /
  companion health URL / MAUI desktop app); updated Firefox section with correct steps;
  updated test count 134 → 143
- **`docs/ISSUES.md`** — added ISSUE-009: setup guide had wrong Firefox instructions
- **`docs/SOLVED_ISSUES.md`** — added SOLVED-012: Firefox "corrupt" error root cause + fix

#### Build Results (Firefox)
```
dist-firefox/src/popup/popup.html       1.68 kB
dist-firefox/src/dashboard/dashboard.html  9.43 kB  ← now included
dist-firefox/background.html            0.16 kB
dist-firefox/manifest.json              0.92 kB
40 modules transformed in 642ms
```

---

### 2026-02-24 — Session: Phase 3 Step 2 — Companion POST Endpoints

#### Added
- **`companion/internal/api/handlers/handlers.go`** — Three new CREATE handlers:
  - `generateID()` — 16-byte crypto/rand hex ID (no external UUID dependency)
  - `CreateLibrary` + `createLibraryReq` — `POST /libraries`; validates `name` required;
    inserts with `time.Now().UnixMilli()` timestamps; returns created library JSON
  - `CreateSession` + `createSessionReq` — `POST /libraries/{libId}/sessions`; validates
    library exists (404 if not); inserts session; returns created session JSON
  - `CreateTab` + `createTabReq` — `POST /libraries/{libId}/tabs`; validates library exists
    and `url` required; inserts tab; returns created tab JSON
- **`companion/internal/api/api_test.go`** — `post()` helper + 9 new tests:
  - `TestCreateLibrary` — happy path: POST returns 200 with correct JSON body
  - `TestCreateLibraryMissingName` — empty name → 400
  - `TestCreateLibraryNoAuth` — missing token → 401
  - `TestCreateSession` — happy path: session created under seeded library
  - `TestCreateSessionMissingName` — empty name → 400
  - `TestCreateSessionLibraryNotFound` — bad libId → 404
  - `TestCreateTab` — happy path: tab created under seeded library
  - `TestCreateTabMissingURL` — empty url → 400
  - `TestCreateTabLibraryNotFound` — bad libId → 404

#### Test Results
```
Go companion:  27 passed (19 API + 8 DB) — up from 18
TypeScript:   116 passed (no regressions)
Total:        143 passed, 0 failed
```

#### Companion Rebuilt + Reinstalled
- Binary rebuilt: `companion/bin/mvaultd.exe` (15 MB, 2026-02-24)
- Installed to `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`
- Daemon restarted — health: `{"status":"ok","version":"0.1.0"}`

---

### 2026-02-24 — Session: Phase 3 Start + Extension Build Fix

#### Fixed
- **`packages/extension/src/db/repositories/libraries.ts`** — `getDefaultLibrary()` was calling
  `IDBKeyRange.only(true)` which throws `DataError: not a valid key` at runtime (booleans are
  not valid IDB keys). Fixed by using `getAll()` + `find(lib => lib.isDefault === true)` in
  memory — same pattern as `getImportantHistory()`. This was firing twice on every extension
  startup via the background service worker, showing as uncaught promise rejections in DevTools.
- **`packages/extension/manifest.json`** — changed `options_page` (MV2 legacy) to `options_ui.page`
  (MV3 standard) so `@samrum/vite-plugin-web-extension` v5.1.1 picks up the dashboard as a
  Vite entry point and includes it in `dist/`. Previously the dashboard was silently excluded,
  causing Chrome/Edge to show "Could not load options page / Could not load manifest".

#### Added — Phase 3: .NET MAUI Desktop App scaffold
- **`desktop/MindVault.Desktop.csproj`** — MAUI project; targets `net8.0-windows10.0.19041.0`;
  adds `Microsoft.Extensions.Http` + `CommunityToolkit.Mvvm 8.3.2`
- **`desktop/Models/ApiModels.cs`** — DTOs: Library, Session, Tab, SearchResult, HealthResponse
- **`desktop/Services/CompanionApiClient.cs`** — typed HttpClient wrapper for companion REST API
- **`desktop/Services/TokenStore.cs`** — reads auth token from `%LOCALAPPDATA%\MindVault\token`
- **`desktop/ViewModels/LibrariesViewModel.cs`** — ObservableObject with LoadCommand
- **`desktop/ViewModels/SessionsViewModel.cs`** — LoadCommand with libraryId param
- **`desktop/ViewModels/TabsViewModel.cs`** — LoadCommand + SearchCommand + FilteredTabs
- **`desktop/Pages/LibrariesPage.xaml`** + `.xaml.cs` — Shell navigation root; CollectionView
- **`desktop/Pages/SessionsPage.xaml`** + `.xaml.cs` — QueryProperty libraryId
- **`desktop/Pages/TabsPage.xaml`** + `.xaml.cs` — search bar + RGYB colour indicator
- **`desktop/Pages/SettingsPage.xaml`** + `.xaml.cs` — companion status + token path display
- **`desktop/Converters/ValueConverters.cs`** — InvertedBool, StringToBool, IsNotNull, ColourToColor
- **`desktop/AppShell.xaml`** — Flyout sidebar: Libraries + Settings; FlyoutWidth=220
- **`desktop/AppShell.xaml.cs`** — registers deep-link routes: SessionsPage, TabsPage
- **`desktop/App.xaml`** — global converter resources registered
- **`desktop/MauiProgram.cs`** — DI: HttpClient factory + all pages + all ViewModels

#### Build / Tooling
- Extension rebuilt: 39 modules → `dist/src/dashboard/dashboard.html` (9.43 kB) now included
- Companion binary built: `companion/bin/mvaultd.exe`
- Companion installed to `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`
- Native messaging registered in HKCU for Chrome + Edge (wildcard origin for dev)
- Companion daemon started on port 47821 — health: `{"status":"ok","version":"0.1.0"}`

---

## [v3.0.0] — 2026-02-23 — Phase 2 Complete

### 2026-02-23 — Session: Phase 2 Step 16 — E2E Test Scaffold

#### Added
- **`companion/internal/db/db_test.go`** — SQLite DB-level tests (8 tests)
  - `TestOpenInMemory` — in-memory DB opens and migrates cleanly
  - `TestCreateAndListLibraries` — CRUD roundtrip: Create → List → assert fields
  - `TestGetLibrary` — fetch by ID
  - `TestGetLibraryNotFound` — missing ID returns error
  - `TestListSessions` — sessions returned per library
  - `TestListTabs` — tabs returned per library
  - `TestSearch` — LIKE search finds correct tab by URL
  - `TestMigrateIdempotent` — running Migrate 3× is safe
- **`companion/internal/api/api_test.go`** — HTTP API E2E tests via `net/http/httptest` (10 tests)
  - `TestHealthNoAuth` — GET /health → 200 `{"status":"ok"}` without token
  - `TestAuthRequired` — GET /libraries without token → 401
  - `TestWrongToken` — GET /libraries with wrong token → 401
  - `TestListLibraries` — seeded DB → API returns correct library JSON
  - `TestGetLibrary` — GET /libraries/{id} returns seeded library
  - `TestGetLibraryNotFound` — GET /libraries/nonexistent → 404
  - `TestListSessions` — GET /libraries/{id}/sessions returns seeded session
  - `TestListTabs` — GET /libraries/{id}/tabs returns 2 seeded tabs
  - `TestSearchTabs` — GET /search?libId=&q=sqlite finds correct tab
  - `TestVersionEndpoint` — GET /version → 200

#### Modified
- **`companion/internal/db/sqlite.go`** — added Create methods + OpenInMemory
  - `OpenInMemory()` — in-memory SQLite for tests
  - `CreateLibrary(Library) error` — INSERT into libraries
  - `CreateSession(Session) error` — INSERT into sessions
  - `CreateTab(Tab) error` — INSERT into saved_tabs

#### Test Results
```
Go companion:     18 passed (10 API + 8 DB)
TypeScript ext:  116 passed (no regressions)
Total:           134 passed, 0 failed
go vet ./...  → clean
```

#### State: Full test pyramid — DB → HTTP → 134 total tests green

---

### 2026-02-23 — Session: Phase 2 Step 15 — Phase 2 Checkpoint

#### Added
- **`docs/progress/checkpoint-phase2-complete.md`** — Full Phase 2 checkpoint
  - All 14 steps verified complete
  - 163 tests passing (116 extension + 47 shared), 0 failures
  - 32 build modules, ~510ms build time
  - Architecture diagram, file manifest, known gaps, next phase roadmap

#### State: Phase 2 COMPLETE — 163/163 tests; companion v0.1.0; installer ready

---

### 2026-02-23 — Session: Phase 2 Step 14 — Windows Installer Scaffold

#### Added
- **`tools/install-companion/install-windows.ps1`** — Full Windows installer (219 lines)
  - Auto-detects `mvaultd.exe` from build output or accepts `-BinaryPath`
  - Copies binary to `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`
  - Writes native messaging manifest to `%LOCALAPPDATA%\MindVault\`
  - Registers Chrome + Edge native messaging host (HKCU, no admin required)
  - Optional `-AutoStart`: registers Task Scheduler job (runs at logon, current user)
  - Optional `-Force`: stops running daemon before upgrade
  - Prints clear summary with installed paths and next steps
- **`tools/install-companion/uninstall-windows.ps1`** — Companion uninstaller
  - Stops running daemon process
  - Removes Task Scheduler entry, Chrome + Edge registry keys, manifest, binary
  - `-KeepData` flag preserves SQLite DB and token file
- **`tools/install-companion/install-mac.sh`** — macOS installer stub (Phase 3)
  - Documents target paths: `~/Library/Application Support/`, LaunchAgent plist
- **`tools/install-companion/install-linux.sh`** — Linux installer stub (Phase 3)
  - Documents target paths: `~/.config/google-chrome/NativeMessagingHosts/`, systemd user service

#### Architecture
- No admin required: HKCU registry + %LOCALAPPDATA% only
- Task Scheduler preferred over HKCU\Run (survives UAC, restarts on failure)
- Edge support included (same manifest format as Chrome)

#### State: installer ready; build → install → register in one script

---

### 2026-02-23 — Session: Phase 2 Step 13 — Firefox Polyfill + Cross-Browser Manifest

#### Added
- **`packages/extension/src/polyfill.ts`** — Browser API polyfill entry point
  - Imports `webextension-polyfill` as side effect (makes `browser.*` namespace available)
  - Must be first import in every extension entry point
- **`packages/extension/manifest-firefox.json`** — Firefox MV2 manifest template
  - `manifest_version: 2` (Firefox 115+ compatible)
  - `browser_action` instead of `action` (MV2 naming)
  - `background.scripts` array instead of `service_worker`
  - Gecko extension ID: `mindvault@mindvault.app`, `strict_min_version: "115.0"`
  - Tabs, storage, alarms permissions
- **`webextension-polyfill`** added to runtime dependencies
- **`@types/webextension-polyfill`** added to devDependencies

#### Modified
- **`packages/extension/src/background/index.ts`** — `import '../polyfill'` added as first import
- **`packages/extension/src/popup/index.ts`** — `import '../polyfill'` added as first import
- **`packages/extension/src/dashboard/index.ts`** — `import '../polyfill'` added as first import

#### Build Verification
```
✓ 32 modules transformed (up from 28 — polyfill adds 4 modules)
✓ 116 tests passing (no regressions)
✓ built in 345ms
```

#### State: 116/116 tests; 32 modules; Chrome MV3 + Firefox MV2 support

---

### 2026-02-23 — Session: Phase 2 Step 12 — Native Messaging Registration

#### Added
- **`companion/com.mindvault.companion.json`** — Native messaging host manifest template
  - `"type": "stdio"` protocol for Chrome ↔ daemon JSON communication
  - `allowed_origins`: placeholder for extension ID (wildcard `*` used in dev mode)
- **`scripts/register-native-host.ps1`** — PowerShell registration script
  - Copies manifest JSON to `%LOCALAPPDATA%\MindVault\`
  - Writes `HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion`
  - Accepts `-ExtensionId` and `-BinaryPath` params; interactive prompt for ID if omitted
  - No admin required (HKCU only)
- **`scripts/unregister-native-host.ps1`** — Cleanup script; deletes key + manifest

#### Verified
- Registry key written successfully:
  - `HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion`
  - → `%LOCALAPPDATA%\MindVault\com.mindvault.companion.json`
- Manifest file verified at `C:\Users\Dell Vostro\AppData\Local\MindVault\com.mindvault.companion.json`
- Dev mode: `allowed_origins = ["chrome-extension://*/"]` (update with real ID from `chrome://extensions`)

#### State: Extension 163/163 tests; companion builds clean; native host registered

---

### 2026-02-23 — Session: Phase 2 Step 11 — Go Companion Daemon Scaffold

#### Added
- **`companion/`** — Go companion daemon scaffolded inside monorepo
  - `go.mod` — module `github.com/mindvault/companion`, Go 1.22+, `modernc.org/sqlite v1.29.0`
  - `go.sum` — locked dependency checksums (generated by `go mod tidy`)
  - `cmd/mvaultd/main.go` — entry point: flags, DB init, auth token, HTTP server, graceful shutdown
  - `internal/api/server.go` — HTTP mux with all routes, auth middleware, CORS middleware
  - `internal/api/handlers/handlers.go` — all HTTP handlers (health/version live; CRUD stubs)
  - `internal/db/sqlite.go` — `DB` struct, `Open/Close/Migrate`, `ListLibraries/Sessions/Tabs/Search`
  - `internal/db/migrate.go` — SQL migration runner with embedded SQL files
  - `internal/db/migrations/001_initial.sql` — full schema: all 8 entity tables + FTS5 virtual table
  - `internal/auth/token.go` — shared-secret token: load from disk or generate new
  - `internal/messaging/host.go` — Chrome native messaging host: length-prefixed JSON I/O
  - `Makefile` — build/run/test/vet/tidy/clean targets
  - `.gitignore` — bin/, *.sqlite, token, vendor/
  - `README.md` — build instructions, API table, directory structure, Step 12 registration guide
- **Go 1.26.0** confirmed installed at `C:\Program Files\Go` (via user's `go env`)
- **`companion/bin/mvaultd.exe`** — successfully compiled and smoke-tested (`--version` works)
- `docs/ENVIRONMENT.md` — updated with Go path information

#### Build Verification
```
go vet ./...   → OK (no issues)
go build ./... → OK (no errors)
./bin/mvaultd.exe --version → mvaultd v0.1.0
```

#### Architecture
- Pure Go (no CGo): `modernc.org/sqlite` is a pure-Go SQLite implementation
- REST API on `127.0.0.1:47821` with `X-MindVault-Token` auth
- SQLite at `%APPDATA%\MindVault\db.sqlite` with WAL mode + FK enforcement
- `http.ServeMux` pattern routing (Go 1.22 `{id}` syntax)
- Native messaging stub ready for Step 12 wiring

#### State: Extension 163/163 tests passing; companion builds clean

---

### 2026-02-22 — Session: Comprehensive Documentation Suite + Dev Servers

#### Added
- **`.claude/launch.json`** — Dev server configurations for Claude Code `preview_start`
  - `extension-dev-watch` (port 5173) — vite build --watch
  - `extension-vitest-ui` (port 51204) — Vitest UI for extension tests
  - `shared-vitest-ui` (port 51205) — Vitest UI for shared package tests
  - `companion-rest-api` (port 47821) — placeholder for Go daemon (Step 11)
- **`@vitest/ui@^1.6.1`** — Added to both extension and shared devDependencies
- **`docs/SRS.md`** — Full Software Requirements Specification (FR-TAB/SES/HIS/DL/BM/LIB/ENC/EXP/AUD + NFRs)
- **`docs/ARCHITECTURE.md`** — Layered architecture, data flows, encryption design, companion structure
- **`docs/SETTINGS.md`** — All user-configurable settings with types, defaults, storage locations
- **`docs/ENVIRONMENT.md`** — Developer environment reference, Windows quirks, pnpm workarounds
- **`docs/DBMS-TABLES.md`** — All 8 IndexedDB stores with field types, indexes, example records
- **`docs/ERD.md`** — Entity relationship diagram (ASCII art) + cardinality table
- **`docs/ORD.md`** — Object/module relationship diagram + layering rules + circular dep prevention
- **`docs/SCHEMA.md`** — TypeScript type reference for all interfaces, enums, validators, crypto API
- **`docs/UI-UX-README.md`** — UI/UX design reference: layout, RGYB system, component patterns, a11y
- **`docs/CI-CD-README.md`** — Local quality gates, test suite status, build pipeline, release checklist
- Also previously added: `docs/PLAN.md`, `docs/SYSTEM-DESIGN.md` (from prior session)

#### State: 163/163 tests passing (116 extension + 47 shared), build clean

---

### 2026-02-22 — Session: .mvault Encrypted Backup (Step 10)

#### Added
- **`packages/extension/src/services/mvault.ts`** — Encrypted .mvault backup service
  - `MvaultFile` format: `{ header: { version, salt, iv, libraryId, createdAt }, body: base64-AES-GCM }`
  - `exportMvault(libraryId, password)` — collects all library data, derives PBKDF2 key from
    backup password, encrypts full JSON, triggers `.mvault` file download
  - `importMvault(file, password)` — reads file, derives key, decrypts body, calls `importFromJson`
  - Backup password is completely independent from library's encryption password
- **`dashboard.html`** — Two new rows in Data Management section:
  - "Export Encrypted Backup" → `.mvault` export with password prompt
  - "Import Encrypted Backup" → `.mvault` import with password prompt
- **`docs/SETUP.md`** — Prerequisites, first-time setup, Chrome extension loading, troubleshooting
- **`docs/PROJECT-STRUCTURE.md`** — Annotated directory tree + key architectural patterns
- **`docs/CONFIGURATION.md`** — manifest, vite, tsconfig, encryption params, IDB schema reference
- **`docs/REQUIREMENTS.md`** — FR-01..10 + NFRs + out-of-scope items by phase
- **`docs/DEPENDENCIES.md`** — runtime/dev/planned deps, deliberately excluded packages

#### Modified
- **`dashboard/index.ts`** — `handleExportMvault()` + `handleImportMvault()` handlers

#### State: 116/116 tests passing, build clean (28 modules)

---

### 2026-02-22 — Session: Phase 2 Capture Layer

#### Added
- **`packages/extension/src/background/index.ts`** — Service worker entry point
  - Gets default library on install/update/startup
  - Initialises history and download capture modules
- **`packages/extension/src/background/history-capture.ts`** — Full browser history capture
  - `importAllHistory(libraryId)` — imports all history from epoch (skips if already done)
  - `registerLiveCapture(libraryId)` — chrome.history.onVisited listener for real-time capture
  - Paginated in batches of 500 to avoid memory issues
- **`packages/extension/src/background/download-capture.ts`** — Download metadata capture
  - `importAllDownloads(libraryId)` — imports up to 2000 existing downloads (URL-deduplicated)
  - chrome.downloads.onCreated + onChanged listeners for live capture
  - Stores metadata ONLY (never file content)
- **`packages/extension/src/services/rules-engine.ts`** — History "important" rules
  - `evaluateRule(entry, rule)` — evaluates a single rule against a history entry
  - `applyRules(entry, rules)` — returns true if any enabled rule matches
  - `runRulesEngine(libraryId, rules)` — applies rules to all entries and updates IndexedDB
  - Supports: `visit_count` (gt/gte/lt/lte/eq), `starred`, `tagged`, `domain` (glob), `date_range`
- **`packages/extension/src/db/repositories/history.test.ts`** — 22 tests
  - createHistoryEntry, getHistoryByLibrary (limit), getHistoryByDateRange,
    getHistoryByDate, getImportantHistory, getHistoryById, upsertHistoryEntry (3 cases),
    markHistoryStarred, markHistoryImportant, deleteHistoryEntry, getHistoryCount
- **`packages/extension/src/db/repositories/downloads.test.ts`** — 21 tests
  - createDownload, getDownloadsByLibrary (limit + sort), getDownloadById,
    getDownloadsByMimeType, updateDownloadState, updateDownloadNotes, deleteDownload,
    getDownloadCount, findDownloadByUrl (cross-library isolation)

#### Fixed
- **`getHistoryByLibrary`** — was using broken IDBKeyRange compound key; fixed to simple libraryId index
- **`getDownloadsByLibrary`** — same broken compound-key pattern; fixed the same way
- **`getImportantHistory`** — boolean is not a valid IDB key type; now filters in memory after libraryId index fetch

#### Manifest
- Added permissions: `history`, `bookmarks`, `nativeMessaging`

---

### 2026-02-22 — Session: Dashboard History & Downloads Views

#### Added
- **`dashboard.html`** — History and Downloads nav tabs + full view sections
  - History: date filter pills (All/Today/This Week/★Starred/!Important), table with
    Flags (star/important toggles) / Title / URL / Visits / Last Visit / Actions
  - Downloads: state filter pills (All/Complete/Interrupted), table with
    Filename / Source URL / Size / Type / Downloaded / State / Actions
- **`dashboard.css`** — New styles for both views:
  - `.btn-filter` pill buttons with `.active` state
  - `.flag-star`, `.flag-important` badges with `.off` variant
  - `.state-complete`, `.state-interrupted`, `.state-in_progress` coloured badges
  - Column widths: `.col-flag`, `.col-count`, `.col-size`, `.col-mime`, `.col-state`
  - `.item-count` footer, bookmark item/folder/actions styles
- **`dashboard/index.ts`** — Full wiring for History and Downloads views:
  - `renderHistoryView()`, `renderHistoryRow()`, `applyHistoryFilter()` with date/flag filters
  - `renderDownloadsView()`, `renderDownloadRow()`, `applyDownloadsFilter()` with state filter
  - `formatFileSize()` helper (bytes → B/KB/MB)
  - Star/important toggle buttons wired to `markHistoryStarred` / `markHistoryImportant`
  - Delete buttons for both views wired to repository delete functions
  - Loads 1000 history entries and 500 downloads on startup
- **`docs/progress/session-log-phase2-dashboard.md`** — Session log

#### Reference
- Discovered `SampleFirefoxInterface.png` — Firefox Library-style UI reference showing
  date-grouped navigation, RGYB markers, and visit count column; used to guide History view design

#### State: 104/104 tests passing, build clean (26 modules)

---

### 2026-02-22 — Session: Audit Log Implementation

#### Added
- **`packages/extension/src/db/repositories/audit-log.ts`** — Audit log repository
  - `logAction(params)` — fire-and-forget; errors swallowed so audit never blocks CRUD
  - `getAuditLog(libraryId, limit?)` — newest-first entries for a library (default 500)
  - `getAuditLogByEntity(entityId)` — all entries for a specific entity
  - `getAuditLogCount(libraryId)` — entry count for a library
  - `pruneAuditLog(libraryId, olderThanMs)` — delete old entries, returns deleted count
- **`packages/extension/src/db/repositories/audit-log.test.ts`** — 12 tests
  - logAction: creates entries, stores diffJson, custom actor, multiple actions per entity
  - getAuditLog: sorting, limit, library isolation
  - getAuditLogByEntity: entity filter, unknown entity returns []
  - getAuditLogCount: count increases correctly
  - pruneAuditLog: prunes all / leaves newer intact

#### Modified
- **`saved-tabs.ts`** — `logAction` calls on `saveTabWithDedup` (CREATE/UPDATE) and `deleteTab` (DELETE)
- **`sessions.ts`** — `logAction` calls on `createSession` (CREATE) and `deleteSession` (DELETE)
- **`bookmarks.ts`** — `logAction` calls on `createBookmark` (CREATE) and `deleteBookmark` (DELETE)

#### State: 116/116 tests passing, build clean (27 modules)

#### Stats
- Total extension tests: **104** (up from 61) — all passing
- Build: 24 modules, dist output clean

---

### 2026-02-22 — Session: Encryption Wiring (Step 9)

#### Added
- **`packages/extension/src/services/session-key.ts`** — Shared session key service
  - `setSessionKey(libraryId, key)` / `clearSessionKey(libraryId)` / `getSessionKey(libraryId)`
  - `encryptString(plaintext, key)` — encrypts and JSON-serializes an EncryptedField
  - `decryptString(stored, key)` — detects and decrypts JSON-encoded EncryptedField; falls through for plaintext
  - Replaces the local `sessionKeys` Map that was in `dashboard/index.ts`
  - Consumed by both dashboard UI and repositories without circular dependencies

#### Modified
- **`dashboard/index.ts`** — uses `setSessionKey`/`clearSessionKey`/`getSessionKey` from service; removed local Map and exported getter
- **`saved-tabs.ts`** — `decryptTab` helper decrypts `notes` on read; `updateTabNotes` encrypts before write
- **`sessions.ts`** — `decryptSession` helper decrypts `notes` on read; `createSession` encrypts before write
- **`bookmarks.ts`** — `decryptBookmark` helper decrypts `description` on read; `createBookmark` encrypts before write
- **`downloads.ts`** — `decryptDownload` helper decrypts `notes` on read; `updateDownloadNotes` encrypts before write

#### Design Note
- Entity types (`string`) are unchanged — encrypted fields stored as JSON-serialized `EncryptedField` strings
- Unencrypted libraries: all decrypt helpers return data unchanged (no-op when `getSessionKey` returns null)

#### State: 116/116 tests passing, build clean (28 modules)

---

### 2026-02-22 — Session: Library Switcher UI

#### Added
- **`dashboard.html`** — Library switcher in page header
  - `<select id="librarySelect">` dropdown listing all libraries
  - `<button id="newLibraryBtn">` to create a new library inline
- **`dashboard.css`** — Library switcher styles: `.library-switcher`, `.library-select`, `.btn-new-library`
- **`dashboard/index.ts`** — Library switcher wiring:
  - `getAllLibraries` + `createLibrary` imports
  - `allLibraries: Library[]` state variable
  - `renderLibrarySelect()` — populates `<select>`, default library sorted first
  - `handleLibrarySwitch()` — changes active library and reloads all data
  - `handleNewLibrary()` — prompts for name, creates via repository, switches to it

#### State: 116/116 tests passing, build clean (27 modules)

---

### 2026-02-22 — Session: Library Encryption UI

#### Added
- **`dashboard.html`** — Encryption section in Settings view
  - `<section id="encryptionSection">` with dynamic `<div id="encryptionStatus">` content
- **`dashboard.css`** — Encryption badge styles:
  - `.enc-badge` base, `.locked` (amber), `.unlocked` (green), `.off` (grey)
- **`dashboard/index.ts`** — Full encryption UI wiring:
  - Imports: `generateSalt`, `deriveKey`, `generateKeyVerificationHash`, `verifyPassword`
  - `sessionKeys = new Map<string, CryptoKey>()` — in-memory session keys, never persisted
  - `renderEncryptionStatus()` — renders enable/lock/unlock controls based on library state
  - `handleEnableEncryption()` — password prompt + confirm, derives key, stores salt+hash in library
  - `handleUnlockLibrary()` — verifies password, stores CryptoKey in sessionKeys Map
  - `handleLockLibrary()` — removes key from sessionKeys Map
  - `handleChangePassword()` — unlock old password, set new salt+hash+key
  - `getSessionKey(libraryId)` — exported for repository wiring in next step

#### State: 116/116 tests passing, build clean (27 modules)

---

## [2.0.0] — Phase 1 Complete

### 2026-02-22 — Session: Phase 1 Implementation

#### Added
- **`packages/extension/src/services/import.ts`** — Full JSON backup import service
  - `parseJsonBackup(file)` — reads and validates a File as MindVault JSON backup
  - `importFromJson(backup)` — writes library, sessions, tabs, bookmarks, tags to IndexedDB
  - `validateImportSchema` — re-export of `isValidJsonBackup` for convenience
- **`packages/extension/src/db/repositories/bookmarks.test.ts`** — 16 tests
  - CRUD: create, read by id/url/library, update, delete
  - Tree operations: createFolder, getChildBookmarks, getBookmarkTree
  - incrementBookmarkVisit
- **`packages/extension/src/db/repositories/tags.test.ts`** — 18 tests
  - CRUD: create, read by id/name/library, update, delete
  - Unique name per library (returns existing on duplicate)
  - incrementTagUsage, decrementTagUsage, ensureTagsExist
- **`packages/extension/src/services/import.test.ts`** — 12 tests
  - parseJsonBackup: valid/invalid JSON, missing fields
  - importFromJson: all entity types written correctly
  - JSON roundtrip: export → import → data matches original
- **Bookmarks UI** wired in dashboard/index.ts
  - Flat list with folder grouping
  - Add bookmark (via prompt dialog)
  - Inline description editing
  - Delete bookmark
  - Search/filter bookmarks
- **Import functionality** wired in dashboard/index.ts (Settings > Import)
  - File picker → validation → confirmation → write to IndexedDB → reload UI
- **`@mindvault/shared` now exports validation utilities** (added to index.ts)

#### Fixed
- **`getChildBookmarks(libraryId, null)`** — IndexedDB compound keys don't support null;
  now falls back to filtering all library bookmarks when parentId is null
- **`vitest-indexeddb` removed** — was version ^0.0.4 (doesn't exist on npm);
  `fake-indexeddb` already provides everything needed

#### Stats
- Total tests: 108 (47 shared + 61 extension)
- All tests passing
- Build: 20 modules, dist output clean

---

## [2.0.0-alpha] — Phase 0 Complete

### Summary
Monorepo initialized, TypeScript migration complete, Vite build pipeline set up.
48 files, 4124 LOC. Extension builds and loads identically to v1.1.

- pnpm workspace with @mindvault/shared and @mindvault/extension packages
- TypeScript migration of popup.js and dashboard.js
- IndexedDB schema v2 with all 9 object stores
- V1.1 → V2 migration script (zero data loss, 15 tests)
- RGYB system preserved exactly (35 tests)
- Date parsing utilities (12 tests)
- WebCrypto encryption and key derivation modules
- All 8 repository files (libraries, sessions, saved-tabs, bookmarks, history, downloads, tags, audit-log)
- Export service (CSV, JSON, HTML, Netscape bookmarks)
- ESLint + Prettier configured
- Vite + @samrum/vite-plugin-web-extension for MV3 builds
