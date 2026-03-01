# MindVault — AI Context FAQ
_Reference for AI assistants (Claude etc.) resuming work on this project._
_Last updated: 2026-02-26_

---

## What is this project?

MindVault is a personal knowledge vault browser extension + companion system.
It saves, tracks and manages tabs, bookmarks, history and downloads across all major browsers
(Chrome, Edge, Firefox, Brave, Vivaldi, Opera, Chromium).
Built as a pnpm monorepo: TypeScript extension (MV3/MV2) + Go companion daemon.
Companion serves a full web dashboard at `http://127.0.0.1:47821/ui/` (PWA-installable).

---

## What phase are we in?

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | COMPLETE (v2.0.0-alpha) | IndexedDB schema, RGYB, basic extension |
| 1 | COMPLETE (v2.0.0) | Full dashboard, history capture, export/import |
| 2 | COMPLETE (v3.0.0) | Encryption, companion daemon, installer, Firefox, E2E tests |
| 3 | **IN PROGRESS** | Companion web dashboard UI + all-browser support |
| 4 | Planned | Bookmarks/History/Downloads push pipeline (extension → companion DB) |

---

## Where are the key files?

| What | Where |
|------|-------|
| Master plan | `docs/PLAN.md` |
| Changelog | `CHANGELOG.md` |
| Latest session log | `docs/progress/session-2026-02-25.md` (session 4) |
| Installation guide | `docs/INSTALLATION_GUIDE.md` |
| Test runner (TS) | `C:\Temp\run-extension-tests.bat` |
| Build extension | `C:\Temp\build-extension.bat` |
| Build Firefox ext | `C:\Temp\build-firefox.bat` |
| Build companion | `C:\Temp\build-companion.bat` |
| Install companion | `C:\Temp\install-mv-companion.ps1` |

---

## What tools / executables are used on this machine?

| Tool | Path |
|------|------|
| Node.js | `E:\Program Files\nodejs\node.exe` |
| npx | `E:\Program Files\nodejs\npx.cmd` |
| Go | `C:\Program Files\Go\bin\go.exe` |
| dotnet | `C:\Program Files\dotnet\dotnet.exe` |
| pnpm | Broken shell wrapper — use `node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs"` |

**PowerShell PATH note:** `dotnet` and `node` are NOT on the default PowerShell PATH in
Claude Code's shell environment. Always use full paths or run via bat files in `C:\Temp\`.

**Shell separator note:** PowerShell does NOT support `&&`. Use `;` or bat files.

---

## What are the test counts?

- **116 TypeScript tests** (extension: repositories, services, migrations)
- **27 Go tests** (companion: 8 DB-level + 10 API httptest + 9 additional)
- **Total: 143 tests, 0 failures** as of 2026-02-26

Run with: `C:\Temp\run-extension-tests.bat` and `cd companion && go test ./...`

---

## What are the critical "gotcha" patterns?

### 1. IDBKeyRange.only(boolean) — NEVER DO THIS
```typescript
// WRONG — throws DataError at runtime:
index.get(IDBKeyRange.only(true))

// CORRECT — fetch all, filter in memory:
const all = await promisifyRequest<Library[]>(store.getAll());
return all.find(item => item.isDefault === true) ?? null;
```
Booleans and null are NOT valid IndexedDB keys. Same applies to null values.

### 2. Tab type alias in MAUI
```csharp
// REQUIRED in any file using Models.Tab — MAUI also has a Tab type:
using MvTab = MindVault.Desktop.Models.Tab;
```

### 3. logAction is fire-and-forget
```typescript
void logAction({ ... });  // NOT: await logAction(...)
```

### 4. promisifyRequest import path
```typescript
import { promisifyRequest } from '../index';  // NOT from './utils'
```

### 5. Extension rebuild required after source changes
After editing any source file in `packages/extension/src/`, run:
`C:\Temp\build-extension.bat` then reload the extension in Chrome.

### 6. getSessionKey location
```typescript
// Lives in services/session-key.ts — NOT in dashboard/index.ts
import { getSessionKey } from '../services/session-key';
```

---

## What does the companion daemon do?

- REST API on `http://127.0.0.1:47821` (binds localhost only)
- **Web dashboard** served at `/ui/` (Go `embed` — HTML/CSS/JS baked into binary)
  - Libraries → Sessions → Tabs browsing
  - Global search across all libraries (`/search?q=&libId=`)
  - Settings panel with companion status + install instructions
  - PWA manifest — installable as desktop app from Chrome/Edge
- Endpoints: `/health`, `/token`, `/libraries`, `/libraries/:id/sessions`,
  `/libraries/:id/tabs`, `/search`, `/ui/*`
- Auth: `X-MindVault-Token` header (token stored at `%LOCALAPPDATA%\MindVault\token`)
- Storage: SQLite at `%APPDATA%\MindVault\db.sqlite`
- Native messaging: registered for all detected browsers (Chrome, Edge, Brave, Firefox, Opera, Vivaldi)

---

## What is the RGYB system?

RGYB is a repeat-visit indicator on saved tabs based on `repeatCount`:
- **R** (Red) = 1 save, `#e74c3c` — seen once
- **G** (Green) = 2-4 saves, `#2ecc71` — returning visitor
- **Y** (Yellow) = 5-9 saves, `#f1c40f` — frequent
- **B** (Blue) = 10+ saves, `#3498db` — very frequent

Logic in `@mindvault/shared/utils/rgyb.ts`.

---

## What encryption is used?

- **Key derivation:** PBKDF2-SHA256 (100k iterations) from user password + salt
- **Encryption:** AES-256-GCM (12-byte IV, per-field)
- **Storage:** `JSON.stringify({ ct: base64, iv: base64 })` in the IDB field
- **Detection on read:** If stored value parses as `{ ct, iv }` → decrypt; else → return as-is

---

## How is the extension structured for Chrome?

- **Manifest Version:** 3 (Chrome/Edge), 2 (Firefox)
- **Background:** Service Worker (`serviceWorker.js`)
- **Popup:** `src/popup/popup.html` → `action.default_popup`
- **Dashboard:** `src/dashboard/dashboard.html` → `options_ui.page` (opens in full tab)
- **Permissions:** tabs, storage, downloads, history, bookmarks, nativeMessaging

---

## What should I do when starting a new session?

1. Read `MEMORY.md` (in `.claude/projects/.../memory/`)
2. Read `docs/PLAN.md` — check current phase + next step
3. Read latest `docs/progress/session-*.md`
4. Read `CHANGELOG.md` top section (Unreleased)
5. Run tests to confirm baseline: `C:\Temp\run-extension-tests.bat`
6. Continue from PLAN.md next step

---

## What are the standing user instructions?

The user always wants:
- Frequent updates to CHANGELOG.md after each meaningful change
- All reference docs kept up to date (PLAN, ARCHITECTURE, SRS, SETUP, PROJECT-STRUCTURE, etc.)
- Session log written at end of each session (`docs/progress/session-YYYY-MM-DD.md`)
- Everything done in small, committed steps
- Ask clarifying questions before big/complex/destructive actions
- RGYB system preserved exactly as designed
- No React/Tailwind — vanilla TS + HTML for extension and web
- Always shippable — each phase must deliver real user value
