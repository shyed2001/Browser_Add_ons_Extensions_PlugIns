# MindVault — Installation Guide
_Last updated: 2026-02-28 | Version: 4.2.0_

---

## Overview

MindVault has **two components** to install:

| Component | What it does | Required? |
|-----------|-------------|-----------|
| **Browser Extension** | Saves tabs, RGYB repeat indicator, popup + dashboard | Yes |
| **Companion Daemon** (`mvaultd.exe`) | Unified SQLite DB, cross-browser sync, web dashboard at `:47821` | For multi-browser / web UI |

The extension works **standalone** (data in IndexedDB, inside the browser).
The companion adds cross-browser data sync, bookmarks/history/downloads capture,
and the full web dashboard at `http://127.0.0.1:47821/ui/`.

---

## Quick Install (End User)

### Step 1 — Install the Companion Daemon

1. Build `mvaultd.exe` from source (see Developer Setup below), or download a release binary.

2. Run **one** of the three installer scripts below — pick whichever suits your environment.
   All three auto-detect the binary and can be run **from any directory**.

   #### Option A — PowerShell (recommended)

   ```powershell
   powershell -ExecutionPolicy Bypass -File "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.ps1"
   ```
   With auto-start at login:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.ps1" -AutoStart
   ```
   Force-replace a running daemon without prompting:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.ps1" -AutoStart -Force
   ```

   #### Option B — CMD / Batch (PowerShell-free environments)

   ```cmd
   "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.bat"
   "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.bat" /autostart
   "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.bat" /autostart /force
   ```

   #### Option C — Python (requires Python 3.6+, Windows)

   ```cmd
   python "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.py"
   python "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.py" --auto-start
   python "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.py" --auto-start --force
   python "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.py" --auto-start --force --no-extension
   ```

   All installers will:
   - Copy `mvaultd.exe` → `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe`
   - Generate an auth token at `%LOCALAPPDATA%\MindVault\token`
   - Write native messaging manifests (Chromium + Firefox formats)
   - Register native messaging in the registry for all **detected** browsers
   - (With `-AutoStart` / `/autostart` / `--auto-start`) Register a Task Scheduler logon job (no admin required)
   - Start the daemon in the background
   - Open each browser's extensions page and print Load Unpacked instructions

3. Verify it's running — open any browser and navigate to:
   ```
   http://127.0.0.1:47821/health
   ```
   Expected response: `{"status":"ok","version":"0.1.0"}`

4. Open the web dashboard:
   ```
   http://127.0.0.1:47821/ui/
   ```

### Step 2 — Install the Browser Extension

#### Chrome / Edge / Brave / Vivaldi / Opera / Chromium

1. Build (or download) the extension — output is the `packages/extension/dist/` folder.
2. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Vivaldi: `vivaldi://extensions`
   - Opera: `opera://extensions`
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked**.
5. Select the `dist/` folder.
6. MindVault appears in your extension list ✅

#### Firefox

> Firefox requires the Firefox-specific build (`dist-firefox/`).

1. Build or download the Firefox dist.
2. Open `about:debugging` in Firefox.
3. Click **This Firefox** in the left sidebar.
4. Click **Load Temporary Add-on…**
5. Navigate to `dist-firefox/` and select **`manifest.json`**.
6. MindVault appears in the add-ons list ✅

> **Note:** Temporary add-ons are removed on Firefox restart. Persistent install
> requires Mozilla signing (planned for a future release).

---

## Using MindVault

### Browser Extension

| What | How |
|------|-----|
| **Save current tabs** | Click the 🧠 toolbar icon → click **Save** |
| **View saved sessions** | Click icon → **Open Dashboard** (or right-click → Options) |
| **RGYB indicator** | Coloured ticks/stars on popup show how often you've saved this page |
| **Dashboard** | Full view: Libraries → Sessions → Tabs, Bookmarks, History, Downloads, Settings |

### Web Dashboard (Companion)

Open `http://127.0.0.1:47821/ui/` in any browser — the companion must be running.

| Panel | Access | What it shows |
|-------|--------|---------------|
| **Libraries** | Sidebar (📚) | All libraries → click to open |
| **Sessions** | Click a library | All saved sessions |
| **Tabs** | Click a session | All saved tabs with favicon + RGYB |
| **Bookmarks** | lnav tab inside library | All bookmarks |
| **History** | lnav tab inside library | All history entries |
| **Downloads** | lnav tab inside library | All download records |
| **Search** | Sidebar (🔍) | Full-text search across all libraries |
| **Settings** | Sidebar (⚙️) | 5 cards — see below |

**Settings cards:**

| Card | What it does |
|------|-------------|
| **Companion Status** | Version, port, library count, dashboard link |
| **Auto-Start** | Toggle Task Scheduler logon job — Enable/Disable without reinstalling |
| **Install Browser Extension** | Browser-aware instructions (your browser detected, shown first) |
| **Import Bookmarks** | Import Chrome/Edge/Brave Netscape HTML export or Chromium JSON backup |
| **Appearance** | Switch between 4 themes: Dark · Mid Dark · Mid Light · Light (persisted) |
| **Companion Install Path** | Binary + database file locations |

**Appearance themes:**

| Theme | Background | Best for |
|-------|-----------|---------|
| **Dark** (default) | `#0f0f10` | Low-light / night |
| **Mid Dark** | `#1e1e2e` | Soft dark (Catppuccin-inspired) |
| **Mid Light** | `#e8e8f0` | Reduced eye strain, bright rooms |
| **Light** | `#f5f5f7` | High-contrast, daylight |

Theme persists in `localStorage` and restores automatically on reload.

**Library management:**

| Action | How |
|--------|-----|
| **Rename a library** | Double-click the library name in the sidebar → type → Enter to save, Esc to cancel |
| **Auto-rename** | A library named "Default Library" is renamed to `"Default (Chrome)"` / `"Default (Firefox)"` etc. automatically when the extension pushes its first session |
| **Create a library** | Click the **＋** button at the top of the sidebar |

The web dashboard works in **any browser** — even browsers without the extension installed.

### Install as Desktop App (PWA)

The companion web UI is a fully installable PWA:

- **Easiest:** Click the **📲 Install** button in the bottom-left sidebar of the dashboard.
  The button appears automatically when your browser supports PWA installation.
- **Chrome:** click the **⊕** icon in the address bar, or menu → Cast/Save → Install page as app.
- **Edge:** `...` menu → Apps → Install this site as an app.

Once installed, MindVault opens as a standalone window (no browser chrome).
To uninstall the PWA, see the Repair/Uninstall Guide.

---

## Quick Rebuild & Update (Already Installed)

Use these steps after pulling source changes or making edits.

### 1 — Rebuild companion + install

```powershell
# Build
Set-Location 'C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\companion'
& 'C:\Program Files\Go\bin\go.exe' build ./cmd/mvaultd

# Stop old daemon, copy new binary, restart
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
Copy-Item '.\mvaultd.exe' "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -Force
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden

# Verify
Start-Sleep -Seconds 1
(Invoke-WebRequest http://127.0.0.1:47821/health).Content
```

### 2 — Rebuild Chrome extension

```powershell
Set-Location 'C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\packages\extension'
& 'E:\Program Files\nodejs\node.exe' '.\node_modules\vite\bin\vite.js' build
# Then reload at chrome://extensions (click the ↺ refresh icon on the MindVault card)
```

### 3 — Rebuild Firefox extension

```powershell
Set-Location 'C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\packages\extension'
& 'E:\Program Files\nodejs\node.exe' '.\node_modules\vite\bin\vite.js' build --config vite.config.firefox.ts
# Then reload at about:debugging → This Firefox → MindVault → Reload
```

### 4 — Run all tests

```powershell
# TypeScript (116 tests)
Set-Location 'C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\packages\extension'
& 'E:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run

# Go (27 tests)
Set-Location 'C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\companion'
& 'C:\Program Files\Go\bin\go.exe' test -count=1 ./...
```

> **Bat scripts for convenience:**
> - `C:\Temp\build-extension.bat` — Chrome build
> - `C:\Temp\install-mv-companion.ps1` — full stop/build/copy/start cycle

---

## Developer Setup (Build from Source)

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 (v24.13.1 tested) | `E:\Program Files\nodejs\node.exe` on dev machine |
| pnpm | ≥ 9 (10.30.1 tested) | `npm install -g pnpm` |
| Go | ≥ 1.21 (1.26.0 tested) | `C:\Program Files\Go\bin\go.exe` |
| Git | any | Windows: Git for Windows |

### Clone and Install

```bash
git clone https://github.com/yourusername/mindvault.git
cd mindvault
pnpm install
```

> **pnpm on Windows (Git Bash):** if the shell wrapper is broken, use:
> ```bash
> node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" install
> ```

### Build the Extension (Chrome/Edge/Brave/Vivaldi/Opera)

```bash
# Git Bash — set Node PATH first:
export PATH="/e/Program Files/nodejs:$PATH"
cd packages/extension
npx vite build
```

Output: `packages/extension/dist/`

Helper script: `C:\Temp\build-extension.bat`

### Build the Extension (Firefox)

```bash
export PATH="/e/Program Files/nodejs:$PATH"
cd packages/extension
npx vite build --config vite.config.firefox.ts
```

Output: `packages/extension/dist-firefox/`

### Build the Companion Daemon

```bash
# Git Bash:
export PATH="/c/Program Files/Go/bin:$PATH"
cd companion
go build ./cmd/mvaultd
```

Output: `companion/mvaultd.exe` (in the `companion/` directory, **not** `companion/bin/`)

```powershell
# PowerShell equivalent:
$env:PATH = "C:\Program Files\Go\bin;" + $env:PATH
Set-Location "mindvault\companion"
go build .\cmd\mvaultd
```

### Run Tests

```bash
# Extension — 116 TypeScript tests:
cd packages/extension && npx vitest run

# Companion — 27 Go tests:
cd companion && go test -count=1 ./...

# Expected total: 143 tests, 0 failures
```

> **Windows PowerShell (no npx in PATH):**
> ```powershell
> & 'E:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run
> & 'C:\Program Files\Go\bin\go.exe' test -count=1 ./...
> ```

---

## Managing the Companion Daemon

### Check if running

```powershell
Get-Process mvaultd -ErrorAction SilentlyContinue
# Or visit: http://127.0.0.1:47821/health
```

### Start manually

```powershell
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden
```

### Stop

```powershell
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
```

### Restart

```powershell
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden
```

### Auto-start at login

**Option A — Settings UI (recommended):**
Open `http://127.0.0.1:47821/ui/` → Settings (⚙️) → **Auto-Start** card → click **▶ Enable**.
This registers a Task Scheduler logon job with no admin prompt required.

**Option B — Installer flag (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.ps1" -AutoStart
```

**Option B — Installer flag (CMD):**
```cmd
"C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.bat" /autostart
```

**Option B — Installer flag (Python):**
```cmd
python "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.py" --auto-start
```

**Option C — Manual Task Scheduler:**
```powershell
schtasks /Create /F /TN "MindVault Companion Daemon" `
  /TR "`"$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe`"" `
  /SC ONLOGON /RL LIMITED
```

---

## File Locations

| File | Path |
|------|------|
| Companion binary | `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe` |
| Auth token | `%LOCALAPPDATA%\MindVault\token` |
| SQLite database | `%APPDATA%\MindVault\db.sqlite` |
| Native messaging manifest | `%LOCALAPPDATA%\MindVault\com.mindvault.companion.json` |
| Task Scheduler job | Task Scheduler → `MindVault Companion Daemon` |

### Registry keys (native messaging)

| Browser | Key |
|---------|-----|
| Chrome | `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion` |
| Edge | `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.mindvault.companion` |
| Brave | `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.mindvault.companion` |
| Firefox | `HKCU\Software\Mozilla\NativeMessagingHosts\com.mindvault.companion` |
| Opera | `HKCU\Software\Opera Software\NativeMessagingHosts\com.mindvault.companion` |
| Vivaldi | `HKCU\Software\Vivaldi\NativeMessagingHosts\com.mindvault.companion` |

---

## Troubleshooting

### Extension popup shows no tabs

**Firefox only:** Ensure loaded from `dist-firefox/manifest.json` (not `dist/`).
The popup uses `lastFocusedWindow: true` — make sure a browser window was active, not just the popup.

**All browsers:** Internal URLs (`chrome://`, `about:`, `edge://`, etc.) are filtered out by design.

### Companion health check fails (connection refused)

1. Check if running: `Get-Process mvaultd`
2. Start it: `Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden`
3. Check Windows Defender Firewall — port 47821 must be allowed for localhost.
4. Verify binary exists: `Test-Path "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe"`

### Auto-start toggle has no effect

- Settings UI toggle only works on Windows (uses `schtasks.exe`).
- Run `schtasks /Query /TN "MindVault Companion Daemon"` to verify task exists.
- If it fails, re-run the installer with `-AutoStart` flag.

### Native messaging not working

1. Verify registry key exists for your browser (see File Locations above).
2. Verify the JSON manifest points to the correct binary path.
3. Re-run the installer script to re-register.

### Extension won't load in Chrome (manifest error)

- Load the `dist/` folder, not the `src/` folder.
- `dist/` must contain `manifest.json` at its top level.
- After source changes: rebuild → reload in `chrome://extensions` → click the refresh icon.

### pnpm install fails on Windows

```bash
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" install
```

### Companion binary build goes to wrong path

`go build ./cmd/mvaultd` outputs to the **current directory** (`companion/mvaultd.exe`).
Do NOT use `-o bin\mvaultd.exe` unless you also update the install copy command.

---

## Helper Scripts

### Installer scripts (run from any directory)

| Script | Invocation | Notes |
|--------|-----------|-------|
| `tools\install-companion\install.ps1` | `powershell -ExecutionPolicy Bypass -File "<abs-path>"` | Recommended; flags: `-AutoStart` `-Force` `-NoExtension` |
| `tools\install-companion\install.bat` | `"<abs-path>"` | CMD fallback; flags: `/autostart` `/force` `/noext` |
| `tools\install-companion\install.py` | `python "<abs-path>"` | Python fallback; flags: `--auto-start` `--force` `--no-extension` |
| `tools\install-companion\uninstall-windows.ps1` | `powershell -ExecutionPolicy Bypass -File "<abs-path>"` | Remove daemon + registry + manifests |

**Absolute paths on this machine:**

```
C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.ps1
C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.bat
C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\install.py
C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\tools\install-companion\uninstall-windows.ps1
```

### Build / test helpers

| Script | Purpose |
|--------|---------|
| `C:\Temp\build-extension.bat` | Build Chrome/Edge build → `dist/` |
| `C:\Temp\build-firefox.bat` | Build Firefox build → `dist-firefox/` |
| `C:\Temp\run-extension-tests.bat` | Run 116 TypeScript tests |

---

_For repair, reinstall, and complete uninstall steps, see [RE-UN-INSTALLATION_GUIDE.md](./RE-UN-INSTALLATION_GUIDE.md)._
