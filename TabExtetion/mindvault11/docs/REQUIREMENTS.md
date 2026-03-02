# MindVault — Requirements

## Functional Requirements

### FR-01: Tab Capture
- Save all open browser tabs as a named session
- URL-deduplicate across the library (RGYB repeat tracking)
- RGYB: 1 save = 1 tick (R→G→Y→B cycle); 5 saves = 1 star
- Capture: URL, title, favicon, timestamp
- Auto-name session from date if user provides no name

### FR-02: History Capture
- Import full browser history on first install
- Live-capture new visits via `chrome.history.onVisited`
- Mark entries as "important" via configurable rules:
  - visit count (gt/gte/lt/lte/eq threshold)
  - starred by user
  - tagged
  - domain glob pattern match
  - date range
- Star/unstar and mark important/unimportant manually

### FR-03: Download Tracking
- Capture download METADATA ONLY (never file content):
  filename, source URL, final URL, file size, MIME type, timestamp, state, referrer
- Live-capture via `chrome.downloads.onCreated` + `onChanged`
- URL-deduplicated within a library

### FR-04: Bookmarks
- Full folder hierarchy (parentId tree)
- Create / update / delete bookmarks and folders
- Fields: title, URL, description, tags, visitCount, isFavorite, sortOrder

### FR-05: Libraries (Multi-Profile)
- Multiple named libraries (Personal / Work / Client-X)
- One default library; switch active library via header dropdown
- Per-library encryption (independent passwords)
- New library created with name + emoji icon

### FR-06: Encryption
- AES-256-GCM field-level encryption
- PBKDF2-SHA256 key derivation (600,000 iterations)
- Encrypted fields: session.notes, tab.notes, bookmark.description, download.notes
- Session key in-memory only — never persisted
- Explicit lock action clears key immediately
- Backup password is independent from library password

### FR-07: Export
- CSV (tabs): serial, title, URL, repeatCount, lastSaved, notes
- JSON (full backup): all entities for a library
- HTML (report): human-readable tab list
- Netscape HTML: bookmarks-compatible format
- .mvault: AES-256-GCM encrypted full backup (password-protected)

### FR-08: Import
- JSON backup: restore all entities
- .mvault: decrypt and restore with backup password
- V1.1 migration: zero data-loss import from `chrome.storage.local`

### FR-09: Audit Log
- Append-only log of every CREATE / UPDATE / DELETE
- Fields: action, entityType, entityId, actor, timestamp, diffJson, syncedAt
- Fire-and-forget — never blocks CRUD operations

### FR-10: Tags
- Many-to-many: tags can be applied to any entity type
- Per-library namespace
- Usage count tracking
- Unique name per library

## Non-Functional Requirements

### NFR-01: Privacy
- No data sent to any external server (Phase 0–2)
- Downloads: metadata only, never file content
- Encryption keys: never stored, never logged, in-memory session only

### NFR-02: Performance
- Dashboard load: < 500ms for 10,000 tabs
- History import: paginated in batches of 500 to avoid memory pressure
- IndexedDB queries: use indexes, never full-table scan in hot paths

### NFR-03: Compatibility
- Chrome ≥ 120 (MV3, WebCrypto, IndexedDB v2)
- Firefox ≥ 120 (Phase 2 — via webextension-polyfill, TBD)
- Edge: same as Chrome (same engine)

### NFR-04: Reliability
- Always shippable — each phase delivers real user value
- V1.1 migration: idempotent, rollback-safe, original data preserved 30 days
- Extension works standalone (no companion required)

### NFR-05: Test Coverage
- Target: 80%+ branches, functions, lines on shared + db packages
- All CRUD operations integration-tested with fake-indexeddb
- Migration test: v1.1 → v2 zero data loss assertion

### NFR-06: Security
- No eval(), no innerHTML from user data (use escHtml() helper)
- Content Security Policy: extension-default MV3 policy
- PBKDF2 iterations: 600,000 (OWASP 2024)
- Backup files: self-contained — no key material stored in file

## Out of Scope (Phase 2)

- Cloud sync (Phase 4)
- Mobile app (Phase 4)
- Web app (Phase 4)
- PDF report (Phase 3)
- Cross-device sync (Phase 3 manual; Phase 4 cloud)
