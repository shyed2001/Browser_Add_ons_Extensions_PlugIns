# MindVault — Session Prompt Log: 2026-02-24 (Session 3)

---

## User Prompts (chronological)

### Prompt 1 — Session handoff
> "continue and keep doing what u were doing before u hit limit. If possible also
> create files with session prompt log and chat prompt logs. Also frequently update
> changelog and references files... read existing files before creating new ones..."

**Action:** Resumed from session 2 summary. Continued with companion reinstall,
Firefox build, and sync pipeline implementation.

---

### Prompt 2 — Multi-browser architecture question
> "ok i/we/people will install this mindvault browser extension on their browsers
> on computers. so they will have library of data. but there are many browsers so
> many data library? how will they sync? by companion? What will the companion do?
> bring all data from various browsers and various libraries to a single db?
> to see every or all browser use on a pc in one place?"

**Answer given:** Yes — companion is the aggregation hub. Each browser extension
has its own IndexedDB (isolated by browser profile). The companion's SQLite is the
single unified store. Extension → companion push pipeline is the missing link.
MAUI desktop reads from companion's REST API for the combined view.

---

### Prompt 3 — Firefox corrupt error + companion access question
> "Step 4 — Firefox (Optional) Firefox requires the MV2 manifest... this says,
> addon extension can not be loaded because the file seems to be corrupt. but Edge
> and Chrome browser extension installed. but how to know companion is running and
> where to browse the companion and or my unified mindvault dashboard?"

**Answer given:**
- Firefox "corrupt" error: two stacked bugs (TypeScript source loaded directly +
  `options_page` vs `options_ui.page`)
- Companion health check: `http://127.0.0.1:47821/health`
- Dashboard: right-click extension icon → Options (opens `dashboard.html`)
- Fix: new `vite.config.firefox.ts`, correct `options_ui.page`, load `dist-firefox/manifest.json`

---

### Prompt 4 — Same extension ID across browsers + combined view question
> "Edge Ext ID ejaomglhklhbgboobjnpokfbeamhnmpf / Chrome profile 1 ext ID
> ejaomglhklhbgboobjnpokfbeamhnmpf / Chrome Profile 2 ext id
> ejaomglhklhbgboobjnpokfbeamhnmpf / how will i see the combined tab listing and
> everything list and history on my dashboard? and there are many firefox dist and
> manifest and firefox-manifest json none works. which one to use? same issue as before."

**Answer given:**
- Same extension ID across browsers = expected (all loaded from same folder)
- Combined view requires sync pipeline (extension → companion push)
- Firefox: use `dist-firefox/manifest.json` (never source, never dist/)
- Offered 3 options: sync pipeline first / MAUI Libraries page first / both together
- **User selected: Sync pipeline first (Recommended)**

---

### Prompt 5 — Continue after context limit
> [Session resumed after context compaction]
> "continue and keep doing what u were doing..."

**Action:** Reinstalled companion, verified health + `/token` endpoints, rebuilt
Firefox extension (41 modules), committed `97f0b45`, updated CHANGELOG/PLAN/session logs.

---

## Key Decisions Made This Session

| Decision | Rationale |
|----------|-----------|
| Fire-and-forget sync calls | Extension must work standalone without companion |
| `GET /token` unauthenticated | Bootstrap pattern — extension can self-configure on install |
| Extension passes its own IDB IDs | ID consistency across IndexedDB and SQLite |
| `Promise.allSettled()` for tab push | One tab failure doesn't abort the rest |
| Firefox build: separate `vite.config.firefox.ts` | Keeps Chrome MV3 + Firefox MV2 configs clean |
