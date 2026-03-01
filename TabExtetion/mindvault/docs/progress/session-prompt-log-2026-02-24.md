# Session Prompt Log — 2026-02-24
_Key user instructions and AI responses that drove decisions this session._

---

## User Prompts (chronological)

### 1. Session start (resumed from previous)
> "Continue from where you left off."

Context: Phase 3 MAUI scaffold was in progress. Build had failed with NETSDK1004.
Action: Cleaned up `MainPage.xaml` (orphaned template), ran `dotnet restore`, attempted build.

---

### 2. Project structure concern + extension install request
> "look at ur project structure, folders files is everything properly situated. i see many
> folders with same names. should not i be able to load and or install my Browser tab
> extension on my browsers and also install the Companion app? make it happen first,
> gib me instructions to install them. where are they, how, what to install, where?"

Action taken:
- Investigated extension dist/ — found `src/dashboard/dashboard.html` missing from build
- Root cause: `manifest.json` used `options_page` (MV2) not `options_ui.page` (MV3)
- Fixed manifest, rebuilt extension (39 modules, dashboard now included)
- Built companion binary: `companion/bin/mvaultd.exe`
- Installed companion to `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`
- Registered Chrome + Edge native messaging (HKCU)
- Started daemon — confirmed `{"status":"ok","version":"0.1.0"}` on port 47821
- Explained project structure (Platforms/ and Resources/ are MAUI boilerplate, not duplicates)

---

### 3. MAUI build continuation
> [User had asked about structure. Build was unfinished. Continued automatically.]

Action: Completed MAUI build after fixing CS0104 Tab ambiguity with `MvTab` alias.
Result: `dotnet build` — 0 errors, 0 warnings, 19.18s.

---

### 4. Standing instructions (repeated)
> "Also frequently update changelog and references files and also make Plan, System-Design,
> Architecture, SRS, setup, settings, environment, virtual-environment, projector-structure,
> configuration, DBMS Tables, ERD, ORD, Schema UI_UX-readme, CI_CD-Readme, requirements and
> dependencies files for references. Read the files in the folders and carry on with what i
> and or u were doing and have done so far. carry out the plan and maintain a change log and
> task list and completed tasks and todo list and carry out everything in small steps and
> complete small tasks before u run out of usage token limit. Create a summary file of logs
> of what was done in current session too. Ask clarifying questions before carrying out big
> and or long and or complex actions."

Action: Committed Phase 3 Step 1 + extension fix (54 files, 2006 insertions). Updated
CHANGELOG, session log, MEMORY.md.

---

### 5. Companion port 47821 error explanation
> "[Screenshot: PowerShell showing 'Only one usage of each socket address' error + 404 on root]"

User tried to run `mvaultd.exe` manually when it was already running.
Explained: "Only one usage" = port already taken = daemon already running. That's correct.
Root `http://127.0.0.1:47821` → 404 = expected, use `/health` endpoint.

---

### 6. Extension DataError at runtime
> "[Pasted console errors: DataError: Failed to execute 'only' on 'IDBKeyRange':
> The parameter is not a valid key]"

Action:
- Traced error to `getDefaultLibrary()` in `libraries.ts` using `IDBKeyRange.only(true)`
- Booleans are not valid IDB keys — this was a pre-existing bug
- Fixed with `getAll()` + in-memory filter pattern
- Rebuilt extension, ran 116 tests — all passing
- Committed `b18f5f9`

---

### 7. Vitest UI 404
> "[Screenshot: localhost:51204/__vitest__/ showing 404]"

Explained: Vitest UI server only runs while `vitest run` is active. After tests complete
the server stops. This is expected behaviour — not an error.

---

### 8. Final doc update request
> "If possible also create files with session prompt log and chat prompt logs.
> Also frequently update changelog and references files and also make Plan, System-Design,
> Architecture, SRS, setup, settings, environment, virtual-environment, projector-structure
> with files and folders details list, configuration, DBMS Tables, ERD, ORD, Schema
> UI_UX-readme, Ai_FAQ, Issues, Solved_issues, CI_CD-Readme, requirements and dependencies
> files for references."

Action: Created/updated all reference docs (see below).

---

## Documents Created/Updated This Session

| Document | Action | Notes |
|----------|--------|-------|
| `docs/PROJECT-STRUCTURE.md` | Updated | Added companion, desktop, tools, dist structure |
| `docs/SETUP.md` | Updated | Full install guide: extension, companion, MAUI |
| `docs/ISSUES.md` | Created | 8 known open issues |
| `docs/SOLVED_ISSUES.md` | Created | 9 resolved issues with root cause + fix |
| `docs/AI_FAQ.md` | Created | Context reference for AI assistants |
| `docs/progress/session-2026-02-24.md` | Created | Session summary log |
| `docs/progress/session-prompt-log-2026-02-24.md` | Created | This file |
| `CHANGELOG.md` | Updated | [Unreleased] section with all changes |
| `MEMORY.md` | Updated | Phase 3 state, new key patterns |

---

## Key Decisions Made

1. **`options_ui` over `options_page`** — MV3 standard; required by vite-plugin-web-extension v5
2. **In-memory filter for boolean IDB queries** — `IDBKeyRange.only(boolean)` is invalid
3. **`MvTab` alias** — resolves `Tab` type conflict between MAUI and our Models namespace
4. **Wildcard native messaging origin** — for dev only; must be replaced with real extension ID
5. **Bat files in `C:\Temp\`** — works around PowerShell PATH and `&&` separator limitations
