# MindVault — Software Requirements Specification (SRS)

**Version:** 2.0  
**Date:** 2026-02-22  
**Status:** Active  

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for MindVault v2.x — a browser extension and companion ecosystem for personal knowledge management.

### 1.2 Scope
MindVault enables users to save, organise, search and export browser sessions, tabs, bookmarks, history and downloads, with optional AES-256-GCM field-level encryption and multi-library organisation.

### 1.3 Definitions
| Term | Definition |
|------|-----------|
| Library | Top-level organisational unit (like a workspace) |
| Session | A named group of saved tabs |
| Tab | A saved browser tab (URL + metadata) |
| RGYB | Red-Yellow-Green-Blue importance tag system |
| .mvault | Encrypted binary backup format |
| Companion | Local Go daemon providing SQLite + REST API |

---

## 2. Overall Description

### 2.1 Product Perspective
MindVault is a standalone Chrome Extension (MV3) with an optional local companion daemon. No cloud infrastructure is required; all data is stored locally in IndexedDB or SQLite.

### 2.2 User Classes
- **Power User** — manages multiple libraries, uses encryption, exports backups regularly
- **Casual User** — saves tabs and bookmarks, uses default library only
- **Developer** — integrates with companion REST API

### 2.3 Operating Environment
- Chrome / Chromium ≥ 120, Firefox ≥ 115 (Phase 2 Step 13)
- Windows 10/11, macOS 12+, Linux (Ubuntu 22+)
- Node.js ≥ 20 (build-time only)

---

## 3. Functional Requirements

### FR-TAB — Tab Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TAB-01 | Save current tab to active library/session | Must |
| FR-TAB-02 | Save all open tabs as a new session | Must |
| FR-TAB-03 | Open a saved tab in a new browser tab | Must |
| FR-TAB-04 | Delete a saved tab | Must |
| FR-TAB-05 | Tag a tab with RGYB colour importance | Must |
| FR-TAB-06 | Add free-text notes to a saved tab | Should |
| FR-TAB-07 | Search saved tabs by URL, title or notes | Should |
| FR-TAB-08 | Sort tabs by date, title or importance | Should |

### FR-SES — Session Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SES-01 | Create a named session | Must |
| FR-SES-02 | Rename a session | Must |
| FR-SES-03 | Delete a session and all its tabs | Must |
| FR-SES-04 | Restore all tabs in a session | Should |
| FR-SES-05 | Add notes to a session | Should |
| FR-SES-06 | Encrypt session notes when library password is set | Must |

### FR-HIS — History Tracking
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-HIS-01 | Capture browser history entries automatically | Must |
| FR-HIS-02 | Display history in dashboard with timestamp | Must |
| FR-HIS-03 | Mark history entry as important | Should |
| FR-HIS-04 | Filter history by domain or date range | Should |
| FR-HIS-05 | Delete individual history entries | Must |

### FR-DL — Download Tracking
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DL-01 | Capture download metadata (filename, URL, MIME, size) | Must |
| FR-DL-02 | Display downloads in dashboard | Must |
| FR-DL-03 | Track download state (in_progress / complete / error) | Must |
| FR-DL-04 | Add notes to a download (encrypted if password set) | Should |
| FR-DL-05 | Filter downloads by MIME type | Should |

### FR-BM — Bookmark Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BM-01 | Sync Chrome bookmarks into MindVault | Must |
| FR-BM-02 | Display bookmarks in dashboard tree | Must |
| FR-BM-03 | Tag bookmark with RGYB colour | Should |
| FR-BM-04 | Add notes to a bookmark (encrypted if password set) | Should |
| FR-BM-05 | Delete a bookmark | Must |

### FR-LIB — Library Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-LIB-01 | Create multiple named libraries | Must |
| FR-LIB-02 | Switch active library via header dropdown | Must |
| FR-LIB-03 | Delete a library and all its data | Must |
| FR-LIB-04 | Each library is isolated (no cross-library data) | Must |

### FR-ENC — Encryption
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ENC-01 | Set a password to enable field-level encryption | Must |
| FR-ENC-02 | Derive AES-256-GCM key via PBKDF2-SHA256 (600K iter) | Must |
| FR-ENC-03 | Encrypt notes/descriptions fields in all entity types | Must |
| FR-ENC-04 | Lock library (clear session key from memory) | Must |
| FR-ENC-05 | Unlock library with correct password | Must |
| FR-ENC-06 | Change library password (re-encrypt all fields) | Should |
| FR-ENC-07 | Visual indicator when library is locked/unlocked | Must |

### FR-EXP — Export / Import
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EXP-01 | Export library as unencrypted JSON backup (.json) | Must |
| FR-EXP-02 | Import JSON backup into existing library | Must |
| FR-EXP-03 | Export library as encrypted .mvault backup | Must |
| FR-EXP-04 | Import .mvault file with separate backup password | Must |
| FR-EXP-05 | Validate backup schema before import | Must |

### FR-AUD — Audit Log
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUD-01 | Log CREATE / UPDATE / DELETE actions with timestamp | Must |
| FR-AUD-02 | Store audit entries in IndexedDB per library | Must |
| FR-AUD-03 | Display audit log in dashboard Settings | Should |
| FR-AUD-04 | Audit log is fire-and-forget (never blocks main flow) | Must |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Dashboard load < 500ms for libraries with ≤ 10,000 entities |
| NFR-02 | Security | All cryptography via WebCrypto API only (no third-party crypto libs) |
| NFR-03 | Privacy | Zero telemetry, zero network calls, all data stored locally |
| NFR-04 | Portability | Extension data exportable to open JSON format |
| NFR-05 | Reliability | All tests pass before any tagged release |
| NFR-06 | Maintainability | No React/Tailwind; vanilla TS; each module ≤ 300 lines |
| NFR-07 | Compatibility | Chrome MV3 required; Firefox MV2 polyfill in Phase 2 Step 13 |
| NFR-08 | Storage | IndexedDB only (no localStorage, no cookies) |

---

## 5. External Interface Requirements

### 5.1 Browser APIs Used
- `chrome.tabs` — save/restore tabs
- `chrome.storage` — settings persistence
- `chrome.history` — history capture
- `chrome.downloads` — download metadata
- `chrome.bookmarks` — bookmark sync
- `chrome.nativeMessaging` — companion daemon channel

### 5.2 Companion REST API (Phase 2 Step 11)
- Base URL: `http://localhost:47821`
- Auth: shared secret via native messaging handshake
- Endpoints: `/libraries`, `/sessions`, `/tabs`, `/search`, `/sync`

---

## 6. Constraints

- Must not require internet connectivity for any core feature
- Must not store plaintext passwords anywhere (only derived keys in memory)
- Must comply with Chrome Web Store policies for MV3 extensions
- Companion daemon must be opt-in (extension fully functional without it)
