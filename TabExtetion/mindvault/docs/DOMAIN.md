<!--
  DOMAIN.md — Problem Domain & Glossary
  ======================================
  | Section    | Description                        |
  |------------|------------------------------------|
  | Domain     | What problem MindVault solves      |
  | Actors     | Who uses it and how                |
  | Entities   | Core domain objects                |
  | Glossary   | Key terms defined once             |

  Why  : Shared vocabulary for devs, AI, PMs. Single source of truth.
  What : Domain model, actors, entities, terms.
  How  : Read before coding new features; update when new entities are added.
  When : Updated each phase that changes the domain model.
  See  : SRS.md for requirements; ARCHITECTURE.md for design.
-->

# MindVault — Problem Domain

## Domain Statement

> **"CRM for your own attention"** — A personal knowledge vault that automatically
> captures what you browse, bookmark, download and saves across browsers, devices
> and time. Zero-cloud-required; runs locally with an optional sync layer.

---

## Actors

| Actor | Description |
|-------|-------------|
| **User** | Person who installs the extension + companion |
| **Extension** | Browser-native JS that captures activity events |
| **Companion** | Local Go daemon, SQLite store, REST API, web dashboard |
| **Browser** | Chrome / Edge / Brave / Firefox / Opera / Vivaldi |
| **AI assistant** | Uses `docs/AI_FAQ.md` + this file for context |

---

## Core Domain Entities

| Entity | Where stored | Description |
|--------|-------------|-------------|
| **Library** | IDB + SQLite | Logical namespace (e.g. "Work", "Personal") |
| **Session** | IDB + SQLite | Named group of tabs saved at a point in time |
| **Tab** | IDB + SQLite | Single browser tab (url, title, favicon, colour) |
| **Bookmark** | IDB + SQLite | Browser bookmark (folder or link, RGYB colour) |
| **HistoryEntry** | IDB + SQLite | Visited URL with timestamp and domain |
| **Download** | IDB + SQLite | Download metadata (filename, url, size, state) |
| **Tag** | IDB + SQLite | Many-to-many label applied to any entity |
| **AuditLog** | IDB + SQLite | Immutable action log (CREATE/UPDATE/DELETE) |
| **EncryptedField** | IDB only | WebCrypto-encrypted value (JSON wrapper) |

---

## Glossary

| Term | Definition |
|------|-----------|
| **RGYB** | Red/Green/Yellow/Blue colour tag system preserved from v1.1 |
| **Library** | Top-level isolation unit; each has its own encryption key |
| **Session** | Snapshot of open tabs at a moment in time; named by user |
| **Companion** | The local Go daemon (`mvaultd.exe`) serving REST + web UI |
| **Push** | Extension → Companion HTTP POST (fire-and-forget, live only) |
| **IDB** | IndexedDB — browser-native structured storage used by extension |
| **MV3/MV2** | Manifest Version 3 (Chrome) / 2 (Firefox) for extensions |
| **PWA** | Progressive Web App — companion web UI installable as desktop app |
| **NativeMsg** | Chrome Native Messaging — alternative IPC channel (future use) |
| **WAL** | SQLite Write-Ahead Log mode (concurrent reads, single writer) |
| **Upsert** | INSERT OR IGNORE — used for idempotent companion writes |
| **Live capture** | Event-driven push on browser events (vs bulk historical import) |
