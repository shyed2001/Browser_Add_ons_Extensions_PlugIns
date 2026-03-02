<!--
  MASTER_FILE_INDEX.md
  ====================
  | Section         | Description                              |
  |-----------------|------------------------------------------|
  | Docs Index      | All /docs/*.md files, purpose, audience  |
  | Source Index    | Key source files per package             |
  | Config Index    | Config/manifest/build files              |
  | Log Index       | Progress/session logs                    |

  Why  : Single navigation point for all project files.
  What : Compact reference table — name, purpose, audience, status.
  How  : Append new rows when files are added; do NOT duplicate content.
  When : Updated each session that adds/changes key files.
  Who  : Devs, AI assistants, DevOps, new contributors.
-->

# MindVault — Master File Index

> **DRY rule**: This file lists files. Content lives in each file itself.
> **Last updated**: 2026-03-01 (v4.4.0)

---

## /docs — Reference Documentation

| File | What | Audience | Status |
|------|------|----------|--------|
| PLAN.md | Phase roadmap, step table, test counts | Dev/AI | ✅ Current |
| ARCHITECTURE.md | System components, data flow, decisions | Dev/AI | ✅ |
| SYSTEM-DESIGN.md | Detailed design: layers, patterns, interfaces | Dev | ✅ |
| SRS.md | Software Requirements Specification | PM/Dev | ✅ |
| SETUP.md | Dev environment setup, build commands | Dev/DevOps | ✅ |
| ENVIRONMENT.md | Env vars, paths, OS-specific config | Dev/DevOps | ✅ |
| SETTINGS.md | Runtime settings, user preferences | Dev/User | ✅ |
| CONFIGURATION.md | Build/runtime config files catalogue | Dev | ✅ |
| REQUIREMENTS.md | Functional + non-functional requirements | PM/Dev | ✅ |
| DEPENDENCIES.md | npm/Go deps, versions, why each is used | Dev | ✅ |
| DBMS-TABLES.md | SQLite + IndexedDB table definitions | Dev/DBA | ⚠️ Needs BM/Hist/DL rows |
| ERD.md | Entity-Relationship Diagram (text/ASCII) | Dev/DBA | ⚠️ Needs new entities |
| ORD.md | Object-Relationship Diagram | Dev | ✅ |
| SCHEMA.md | JSON/IDB schema + Go struct mapping | Dev | ⚠️ Needs update |
| UI-UX-README.md | UI patterns, dark theme, RGYB system | Dev/Design | ✅ |
| AI_FAQ.md | FAQ for AI assistants about the project | AI | ✅ |
| INSTALLATION_GUIDE.md | End-user + dev install guide | All | ✅ |
| CI-CD-README.md | CI/CD pipelines, build scripts | DevOps | ✅ |
| ISSUES.md | Known open issues | Dev/QA | ✅ |
| SOLVED_ISSUES.md | Resolved issues with solutions | Dev/AI | ✅ |
| PROJECT-STRUCTURE.md | File/folder tree with descriptions | Dev/AI | ✅ |
| MASTER_FILE_INDEX.md | **This file** — all files catalogue | Dev/AI | ✅ |
| MASTER_FOLDER_INDEX.md | All folders catalogue | Dev/AI | ✅ |
| DOMAIN.md | Problem domain, glossary | PM/Dev/AI | 🆕 |
| CATEGORY.md | Feature taxonomy / capability map | PM/Dev | 🆕 |

---

## /docs/progress — Session & Checkpoint Logs

| File | What |
|------|------|
| checkpoint-phase0/1/2.md | End-of-phase summaries |
| session-2026-02-22 … s7.md | Per-session work logs |
| session-prompt-log-*.md | User prompt + AI response summaries |

---

## Key Source Files

### companion/ (Go daemon)

| File | What | Pattern |
|------|------|---------|
| cmd/mvaultd/main.go | Entry point — parses flags, opens DB, starts HTTP | main |
| internal/db/sqlite.go | All DB CRUD + Delete methods | Repository |
| internal/db/migrate.go | Migration runner | Migration |
| internal/db/migrations/001_initial.sql | Full SQLite schema | DDL |
| internal/api/server.go | Route table (all mux.Handle lines) | Router |
| internal/api/handlers/handlers.go | All HTTP handlers | Handler |
| internal/api/ui/index.html | Dashboard SPA shell | Embedded UI |
| internal/api/ui/style.css | Dark-theme styles | CSS |
| internal/api/ui/app.js | Dashboard logic (~500 lines) | Vanilla JS |
| internal/api/ui/manifest.json | PWA manifest | PWA |
| internal/auth/token.go | Token generation + file persistence | Auth |
| internal/messaging/native.go | Native messaging host protocol | NativeMsg |

### packages/extension/src/ (TypeScript)

| File | What |
|------|------|
| background/index.ts | SW entry — wires all capture listeners |
| background/history-capture.ts | chrome.history.onVisited → IDB + companion push |
| background/download-capture.ts | chrome.downloads.onCreated → IDB + companion push |
| background/bookmark-sync.ts | chrome.bookmarks.onCreated → IDB + companion push |
| services/companion-client.ts | pushXxx() REST calls; `pushSession→boolean`; `syncAllUnpushedSessions()` (v4.4.0) |
| services/session-key.ts | encryptString / decryptString (WebCrypto) |
| db/repositories/*.ts | IDB CRUD per entity (openDB singleton) |
| popup/popup.ts | Extension popup UI logic |
| options/options.ts | Options page logic |

### packages/shared/src/ (Shared TS types)

| File | What |
|------|------|
| index.ts | Re-exports all types, utils, crypto |
| types/*.ts | Library, Session (+ `syncedToCompanion` v4.4.0), Tab, Bookmark, History, Download, Tag |
| crypto/*.ts | WebCrypto encrypt/decrypt utilities |

---

## Config / Build Files (root)

| File | What |
|------|------|
| pnpm-workspace.yaml | Workspace definition |
| packages/extension/vite.config.ts | Chrome build config |
| packages/extension/vite.config.firefox.ts | Firefox build config |
| packages/extension/manifest.json | MV3 manifest (Chrome) |
| packages/extension/manifest-firefox.json | MV2 manifest (Firefox) |
| companion/go.mod | Go module + deps |
| tools/install-companion/install-windows.ps1 | Windows installer |
