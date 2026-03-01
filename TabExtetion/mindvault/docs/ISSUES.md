# MindVault — Known Open Issues
_Last updated: 2026-03-01 (v4.4.0)_

---

## [ISSUE-011] Custom sessions / libraries from extension not visible in companion UI
**Status:** ✅ FIXED — v4.4.0 (2026-03-01) — see SOLVED_ISSUES.md SOLVED-016
**Fix:** `syncAllUnpushedSessions()` runs on every daemon reconnect; `INSERT OR IGNORE` ensures idempotency.
`Session.syncedToCompanion` flag prevents duplicate pushes.

---

## [ISSUE-010] Firefox popup shows empty tab list (tabs not detected)
**Status:** ✅ RESOLVED — see SOLVED_ISSUES.md SOLVED-013
**Severity:** High — core popup feature broken in Firefox
**Resolved:** 2026-02-25 (session 4) — commit `481f662`

---

## [ISSUE-001] Companion daemon not auto-started on Windows login
**Status:** Open
**Severity:** Medium — user must manually start daemon after reboot
**Description:** The companion installer registers native messaging for Chrome/Edge/Brave/
Opera/Vivaldi but does NOT set up a Task Scheduler job. After a system reboot, `mvaultd.exe`
is not running and the extension cannot sync and `http://127.0.0.1:47821/ui` is unreachable.
**Workaround:** Run `Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden`
**Planned fix:** Phase 3 Step 11 — Task Scheduler auto-start in installer.

---

## [ISSUE-002] Native messaging wildcard origin (dev only)
**Status:** Open (dev limitation — not a bug)
**Severity:** Low
**Description:** The companion's `com.mindvault.companion.json` manifest uses
`"allowed_origins": ["chrome-extension://*/"]` which allows ANY extension to call
the native host. This is fine for development but must be replaced with the real
extension ID before production distribution.
**To fix after Chrome loads extension:**
1. Note the 32-char extension ID from `chrome://extensions`
2. Re-run: `.\tools\install-companion\install-windows.ps1 -ExtensionId <ID>`
**Planned fix:** Phase 3 packaging — use real extension ID in signed builds.

---

## [ISSUE-003] Extension popup — no visual feedback when companion not running
**Status:** Open
**Severity:** Low — UX issue
**Description:** If the companion daemon is not running, the popup silently fails to
show libraries/sessions synced via the companion. There is no "companion offline" indicator.
**Planned fix:** Phase 3 Step 6 — UI polish: show status indicator in popup.

---

## [ISSUE-004] MAUI app — no data visible (companion POST endpoints not implemented)
**Status:** ✅ RESOLVED — see SOLVED_ISSUES.md SOLVED-010
**Severity:** High — MAUI app is scaffold only
**Resolved:** 2026-02-24 (session 2) — commit `7535754`
**Description:** POST /libraries, /sessions, /tabs now fully implemented in companion.
27 Go tests pass (19 API + 8 DB).

---

## [ISSUE-005] Firefox extension build not automated
**Status:** ✅ RESOLVED — see SOLVED_ISSUES.md SOLVED-012
**Resolved:** 2026-02-24 (session 3) — `build:firefox` script + `vite.config.firefox.ts`

---

## [ISSUE-006] Extension does not capture tabs from other browser profiles
**Status:** Open (by design — same origin policy)
**Severity:** Informational
**Description:** The extension can only access IndexedDB and browser APIs within its own
browser profile. Tabs from other Chrome profiles are not captured.
**Design decision:** Cross-profile sync is handled by the companion daemon (SQLite shared
storage), planned for Phase 3 Step 3 (import/export bridge).

---

## [ISSUE-007] MAUI app — Platforms/Android, iOS, Tizen stubs present
**Status:** Open (cosmetic — not a bug)
**Severity:** Informational
**Description:** The MAUI project was scaffolded with `dotnet new maui` which creates entry
points for Android, iOS, MacCatalyst, and Tizen. These are non-functional stubs.
Only `Platforms/Windows/` is intended for Phase 3.
**Planned fix:** Phase 3 completion — remove non-Windows platforms from csproj or
leave as future platform expansion targets.

---

## [ISSUE-008] Vitest UI server (port 51204) stops after test run
**Status:** Open (by design)
**Severity:** Informational
**Description:** `npx vitest run` (one-shot mode) briefly starts a UI server at
`localhost:51204/__vitest__/` but closes it when tests finish. Navigating to that URL
after tests complete shows a 404.
**Expected behaviour:** This is correct. To keep UI alive: use `npx vitest --ui`
(without `run` flag) which starts an interactive watch server.

---

## [ISSUE-009] Firefox build not producing dashboard (options_page not processed)
**Status:** ✅ RESOLVED — see SOLVED_ISSUES.md SOLVED-012
**Severity:** High — Firefox extension loaded with no dashboard
**Resolved:** 2026-02-24 (session 3)
**Description:** `manifest-firefox.json` used `options_page` which the Vite plugin ignores
(same as SOLVED-001 for Chrome). Fixed by switching to `options_ui.page`. Also, the old
setup guide instruction to "load manifest-firefox.json from source" caused a "corrupt add-on"
error in Firefox because source files are TypeScript — Firefox cannot run .ts files directly.
Both issues resolved by adding `vite.config.firefox.ts` and a correct build step.

---

## Template for new issues

```
## [ISSUE-NNN] Short title
**Status:** Open / In Progress / Blocked
**Severity:** Critical / High / Medium / Low / Informational
**Description:** What is broken and in what context.
**Steps to reproduce:** (if applicable)
**Workaround:** (if any)
**Planned fix:** Which phase/step will address this.
```
