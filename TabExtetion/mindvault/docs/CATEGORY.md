<!--
  CATEGORY.md — Feature Taxonomy / Capability Map
  =================================================
  | Section      | Description                          |
  |--------------|--------------------------------------|
  | Capabilities | Feature groups with status           |
  | API surface  | REST endpoint categories             |
  | UI areas     | Dashboard panels                     |

  Why  : One-page map of what the system can do; avoids re-reading all files.
  What : Feature categories, status, and where they live in the codebase.
  How  : Check this before planning new features to avoid duplication.
  When : Updated each phase.
  See  : PLAN.md for roadmap; DOMAIN.md for entities; ARCHITECTURE.md for design.
-->

# MindVault — Feature Category Map

> **Last updated**: 2026-02-26 (Phase 3 Steps 1–9 complete)

---

## Capability Groups

| Category | Features | Status | Key files |
|----------|----------|--------|-----------|
| **Capture — Tabs** | Save session+tabs via popup | ✅ | popup.ts, session repo |
| **Capture — History** | Auto-capture visited URLs (live) | ✅ | history-capture.ts |
| **Capture — Downloads** | Auto-capture download metadata | ✅ | download-capture.ts |
| **Capture — Bookmarks** | Sync browser bookmarks (live) | ✅ | bookmark-sync.ts |
| **Storage — Local** | IndexedDB per-library, per-user | ✅ | db/repositories/ |
| **Storage — Companion** | SQLite via Go daemon | ✅ | sqlite.go |
| **Encryption** | Per-library WebCrypto AES-GCM | ✅ | session-key.ts |
| **RGYB Colours** | R/G/Y/B label on any entity | ✅ | shared/types |
| **Tags** | Many-to-many labels | ✅ | tag repo |
| **Export** | JSON, CSV, HTML, Netscape BM | ✅ | export service |
| **Import** | .mvault encrypted backup | ✅ | import service |
| **Multi-browser** | Chrome/Edge/Brave/Opera/Vivaldi/Firefox | ✅ | manifest*.json |
| **Companion REST** | CRUD for all entities | ✅ | handlers.go, server.go |
| **Companion DELETE** | DELETE for all entities | ✅ | (Session 7) |
| **Web Dashboard** | SPA at /ui/ — dark theme | ✅ | ui/app.js |
| **Dashboard — Libraries** | List + create libraries | ✅ | |
| **Dashboard — Sessions** | View sessions+tabs per library | ✅ | |
| **Dashboard — Bookmarks** | View bookmarks per library | ✅ | |
| **Dashboard — History** | View history per library | ✅ | |
| **Dashboard — Downloads** | View downloads per library | ✅ | |
| **Dashboard — Search** | Full-text across tabs/BM/history | ✅ | |
| **Dashboard — Settings** | Companion info + install guide | ✅ | |
| **PWA** | Installable web app + offline | ⏳ Phase 3 Step 7 | |
| **Auto-start** | Windows Task Scheduler on login | ⏳ Phase 3 Step 11 | |
| **BM Import** | Chrome/Firefox HTML/JSON parser | ⏳ Phase 3 Step 10 | |
| **Cloud Sync** | Encrypted sync to cloud backend | ⏳ Phase 4 | |
| **Mobile** | iOS/Android PWA | ⏳ Phase 4 | |

---

## REST API Surface (companion :47821)

| Category | Endpoints | Auth |
|----------|-----------|------|
| Auth | GET /token | None (localhost) |
| Health | GET /health, GET /version | None |
| Libraries | GET/POST /libraries, GET/DELETE /libraries/{id} | Token |
| Sessions | GET/POST /libraries/{l}/sessions, DELETE …/{id} | Token |
| Tabs | GET/POST /libraries/{l}/tabs, DELETE …/{id} | Token |
| Bookmarks | GET/POST /libraries/{l}/bookmarks, DELETE …/{id} | Token |
| History | GET/POST /libraries/{l}/history, DELETE …/{id} | Token |
| Downloads | GET/POST /libraries/{l}/downloads, DELETE …/{id} | Token |
| Search | GET /search?q=&libId= | Token |
| Web UI | GET /ui/* | None |

---

## Code Module Categories

| Module | Language | Pattern | Description |
|--------|----------|---------|-------------|
| `companion/internal/db` | Go | Repository | SQLite access, all CRUD |
| `companion/internal/api` | Go | Handler/Router | HTTP REST server |
| `companion/internal/auth` | Go | Service | Token gen + file store |
| `companion/internal/messaging` | Go | Protocol | Native messaging host |
| `packages/extension/src/background` | TS | Event listeners | Capture + push |
| `packages/extension/src/services` | TS | Service | companion-client, encryption |
| `packages/extension/src/db` | TS | Repository | IDB CRUD per entity |
| `packages/shared/src` | TS | Library | Shared types + utils |
