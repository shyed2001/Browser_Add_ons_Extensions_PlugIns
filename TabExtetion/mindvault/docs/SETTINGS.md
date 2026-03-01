# MindVault — Settings Reference

**Version:** 2.0  
**Date:** 2026-02-22  

---

## 1. Settings Overview

MindVault has two types of settings:
- **Library settings** — per-library, stored in IndexedDB `libraries` store
- **App settings** — global, stored in `chrome.storage.local`

All settings are local-only. No cloud sync.

---

## 2. Library Settings

Accessible via **Dashboard → Settings → Library Management**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Library Name | string | "Default Library" | Display name shown in header dropdown |
| Description | string | "" | Optional description of the library |
| Password (encryption) | string | none | Derives AES-256-GCM key via PBKDF2 |
| isEncrypted | boolean | false | Whether field encryption is enabled |
| passwordSalt | string (base64) | null | 16-byte random salt, stored with library |

### Encryption Settings

| Action | Where | Effect |
|--------|-------|--------|
| Enable Password | Settings → Encryption → "Set Password" | Sets `isEncrypted: true`, generates salt, derives key into memory |
| Lock Library | Header → 🔒 button | Clears session key from JS memory |
| Unlock Library | Header → 🔓 button | Re-derives key from password, stores in memory |
| Change Password | Settings → Encryption → "Change Password" | Re-encrypts all fields with new key |
| Disable Encryption | Settings → Encryption → "Remove Password" | Decrypts all fields, sets `isEncrypted: false` |

---

## 3. Export / Import Settings

Accessible via **Dashboard → Settings → Data Management**

| Action | Format | Password Required | Description |
|--------|--------|-------------------|-------------|
| Export JSON | `.json` | No | Plaintext backup of all library data |
| Import JSON | `.json` | No | Merges backup into active library |
| Export .mvault | `.mvault` | Yes (backup password) | AES-256-GCM encrypted backup |
| Import .mvault | `.mvault` | Yes (backup password) | Decrypts and imports encrypted backup |

> **Note:** The `.mvault` backup password is independent of the library password.  
> A locked library can still be exported — the backup password encrypts the whole file separately.

---

## 4. Display Settings (Planned — Phase 3)

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| Items per page | number | 50 | 25 / 50 / 100 / All |
| Default sort | string | "date-desc" | date-asc, date-desc, title-asc |
| Show favicons | boolean | true | true / false |
| Compact mode | boolean | false | true / false |

---

## 5. Companion Daemon Settings (Planned — Phase 2 Step 11)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Companion URL | string | `http://localhost:47821` | REST API base URL |
| Auto-sync interval | number | 300 | Seconds between background syncs |
| Enable companion | boolean | false | Toggle native messaging connection |

---

## 6. Auto-Capture Rules (Planned — Phase 2)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Capture history | boolean | true | Auto-log browser history visits |
| Capture downloads | boolean | true | Auto-log download metadata |
| Capture bookmarks | boolean | true | Auto-sync bookmark changes |
| History domain blocklist | string[] | [] | Domains to never capture |
| Min visit duration (s) | number | 5 | Skip pages visited < N seconds |

---

## 7. Storage Locations

| Data Type | Storage | Key |
|-----------|---------|-----|
| Library data (entities) | IndexedDB `mindvault-db` | per store |
| Active library ID | `chrome.storage.local` | `activeLibraryId` |
| App preferences | `chrome.storage.local` | `preferences` |
| Session keys | JS memory only | never persisted |
| Backup files | Downloads folder | user-chosen filename |

---

## 8. Resetting Settings

**Reset library encryption:** Delete the library and re-create it (all data lost).  
**Clear all data:** Dashboard → Settings → Danger Zone → "Clear All Data".  
**Factory reset:** Remove and re-add the extension in `chrome://extensions`.
