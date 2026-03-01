# MindVault — Solved Issues Log
_Resolved bugs, build failures, and configuration problems._

---

## [SOLVED-001] Extension "Could not load manifest" on Chrome/Edge
**Date resolved:** 2026-02-24
**Severity:** Critical — extension could not be loaded at all
**Symptom:** Chrome/Edge showed: `Failed to load extension — Could not load options page
'src/dashboard/dashboard.html'. Could not load manifest.`
**Root cause:** `manifest.json` used `"options_page"` (MV2 legacy field). The Vite plugin
`@samrum/vite-plugin-web-extension` v5.1.1 only processes `options_ui.page` for MV3.
The dashboard was silently excluded from the build output.
**Fix:** Changed manifest field:
```json
// Before (MV2 legacy — ignored by plugin):
"options_page": "src/dashboard/dashboard.html"

// After (MV3 standard — processed correctly):
"options_ui": {
  "page": "src/dashboard/dashboard.html",
  "open_in_tab": true
}
```
**Commit:** `1b1cbcd`
**Files changed:** `packages/extension/manifest.json`

---

## [SOLVED-002] Extension background errors on every startup (DataError)
**Date resolved:** 2026-02-24
**Severity:** High — background service worker threw unhandled promise rejections on load
**Symptom:** Two `DataError: Failed to execute 'only' on 'IDBKeyRange': The parameter is
not a valid key` errors in the extension's service worker DevTools console on every startup.
**Root cause:** `getDefaultLibrary()` in `libraries.ts` called `IDBKeyRange.only(true)`.
Booleans are not valid IndexedDB keys. The error was uncaught and prevented correct
initialization of the active library context.
**Fix:** Replaced index query with `getAll()` + in-memory filter:
```typescript
// Before (throws DataError):
const result = await promisifyRequest<Library | undefined>(
  index.get(IDBKeyRange.only(true))
);

// After (safe):
const all = await promisifyRequest<Library[]>(store.getAll());
return all.find(lib => lib.isDefault === true) ?? null;
```
**Commit:** `b18f5f9`
**Files changed:** `packages/extension/src/db/repositories/libraries.ts`
**Pattern note:** Never use `IDBKeyRange.only(boolean)` or `IDBKeyRange.only(null)`.
Use `getAll()` + `.filter()` in memory for boolean/null fields.

---

## [SOLVED-003] dotnet build NETSDK1004 — assets file not found
**Date resolved:** 2026-02-24
**Severity:** Medium — MAUI project would not build
**Symptom:** `error NETSDK1004: Assets file 'desktop\obj\project.assets.json' not found.`
**Root cause:** `dotnet build --no-restore` was run before `dotnet restore` had generated
the NuGet assets file.
**Fix:** Run `dotnet restore` first, then `dotnet build`.
**Workaround:** Use `C:\Temp\build-maui.bat` which always runs restore before build.

---

## [SOLVED-004] MAUI CS0104 — Tab type ambiguity
**Date resolved:** 2026-02-24
**Severity:** Medium — MAUI build failed with 4 errors
**Symptom:** `error CS0104: 'Tab' is an ambiguous reference between
'MindVault.Desktop.Models.Tab' and 'Microsoft.Maui.Controls.Tab'`
**Root cause:** Both `MindVault.Desktop.Models` and `Microsoft.Maui.Controls` define a
type named `Tab`. The compiler could not resolve which one to use.
**Fix:** Added using alias in affected files:
```csharp
using MvTab = MindVault.Desktop.Models.Tab;
// Then use MvTab instead of Tab in type declarations
```
**Files changed:** `desktop/Services/CompanionApiClient.cs`, `desktop/ViewModels/TabsViewModel.cs`
**Commit:** `1b1cbcd`

---

## [SOLVED-005] .gitignore wrong paths for companion and MAUI
**Date resolved:** 2026-02-24
**Severity:** Low — build artifacts could be accidentally committed
**Symptom:** `.gitignore` had `packages/companion/bin/` and `packages/desktop/**/bin|obj/`
but the actual directories are `companion/bin/` and `desktop/bin|obj/`.
**Fix:** Updated `.gitignore`:
```
companion/bin/          (was: packages/companion/bin/)
companion/*.exe
desktop/bin/            (was: packages/desktop/**/bin/)
desktop/obj/
desktop/**/bin/
desktop/**/obj/
```
**Commit:** `1b1cbcd`

---

## [SOLVED-006] PowerShell cannot run dotnet / node with && separator
**Date resolved:** 2026-02-24
**Severity:** Low — development tooling issue
**Symptom:** `&&` is not a valid statement separator in Windows PowerShell.
Commands like `cd path && dotnet build` fail.
**Fix:** Use `;` in PowerShell, or write bat files for cmd.exe, or use full executable
paths. Created helper bat files in `C:\Temp\` for all common operations.

---

## [SOLVED-007] Go search API: wrong query parameter name
**Date resolved:** 2026-02-23 (Phase 2 Step 16)
**Severity:** Medium — search endpoint returned empty results
**Symptom:** `GET /search?libraryId=...` returned no results
**Root cause:** The handler reads `libId` not `libraryId` from query params.
**Fix:** Changed test to use `?libId=` matching the router implementation.
**Files changed:** `companion/internal/api/api_test.go`

---

## [SOLVED-008] Extension dist/ missing dashboard after build
**Date resolved:** 2026-02-24
**Symptom:** After `npx vite build`, `dist/src/dashboard/` was absent even though source
existed at `src/dashboard/dashboard.html`.
**Root cause:** Same as SOLVED-001 — `options_page` field not recognised by plugin.
**Fix:** Same as SOLVED-001 — use `options_ui.page`.

---

## [SOLVED-010] Companion had no POST/CREATE endpoints (ISSUE-004)
**Date resolved:** 2026-02-24 (session 2)
**Severity:** High — MAUI desktop app and extension sync could not create new data via companion
**Symptom:** `POST /libraries`, `POST /libraries/{libId}/sessions`, `POST /libraries/{libId}/tabs`
all returned 404 or 405 because no handlers were registered for POST methods on those routes.
**Root cause:** Phase 3 Step 2 not yet started — handlers.go only had GET + DELETE stubs.
**Fix:** Added to `companion/internal/api/handlers/handlers.go`:
```go
func generateID() string {
    b := make([]byte, 16)
    _, _ = rand.Read(b)
    return hex.EncodeToString(b)
}
// + CreateLibrary, CreateSession, CreateTab handlers with full validation
```
Routes were already registered in `server.go` (from scaffold). 9 new tests added and all pass.
**Commit:** `7535754`
**Files changed:** `companion/internal/api/handlers/handlers.go`, `companion/internal/api/api_test.go`
**Test count after fix:** 27 Go tests (19 API + 8 DB), all passing.

---

## [SOLVED-011] Extension reports DataError from stale build (session-key-C_sSGCB7.js)
**Date resolved:** 2026-02-24 (session 2, diagnosis only — no code change needed)
**Severity:** Confusing — appeared to be a new bug but was a stale extension build
**Symptom:** Chrome extension error panel showed:
`Uncaught (in promise) DataError: Failed to execute 'only' on 'IDBKeyRange':
The parameter is not a valid key. Context: assets/session-key-C_sSGCB7.js`
**Root cause:** The user was running an OLD build of the extension. The chunk filename
`session-key-C_sSGCB7.js` corresponds to a build BEFORE the `getDefaultLibrary` fix
(commit `b18f5f9`). The current dist folder contains `session-key-1X34z0LP.js` which
has the fix compiled in. Vite content-hashes chunk names, so a different hash = different
build = stale files still loaded.
**Diagnosis:** Read `dist/assets/session-key-1X34z0LP.js` and confirmed no `IDBKeyRange.only`
calls present. The `getDefaultLibrary` in the current build uses `getAll()` + `.find()`.
**Fix:** No code change. User must reload the extension:
1. Open `chrome://extensions`
2. Click the 🔄 reload button on the MindVault card
3. Click "Clear all" to dismiss old errors
**Pattern note:** After any extension rebuild, always reload the extension in the browser.
The old chunk files are still on disk but Chrome continues serving the cached version until
explicitly reloaded.

---

## [SOLVED-012] Firefox "add-on is corrupt" + missing dashboard (ISSUE-009)
**Date resolved:** 2026-02-24 (session 3)
**Severity:** High — Firefox could not load the extension at all
**Symptom 1:** `about:debugging` → "Load Temporary Add-on" → "The add-on appears to be corrupt"
when pointing at `manifest-firefox.json` in the source folder.
**Symptom 2:** Even after a fresh build, the Firefox `dist-firefox/` was missing the dashboard
entirely (`src/dashboard/` not present in output).
**Root cause (corrupt error):** The old setup guide said to select `manifest-firefox.json`
from the *source* folder. That manifest references `src/background/index.ts` (TypeScript).
Firefox cannot execute `.ts` files — it sees unresolvable script references and reports
the add-on as corrupt.
**Root cause (missing dashboard):** `manifest-firefox.json` used `"options_page"` (legacy
field). The `@samrum/vite-plugin-web-extension` only processes `"options_ui.page"` — so
the dashboard entry point was silently skipped during the build, same root cause as SOLVED-001.
**Fix:**
1. Changed `manifest-firefox.json`:
   ```json
   // Before:
   "options_page": "src/dashboard/dashboard.html"
   // After:
   "options_ui": { "page": "src/dashboard/dashboard.html", "open_in_tab": true }
   ```
2. Created `vite.config.firefox.ts` — uses `manifest-firefox.json`, outputs to `dist-firefox/`
3. Added `build:firefox` script to `packages/extension/package.json`
4. Fixed `docs/SETUP.md` Firefox section — load `dist-firefox/manifest.json`, never source
**Result:** Firefox build now outputs 40 modules including `src/dashboard/dashboard.html` (9.43 kB).
**Files changed:**
- `packages/extension/manifest-firefox.json`
- `packages/extension/vite.config.firefox.ts` (new)
- `packages/extension/package.json`
- `docs/SETUP.md`

---

## [SOLVED-009] Companion installer — Unicode characters break PowerShell parsing
**Date resolved:** 2026-02-24
**Severity:** Low — full installer script failed to run
**Symptom:** Running `install-windows.ps1` via `powershell.exe -File` produced parse errors
because Unicode characters (`✓`, `►`, `✗`) in the script were misinterpreted by
Windows PowerShell's default ANSI code page when launched from cmd.exe.
**Fix:** Created simplified `C:\Temp\install-mv-companion.ps1` using only ASCII characters
and single-quoted strings.

---

## [SOLVED-013] Firefox popup shows empty tab list
**Date resolved:** 2026-02-25 (session 4)
**Severity:** High — core popup feature broken in Firefox
**Symptom:** Opening the MindVault popup in Firefox showed an empty tab list. Clicking
"Save All Tabs" saved 0 tabs. No error was shown.
**Root cause 1 — wrong window context:**
`chrome.tabs.query({ currentWindow: true })` in a Firefox MV2 `browser_action` popup
resolves `currentWindow` to the popup's own window context (which has 0 tabs), not the
browser window. Chrome MV3 resolves it correctly to the browser window.
**Root cause 2 — missing host permissions:**
Firefox requires `"*://*/*"` in `permissions` to reliably expose `tab.url` and `tab.title`
even when `"tabs"` permission is present. Without it, `tab.url` can be `undefined`.
**Fix:**
```typescript
// Before (broken in Firefox):
const tabs = await chrome.tabs.query({ currentWindow: true });

// After (cross-browser safe):
import browser from 'webextension-polyfill';
const tabs = await browser.tabs.query({ lastFocusedWindow: true });
```
Also added `"*://*/*"` and `"file:///*"` to `manifest-firefox.json` permissions,
and extended the internal-URL filter in `handleSave()` to cover all browser-specific
schemes: `moz-extension://`, `edge://`, `opera://`, `brave://`, `vivaldi://`.
**Commits:** `481f662`
**Files changed:**
- `packages/extension/src/popup/index.ts`
- `packages/extension/manifest-firefox.json`

---

## [SOLVED-015] Companion web UI served stale assets after binary update (SW cache freeze)
**Date resolved:** 2026-02-28 (session 5)
**Severity:** Critical — UI appeared broken after every binary update; users saw old layout
**Symptom:** After installing the updated `mvaultd.exe` binary (v4.1.0 / v4.2.0), the
companion web UI at `http://127.0.0.1:47821/ui/` still showed the OLD layout — only 3 nav
buttons (Libraries, Search, Settings), no theme switcher, no All Sessions / All Tabs panels.
Force-refreshing the page showed the new `index.html` (5 nav buttons visible) but `app.js`
and `style.css` were still served from the service-worker cache, causing a partial mismatch.
**Root cause 1 — SW cache-first strategy with static key:**
`sw.js` had `const CACHE_NAME = 'mv-ui-v1'`. The service worker uses a cache-first strategy:
on every request it checks the cache first and returns the cached response without touching
the network. Because `CACHE_NAME` never changed, the SW never evicted the old `app.js` /
`style.css` and served them indefinitely even after the binary was rebuilt.
**Root cause 2 — No `Cache-Control` headers on Go file server:**
`http.FileServer(http.FS(uiFS))` sends no `Cache-Control` header, so browsers apply
heuristic caching (typically a percentage of the `Last-Modified` age) and cache assets
aggressively, compounding the SW issue.
**Fix 1 — Bump `CACHE_NAME` in `sw.js`:**
```js
// Before:
const CACHE_NAME = 'mv-ui-v1';
// After:
const CACHE_NAME = 'mv-ui-v4';  // bumped 2026-02-28 to bust stale v1/v2/v3 caches
```
When the browser fetches the new `sw.js` (which is never cached by SW, only by HTTP),
it detects a byte-level change, installs the new SW, and the `activate` event handler
deletes all caches that don't match `mv-ui-v4`.
**Fix 2 — `noCacheUI` middleware in `server.go`:**
```go
func noCacheUI(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "no-cache, must-revalidate")
        next.ServeHTTP(w, r)
    })
}
// In NewRouter:
mux.Handle("/ui/", noCacheUI(http.StripPrefix("/ui/", http.FileServer(http.FS(uiFS)))))
```
**Files changed:**
- `companion/internal/api/ui/sw.js` — `CACHE_NAME` bump
- `companion/internal/api/server.go` — `noCacheUI` middleware

---

## [SOLVED-014] Companion CORS blocks Firefox extension sync
**Date resolved:** 2026-02-25 (session 4)
**Severity:** High — Firefox extension could not push data to companion
**Symptom:** Firefox extension `companion-client.ts` calls to `http://127.0.0.1:47821`
were blocked by the browser with a CORS error. The extension origin is `moz-extension://`
but the companion only allowed `chrome-extension://` origins.
**Fix:** Updated `corsMiddleware` in `server.go` to allow all extension origins:
```go
// Before:
w.Header().Set("Access-Control-Allow-Origin", "chrome-extension://*")

// After: reflect origin header for allowed schemes
if strings.HasPrefix(origin, "chrome-extension://") ||
    strings.HasPrefix(origin, "moz-extension://") ||
    strings.HasPrefix(origin, "safari-extension://") ||
    strings.HasPrefix(origin, "http://127.0.0.1") ||
    strings.HasPrefix(origin, "http://localhost") ||
    origin == "null" {
    w.Header().Set("Access-Control-Allow-Origin", origin)
}
```
**Commit:** `fa0ea80`
**Files changed:** `companion/internal/api/server.go`

---

## [SOLVED-016] Sessions saved offline not visible in companion (ISSUE-011)
**Date resolved:** 2026-03-01 (v4.4.0)
**Severity:** Medium — sessions saved without daemon were invisible to companion UI
**Root cause:** Extension pushes sessions to companion SQLite via REST (fire-and-forget). If daemon was offline, the push silently failed and IndexedDB and SQLite diverged permanently.
**Fix (5 files):**
1. `companion/internal/db/sqlite.go` — `INSERT OR IGNORE` for sessions + tabs (idempotent)
2. `packages/shared/src/types/entities.ts` — `Session.syncedToCompanion?: boolean`
3. `packages/extension/src/db/repositories/sessions.ts` — `markSessionSynced(id)` function
4. `packages/extension/src/services/companion-client.ts` — `pushSession()` → `boolean`; added `syncAllUnpushedSessions()` that scans all IDB libs/sessions, pushes unsynced ones + tabs, marks synced
5. `packages/extension/src/background/index.ts` — calls `syncAllUnpushedSessions()` on every service-worker startup after companion bootstrap
**Result:** Any session saved while daemon was offline is pushed automatically on next browser/extension restart.
