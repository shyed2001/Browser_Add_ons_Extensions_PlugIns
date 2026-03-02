# MindVault — UI/UX Design Reference

**Version:** 2.0  
**Date:** 2026-02-22  

---

## 1. Design Philosophy

MindVault uses **vanilla HTML + TypeScript** with no UI framework. Key principles:

- **Zero framework overhead** — no React, Vue or Tailwind; raw DOM + typed TypeScript
- **KISS** — each view is a flat HTML page with a single `index.ts` controller
- **Keyboard-first** — all actions reachable without a mouse
- **Offline-first** — UI never blocks on network; all data from local IndexedDB

---

## 2. Application Surfaces

### 2.1 Popup (`src/popup/popup.html`)
Triggered by clicking the browser toolbar icon.

```
┌─────────────────────────────┐
│  🧠 MindVault          [×]  │
├─────────────────────────────┤
│  Library: [Personal  ▼]     │
│  Session: [Work Tabs ▼]     │
├─────────────────────────────┤
│  [💾 Save This Tab    ]     │
│  [📦 Save All Tabs    ]     │
├─────────────────────────────┤
│  Saved: 42 tabs | 7 sessions│
│  [Open Dashboard →]         │
└─────────────────────────────┘
```

**Constraints:** Max 600×400px. Must load in < 200ms.

### 2.2 Dashboard (`src/dashboard/dashboard.html`)
Full-page options page. Opens in a new browser tab.

```
┌──────────────────────────────────────────────────────────┐
│  🧠 MindVault  [Library: Personal ▼] [+ New]  [🔒 Lock]  │
├────────────────┬─────────────────────────────────────────┤
│  NAVIGATION    │  MAIN CONTENT AREA                      │
│                │                                         │
│  📋 Sessions   │  (selected view renders here)           │
│  🔖 Bookmarks  │                                         │
│  🕐 History    │                                         │
│  ⬇  Downloads  │                                         │
│  ⚙  Settings   │                                         │
│                │                                         │
└────────────────┴─────────────────────────────────────────┘
```

---

## 3. Colour System (RGYB)

MindVault uses a 4-colour importance tagging system inherited from v1.1:

| Code | Colour | Semantic Meaning | CSS Class |
|------|--------|-----------------|-----------|
| R | 🔴 Red | Critical / urgent | `.colour-r` |
| G | 🟢 Green | Done / safe | `.colour-g` |
| Y | 🟡 Yellow | In progress / watch | `.colour-y` |
| B | 🔵 Blue | Reference / info | `.colour-b` |
| null | ⚪ None | No tag | (none) |

Colour is displayed as a left-border accent on list items, not background fills.

---

## 4. Navigation Model

### Dashboard Navigation
- Left sidebar with 5 nav items (Sessions, Bookmarks, History, Downloads, Settings)
- Active item highlighted with accent border
- URL hash routing: `dashboard.html#sessions`, `#bookmarks`, etc.
- No page reload — views swap by showing/hiding HTML sections

### Popup Navigation
- Single-screen; no navigation needed
- "Open Dashboard" button opens `dashboard.html` in a new tab

---

## 5. Dashboard Views

### 5.1 Sessions View
- List of sessions, sorted by `updatedAt` desc
- Expand session → show its tabs inline
- Each tab row: favicon | title | URL | colour picker | delete
- "New Session" button → prompt for name
- "Save All Tabs" button → creates session from current window

### 5.2 Bookmarks View
- Tree layout mirroring browser bookmark structure
- Folder nodes collapsible
- Each bookmark: favicon | title | URL | colour picker | notes | delete
- Sync button to pull latest from `chrome.bookmarks`

### 5.3 History View
- Chronological list, most recent first
- Columns: timestamp | domain | title | URL | ⭐ (important) | delete
- Filter bar: domain search, date range picker
- Toggle: show important only

### 5.4 Downloads View
- Reverse-chronological list
- Columns: filename | MIME type | size | source URL | state badge | notes | delete
- Filter by MIME type dropdown
- State badges: `in_progress` (blue), `complete` (green), `error` (red)

### 5.5 Settings View
Accordion sections:

**Library Management**
- Library name input + rename button
- Delete library button (with confirmation)

**Encryption**
- Enable/disable password toggle
- Lock button (clears session key from memory)
- Unlock button (prompts password, derives key)
- Change password button (re-encrypts all fields)
- Status indicator: 🔒 Locked / 🔓 Unlocked

**Data Management**
- Export JSON button → downloads `mindvault-backup-{date}.json`
- Import JSON file input
- Export .mvault button → prompts backup password → downloads encrypted file
- Import .mvault file input → prompts backup password

**Danger Zone**
- Clear all data button (with triple-confirmation)

---

## 6. Component Patterns

### 6.1 List Item Pattern
All entity lists follow the same HTML structure:
```html
<div class="item colour-{r|g|y|b}">
  <img class="favicon" src="...">
  <div class="item-body">
    <span class="item-title">Page Title</span>
    <span class="item-url">https://...</span>
  </div>
  <div class="item-actions">
    <button class="btn-colour" data-id="...">●</button>
    <button class="btn-delete" data-id="...">🗑</button>
  </div>
</div>
```

### 6.2 Modal/Confirm Pattern
No external modal library. Uses `window.prompt()` and `window.confirm()` for:
- Password entry (encrypt/unlock/export)
- Destructive confirmations (delete library, clear all)
- New session name input

### 6.3 Status Messages
Inline status `<div id="status">` below action buttons:
- Success: green text, auto-clears after 3s
- Error: red text, stays until user action

---

## 7. Responsive Design

| Surface | Min Width | Notes |
|---------|-----------|-------|
| Popup | 320px | Fixed 600px max |
| Dashboard | 800px | Sidebar collapses on narrow screens (future) |

The dashboard is currently desktop-only. Mobile adaptation is out of scope for v2.

---

## 8. Accessibility

- All interactive elements have `aria-label` where icon-only
- Colour tags also have text labels (not colour-only indicators)
- Tab order follows visual reading order
- Focus trapping on destructive confirmation dialogs (planned)

---

## 9. Typography & Spacing

- Font: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Base size: 14px
- Spacing unit: 8px grid
- No custom fonts loaded (no external requests)

---

## 10. Dark Mode

Dark mode via `prefers-color-scheme` media query. CSS custom properties:
```css
:root {
  --bg: #ffffff;
  --surface: #f5f5f5;
  --text: #1a1a1a;
  --accent: #2563eb;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --surface: #2a2a2a;
    --text: #e5e5e5;
    --accent: #60a5fa;
  }
}
```
