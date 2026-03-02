# MindVault — Setup Guide
_Last updated: 2026-02-26_

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 (tested: v24.13.1) | `E:\Program Files\nodejs\node.exe` on dev machine |
| pnpm | ≥ 9 (tested: 10.30.1) | `npm install -g pnpm` |
| Go | ≥ 1.21 (tested: 1.26.0) | `C:\Program Files\Go\bin\go.exe` |
| Git | any | Windows: Git for Windows |
| Chrome / Edge / Firefox | ≥ 120 | For loading the extension |

---

## 1. Clone and install

```bash
git clone https://github.com/yourusername/mindvault.git
cd mindvault
pnpm install
```

---

## 2. Build the browser extension

```bat
REM Using the helper bat (sets Node PATH automatically):
C:\Temp\build-extension.bat

REM Or manually from Git Bash:
export PATH="/e/Program Files/nodejs:$PATH"
cd packages/extension
npx vite build
```

Output: `packages/extension/dist/` (gitignored — must build locally)

---

## 3. Load the extension in Chrome

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Browse to:
   ```
   C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\packages\extension\dist
   ```
5. Click **Select Folder**
6. MindVault appears in your extensions list ✅

**After loading:** Pin the MindVault icon to the toolbar.
- Click icon → popup (save tabs, RGYB indicator)
- Right-click → Options → full Dashboard (Sessions, Tabs, Bookmarks, History, Downloads, Settings)

### Reload after code changes
After rebuilding `dist/`, go to `chrome://extensions` and click the **↺** reload button
on the MindVault card. No need to re-add it.

---

## 4. Load the extension in Microsoft Edge

1. Open Edge → `edge://extensions`
2. Enable **Developer mode** (left sidebar)
3. Click **Load unpacked** → same `dist/` path as above

---

## 5. How to Access MindVault

Once the extension is loaded in Chrome or Edge:

| What you want | How to get there |
|---|---|
| **Popup** (save tabs, RGYB) | Click the 🧩 MindVault icon in browser toolbar |
| **Dashboard** (full app) | Right-click extension icon → **Options** |
| **Dashboard** (alt) | `chrome://extensions` → MindVault → **Details** → **Extension options** |
| **Is companion running?** | Open any browser tab → `http://127.0.0.1:47821/health` |
| **Companion data (REST)** | `http://127.0.0.1:47821/libraries` (needs X-MindVault-Token header) |
| **Web Dashboard** | `http://127.0.0.1:47821/ui/` — unified SPA (Libraries → Sessions → Tabs, Search, Settings) |

> The companion serves a full web dashboard at `/ui/` (Go `embed`). Works in any browser.
> Can be installed as a PWA desktop app from Chrome/Edge.

---

## 6. Build and install the Companion Daemon

The companion daemon (`mvaultd.exe`) provides the REST API on port 47821 and handles
SQLite storage that syncs across browser profiles.

### Build the binary

```bat
REM Using the helper bat:
C:\Temp\build-companion.bat

REM Or manually:
cd companion
"C:\Program Files\Go\bin\go.exe" build -o bin\mvaultd.exe .\cmd\mvaultd
```

### Install (no admin required)

```powershell
# Quick dev installer (sets up registry + starts daemon):
powershell.exe -ExecutionPolicy Bypass -File C:\Temp\install-mv-companion.ps1

# Or using the full installer script:
.\tools\install-companion\install-windows.ps1 -ExtensionId "*"
```

This installs to `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe` and registers
native messaging hosts for Chrome + Edge in HKCU (no admin needed).

### Verify the daemon is running

```
# In any browser: navigate to:
http://127.0.0.1:47821/health

# Expected response:
{"status":"ok","version":"0.1.0"}
```

### Manage the daemon

```powershell
# Check running:
Get-Process mvaultd

# Stop:
Stop-Process -Name mvaultd

# Start (hidden):
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden
```

---

## 6. Companion Web Dashboard

The companion serves a full SPA at `http://127.0.0.1:47821/ui/`.
Open it in any browser after the companion is running.

**Panels:**
- 📚 **Libraries** — all libraries, click to browse sessions + tabs
- 🔍 **Search** — full-text search across all libraries
- ⚙️ **Settings** — companion status, version, install instructions

**PWA install:** In Chrome/Edge, click the ⊕ in the address bar to install as a desktop app.

---

## 7. Run Tests

```bat
REM Extension (TypeScript — 116 tests):
C:\Temp\run-extension-tests.bat

REM Companion (Go — 18 tests):
cd companion
"C:\Program Files\Go\bin\go.exe" test .\...

REM All tests together:
REM Run both of the above
```

Expected: **143 tests passing** (116 TS + 27 Go), 0 failures.
_(116 TypeScript extension tests + 27 Go companion tests)_

---

## 8. Git Bash PATH Fixes (Windows)

```bash
# Node.js (required for npx/pnpm):
export PATH="/e/Program Files/nodejs:$PATH"

# Go:
export PATH="/c/Program Files/Go/bin:$PATH"

# pnpm (broken shell wrapper — use .cjs directly):
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" install
```

---

## Helper Bat Files (C:\Temp\)

| File | Purpose |
|------|---------|
| `C:\Temp\build-extension.bat` | Builds Chrome/Edge extension → `dist/` |
| `C:\Temp\build-firefox.bat` | Builds Firefox MV2 extension → `dist-firefox/` |
| `C:\Temp\build-companion.bat` | Builds Go daemon → `companion\bin\mvaultd.exe` |
| `C:\Temp\run-extension-tests.bat` | Runs 116 TS tests |
| `C:\Temp\run-go-tests.bat` | Runs 27 Go companion tests |
| `C:\Temp\install-mv-companion.ps1` | Installs + registers + starts daemon (all browsers) |

---

## Token Authentication

The companion reads a token from:
```
%LOCALAPPDATA%\MindVault\token
```

The extension sends this token as the `X-MindVault-Token` header on every API call.
Token is written by the installer or can be created manually (64 random hex chars).

---

## Firefox Support (Phase 3 — Step 5 / ISSUE-005)

Firefox needs a **separate MV2 build**. **Do NOT load from source** — Firefox cannot run
TypeScript files. Always load the compiled `dist-firefox/` folder.

### Step 1 — Build Firefox dist

```bash
# Git Bash:
export PATH="/e/Program Files/nodejs:$PATH"
cd packages/extension
npx vite build --config vite.config.firefox.ts
# Output: packages/extension/dist-firefox/
```

### Step 2 — Load in Firefox

1. Open Firefox → `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on…"**
4. Navigate to:
   ```
   C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\packages\extension\dist-firefox\
   ```
5. Select the **`manifest.json`** file inside that folder (not the folder itself)
6. MindVault should appear in the add-ons list ✅

> **Why "temporary"?** Firefox requires signed XPIs for permanent installation.
> Temporary mode is cleared on restart — fine for development and testing.

---

## Uninstall Companion

```powershell
.\tools\install-companion\uninstall-windows.ps1
# Use -KeepData to preserve the SQLite database
.\tools\install-companion\uninstall-windows.ps1 -KeepData
```
