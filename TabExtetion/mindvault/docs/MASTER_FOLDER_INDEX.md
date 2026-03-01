<!--
  MASTER_FOLDER_INDEX.md
  ======================
  | Section       | Description                              |
  |---------------|------------------------------------------|
  | Root tree     | Top-level folders, one-line purpose      |
  | Per-package   | Sub-folder details for each package      |

  Why  : Single navigation point for project folder structure.
  What : Compact folder reference — path, purpose, owner, key files.
  How  : Append new rows when folders are added; do NOT restate file content.
  When : Updated each phase that changes folder structure.
  Who  : Devs, AI, DevOps, new contributors.
  See  : PROJECT-STRUCTURE.md for full tree; MASTER_FILE_INDEX.md for files.
-->

# MindVault — Master Folder Index

> **Last updated**: 2026-03-01 (v4.4.0)  
> Full tree → `docs/PROJECT-STRUCTURE.md` | Files → `docs/MASTER_FILE_INDEX.md`

---

## Root Layout

```
mindvault/
├── companion/          Go daemon (SQLite + REST + embedded web UI)
├── packages/
│   ├── extension/      Browser extension (MV3 Chrome + MV2 Firefox)
│   └── shared/         Shared TS types, crypto, utils
├── docs/               All reference docs (this folder)
├── tools/              Install scripts, helper tools
└── desktop/            MAUI scaffold (kept, not primary path)
```

---

## Folder Details

| Path | Purpose | Key contents | Owner |
|------|---------|-------------|-------|
| `companion/` | Go binary root | go.mod, mvaultd.exe (build output) | Go |
| `companion/cmd/mvaultd/` | CLI entry point | main.go | Go |
| `companion/internal/api/` | HTTP server | server.go (routes) | Go |
| `companion/internal/api/handlers/` | HTTP handlers | handlers.go | Go |
| `companion/internal/api/ui/` | Embedded web dashboard | index.html, style.css, app.js, manifest.json | JS/HTML |
| `companion/internal/auth/` | Token auth | token.go | Go |
| `companion/internal/db/` | SQLite access layer | sqlite.go, migrate.go | Go |
| `companion/internal/db/migrations/` | SQL migration files | 001_initial.sql | SQL |
| `companion/internal/messaging/` | Native messaging host | native.go | Go |
| `packages/extension/src/` | Extension source root | — | TS |
| `packages/extension/src/background/` | Service worker + capture listeners | index.ts, history-capture.ts, download-capture.ts, bookmark-sync.ts | TS |
| `packages/extension/src/services/` | Shared services | companion-client.ts, session-key.ts | TS |
| `packages/extension/src/db/` | IDB repositories | repositories/*.ts | TS |
| `packages/extension/src/popup/` | Extension popup | popup.ts, popup.html | TS |
| `packages/extension/src/options/` | Options page | options.ts, options.html | TS |
| `packages/extension/dist/` | Chrome build output | Loaded into Chrome/Edge/Brave | Build |
| `packages/extension/dist-firefox/` | Firefox build output | Loaded into Firefox | Build |
| `packages/shared/src/` | Shared library source | index.ts, types/, crypto/ | TS |
| `docs/` | All reference docs | *.md files | Docs |
| `docs/progress/` | Session logs + checkpoints | session-*.md, checkpoint-*.md | Logs |
| `docs/architecture/` | Architecture diagrams | *.md, *.png | Docs |
| `tools/install-companion/` | Windows installer | install-windows.ps1 | PowerShell |
| `desktop/` | MAUI scaffold (future) | Not active | C# |

---

## Data / Config Locations (Runtime — not in repo)

| Path | What | OS |
|------|------|----|
| `%APPDATA%\MindVault\db.sqlite` | Companion SQLite DB | Windows |
| `%APPDATA%\MindVault\token` | Auth token | Windows |
| `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe` | Installed binary | Windows |
| `HKCU\Software\Google\Chrome\NativeMessagingHosts\…` | NativeMsg registration | Windows |
