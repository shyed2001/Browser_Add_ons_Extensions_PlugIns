# MindVault — Development Plan

**Product:** Personal Knowledge Vault — "CRM for your own attention"  
**Current Phase:** Phase 3 — Desktop App + Import Platform  
**Last Updated:** 2026-02-24

---

## Vision

Transform a simple Chrome tab-saver (v1.1, vanilla JS, ~300 LOC) into a full-stack, multi-platform personal knowledge vault that tracks open tabs, bookmarks, browser history, and download metadata across browsers, devices, and platforms — all with end-to-end encryption.

---

## Phase Roadmap

### ✅ Phase 0 — Foundation (COMPLETE — tagged v2.0.0-alpha)
- pnpm monorepo setup
- TypeScript migration
- Vite + MV3 build system
- IndexedDB schema v2
- Shared package (`@mindvault/shared`) with types, crypto, RGYB, UUID, dates

### ✅ Phase 1 — Extension v2 MVP (COMPLETE — tagged v2.0.0)
- Full IndexedDB repository layer (8 stores)
- V1.1 → V2 zero-data-loss migration
- Sessions view, Bookmarks view rebuilt
- Tags system (many-to-many)
- Export: JSON, CSV, HTML, Netscape bookmarks
- Import: JSON backup
- 116 extension tests + 47 shared tests

### ✅ Phase 2 — Extension v3 + Companion MVP (COMPLETE — tagged v3.0.0)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Manifest permissions (history, bookmarks, nativeMessaging, downloads) | ✅ |
| 2 | background/history-capture.ts (full import + live capture) | ✅ |
| 3 | background/download-capture.ts (metadata-only) | ✅ |
| 4 | background/bookmark-sync.ts | ✅ |
| 5 | services/rules-engine.ts (important rules) | ✅ |
| 6 | Audit log repository | ✅ |
| 7 | Tags system | ✅ |
| 8 | Library switcher UI + per-library encryption UI | ✅ |
| 9 | WebCrypto encryption wired into repositories | ✅ |
| 10 | .mvault encrypted backup export/import | ✅ |
| 11 | Go companion daemon (SQLite, REST :47821, native messaging stub) | ✅ |
| 12 | Native messaging host registration (HKCU registry + PowerShell) | ✅ |
| 13 | Firefox support (webextension-polyfill + manifest-firefox.json) | ✅ |
| 14 | Windows installer (tools/install-companion/install-windows.ps1) | ✅ |
| 15 | Phase 2 checkpoint + E2E tests (Go httptest + DB tests) | ✅ |
| 16 | E2E test scaffold (18 Go tests — DB + HTTP API) | ✅ |
| 17 | Tag v3.0.0 | ✅ |

**Result:** 143 tests passing (116 TS + 27 Go), 40 build modules (Chrome) / 41 (Firefox), companion v0.1.0

---

### 🔄 Phase 3 — Companion Web UI + Full Browser Support (Days 71–105)

> **Revised 2026-02-25**: MAUI desktop app replaced by a built-in web dashboard served
> directly by the companion EXE at `http://127.0.0.1:47821/ui`. Single-binary, no extra
> install, works in any browser, installable as a PWA. The `desktop/` scaffold is kept
> in the repo for potential future native features but is not the primary path.
>
> 2 installs total: extension + companion. That's it.

**Architecture:**
```
Chrome/Edge/Brave/Firefox/Opera/Vivaldi
  └── Extension → pushes to Companion REST API
Companion EXE (127.0.0.1:47821)
  ├── REST API  /libraries /sessions /tabs /search
  └── Web UI    /ui/  (embedded HTML/CSS/JS — no extra install)
       ↓  PWA install → desktop shortcut
```

| Step | Description | Status |
|------|-------------|--------|
| 1 | .NET MAUI scaffold (`desktop/`) — kept, not primary path | ✅ |
| 2 | Companion POST endpoints (`POST /libraries`, `/sessions`, `/tabs`) | ✅ |
| 2b | Extension → companion sync pipeline (`companion-client.ts`, `GET /token`) | ✅ |
| 3 | **Companion web UI** — Go embed, `/ui/` route, SPA dashboard (dark theme) | ✅ |
| 3b | Firefox popup tab fix + host permissions + all-browser URL filter | ✅ |
| 3c | CORS fix (moz-extension://) + multi-browser installer (Brave/Opera/Vivaldi) | ✅ |
| 4 | Web UI: Bookmarks view + History view + Downloads view | ✅ |
| 4b | Companion DB: Bookmark/HistoryEntry/Download CRUD + Search fix (empty libId) | ✅ |
| 4c | Companion API: GET+POST routes for bookmarks/history/downloads | ✅ |
| 4d | Extension: live-capture push pipeline (pushBookmark/pushHistoryEntry/pushDownload) | ✅ |
| 5 | Web UI: Search across all libraries | ✅ |
| 6 | Web UI: Settings page (companion status, connected browsers, token) | ✅ |
| 7 | PWA service worker — offline cache + "Install as app" prompt | ✅ |
| 8 | Smart installer — opens extension store page for each detected browser | ✅ |
| 9 | DELETE handlers in companion (library/session/tab/bookmark/history/download) | ✅ |
| 10 | Import: Chrome/Firefox bookmarks HTML/JSON parser | ✅ |
| 11 | Companion auto-start on Windows login (Task Scheduler) | ✅ |
| 12 | Save checkpoint-phase3-complete.md + tag v4.0.0 | ✅ |

**Test counts:** 143 passing (116 TS + 27 Go), 40 Chrome modules, 41 Firefox modules
**Last updated:** 2026-02-26

---

### ⏳ Phase 4 — Web App (PWA) + Cloud Sync + Mobile (Days 106–180)

> Vanilla TS/Node.js **Progressive Web App** — installable, offline-capable, syncs to cloud.

**Key architectural decision: Web app = PWA (Progressive Web App)**
- Service Worker for offline caching + background sync
- Web App Manifest (`manifest.webmanifest`) for install prompt
- Installable on Windows, Mac, Linux, Android, iOS from the browser
- Cache-first strategy for UI assets, network-first for API data
- Push notifications for sync status (optional)
- No React — vanilla TS + HTML templates (consistent with extension)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Node.js/TS + Vite PWA scaffold (`packages/web/`) | ⏳ |
| 2 | PWA Service Worker (Workbox or hand-rolled) | ⏳ |
| 3 | Web App Manifest + icons (512×512, maskable) | ⏳ |
| 4 | Auth: email + password, optional OAuth | ⏳ |
| 5 | Cloud API: Node.js/TS + PostgreSQL + Redis | ⏳ |
| 6 | Cloud sync: push/pull, last-write-wins + audit log conflict detection | ⏳ |
| 7 | Client-side encryption before upload | ⏳ |
| 8 | .NET MAUI mobile (iOS + Android) via companion REST | ⏳ |
| 9 | Safari extension (Xcode WebExtension wrapper) | ⏳ |
| 10 | Self-hosted Docker deployment | ⏳ |
| 11 | Tag v5.0.0 | ⏳ |

---

## Guiding Principles

1. **Always shippable** — each phase delivers real user value
2. **Privacy first** — no external data transmission until Phase 4 (opt-in)
3. **No frameworks** — vanilla TS + HTML templates (DRY/KISS)
4. **Extension works standalone** — companion = durability, not requirement
5. **RGYB preserved exactly** — core v1.1 feature maintained forever
6. **Zero data loss** — migration is idempotent, original data kept 30 days
7. **PWA-first for web** — installable, offline-capable, no app store required

---

## Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Extension | Vanilla TS + HTML + Vite | No framework overhead, fast builds |
| Storage (ext) | IndexedDB (WebCrypto encrypted) | No quota limits, indexed, private |
| Storage (companion) | SQLite | Local, zero-install, encrypted fields |
| Companion | Go | Single binary, cross-platform, fast startup |
| Desktop | .NET MAUI (C#) | One codebase → Windows + Mac + iOS + Android |
| Web (PWA) | Vanilla TS + Node.js + Vite | No React, installable, offline-capable |
| Cloud DB | PostgreSQL + Redis | Mature, self-hostable, Redis for pub/sub sync |
| Crypto | WebCrypto (browser) / Go crypto/aes | Native, auditable, no third-party deps |

---

## Success Metrics

- Phase 2 ✅: Extension + companion installed, tabs synced to SQLite, E2E tests green
- Phase 3: Desktop app browses library data, cross-device backup works, Edge support
- Phase 4: PWA installable + offline, cloud sync deployed, mobile app in app stores

---

## Known Constraints & Decisions

- **No React/Tailwind** — custom in-house approach, vanilla TS + HTML everywhere
- **Companion not required** — extension fully functional standalone
- **Manual CWS upload** — no automated Chrome Web Store publishing yet
- **Windows-first** — companion installer targets Windows first (PowerShell + HKCU registry)
- **PBKDF2 iterations: 600,000** — OWASP 2024 recommendation, non-negotiable
- **PWA for web app** — Service Worker + Web App Manifest, works offline, installable cross-platform
- **Native messaging wildcard `*`** — replace with real extension ID before production release
