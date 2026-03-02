# MindVault — Repair, Reinstall & Uninstall Guide
_Last updated: 2026-02-26 | Version: 4.0.0_

---

## What Can Be Fully Removed?

**Yes — everything MindVault installs can be completely removed** with no system leftovers:

| Component | Removable? | Data lost? |
|-----------|-----------|-----------|
| Browser extension | ✅ Yes — remove from browser extensions page | Yes — IndexedDB data deleted with it |
| PWA (desktop app shortcut) | ✅ Yes — uninstall like any app | No — just the shortcut; data stays in companion |
| Companion daemon (binary) | ✅ Yes — stop + delete files | No data loss (database is separate) |
| SQLite database | ✅ Yes — delete `%APPDATA%\MindVault\` | **Yes — all your saved data** |
| Task Scheduler auto-start job | ✅ Yes — one command | No |
| Registry keys (native messaging) | ✅ Yes — per-browser keys in HKCU | No |
| Auth token | ✅ Yes — part of LOCALAPPDATA removal | No |

> **Tip:** If you only want to stop MindVault running without losing data, just stop
> the daemon and disable auto-start. Your SQLite database and browser extension data
> remain intact and usable after a reinstall.

---

## Section 1 — Repair (Fix Without Data Loss)

Use repair when: the companion crashes on start, the extension can't connect, native
messaging broke after a browser update, or a settings toggle stopped working.

### 1A — Repair: Companion Won't Start

```powershell
# 1. Kill any stuck process
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Verify binary exists and is not corrupted
$bin = "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe"
if (-not (Test-Path $bin)) {
    Write-Host "Binary missing — rebuild or re-copy mvaultd.exe to $bin"
} else {
    $ver = & $bin --version 2>&1
    Write-Host "Binary OK: $ver"
}

# 3. Start it again
Start-Process $bin -WindowStyle Hidden
Start-Sleep -Seconds 1

# 4. Health check
Invoke-WebRequest http://127.0.0.1:47821/health -UseBasicParsing | Select -Expand Content
```

### 1B — Repair: Native Messaging Broke (Extension Can't Reach Companion)

Happens after: browser update, registry corruption, or moving the binary.

```powershell
# Re-run the installer (re-registers all native messaging hosts, no data loss):
powershell.exe -ExecutionPolicy Bypass `
  -File "tools\install-companion\install-windows.ps1" -Force
```

Then reload the extension in your browser (`chrome://extensions` → refresh icon on MindVault).

### 1C — Repair: Auto-Start Task Scheduler Job Broken

```powershell
# Remove the broken task and recreate it:
schtasks /Delete /TN "MindVault Companion Daemon" /F 2>$null

$bin = "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe"
schtasks /Create /F /TN "MindVault Companion Daemon" `
  /TR "`"$bin`"" /SC ONLOGON /RL LIMITED

# Verify:
schtasks /Query /TN "MindVault Companion Daemon" /FO LIST
```

Or use the Settings UI: open `http://127.0.0.1:47821/ui/` → ⚙️ Settings → Auto-Start → **⏹ Disable**, wait, then **▶ Enable**.

### 1D — Repair: Extension Shows Old/Stale Data in Dashboard

The PWA service worker may be serving a cached old version of the web UI.

1. Open `http://127.0.0.1:47821/ui/` in your browser.
2. Open DevTools (F12) → Application tab → Service Workers.
3. Click **Unregister** next to the MindVault SW.
4. Go to Application → Cache Storage → delete `mv-ui-v1` (or any `mv-ui-*` cache).
5. Hard-reload: Ctrl+Shift+R.

### 1E — Repair: SQLite Database Locked or Corrupted

```powershell
# 1. Stop daemon
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Back up current database
$db = "$env:APPDATA\MindVault\db.sqlite"
Copy-Item $db "$db.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Write-Host "Backup saved."

# 3. Check integrity (requires sqlite3.exe in PATH — optional)
# sqlite3 $db "PRAGMA integrity_check;"

# 4. Restart daemon — it will attempt recovery on open
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden
```

If the database is unrecoverable, restore from the `.bak` file or reimport your data.

---

## Section 2 — Reinstall (Keep Data)

Use when: upgrading to a new binary, moving the companion to a new machine,
or recovering from a partial install.

### 2A — Update the Companion Binary (Keep All Data)

```powershell
# 1. Build new binary
# (from Git Bash in companion/ dir):
#   export PATH="/c/Program Files/Go/bin:$PATH"
#   go build ./cmd/mvaultd

# 2. Stop running daemon
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 3. Copy new binary (database stays untouched)
Copy-Item "companion\mvaultd.exe" "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -Force

# 4. Start updated daemon
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden
Start-Sleep -Seconds 1

# 5. Verify version
Invoke-WebRequest http://127.0.0.1:47821/health -UseBasicParsing | Select -Expand Content
```

### 2B — Reinstall Extension (Keep IndexedDB Data)

Removing and reloading a Chrome extension **does NOT delete IndexedDB data**
as long as you load it with the **same extension ID** (same `dist/` folder, same Chrome profile).

```
chrome://extensions → Remove MindVault → Load unpacked → select dist/ again
```

> ⚠️ If the extension ID changes (e.g. new Chrome profile or different folder),
> IndexedDB data is orphaned but not deleted. The old data remains under the old ID.
> Export your data first as a precaution.

### 2C — Full Reinstall on Same Machine (Keep SQLite Data)

```powershell
# 1. Stop daemon
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue

# 2. Remove binary + token only (NOT the data folder)
Remove-Item "$env:LOCALAPPDATA\MindVault\bin" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\MindVault\token" -Force -ErrorAction SilentlyContinue
# NOTE: %APPDATA%\MindVault\db.sqlite is NOT removed — data preserved

# 3. Re-run installer
powershell.exe -ExecutionPolicy Bypass `
  -File "tools\install-companion\install-windows.ps1"

# 4. Verify dashboard and data intact
Start-Process http://127.0.0.1:47821/ui/
```

### 2D — Move to a New Machine (Migrate Data)

```powershell
# On OLD machine — export database:
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Copy-Item "$env:APPDATA\MindVault\db.sqlite" "C:\Transfer\mv-db-backup.sqlite"

# On NEW machine — after installing companion:
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory "$env:APPDATA\MindVault" -Force | Out-Null
Copy-Item "C:\Transfer\mv-db-backup.sqlite" "$env:APPDATA\MindVault\db.sqlite"
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden

# The new companion reads the migrated database immediately.
```

---

## Section 3 — Uninstall (Complete Removal)

### 3A — Uninstall: Browser Extension

**Chrome / Edge / Brave / Vivaldi / Opera:**
1. Open `chrome://extensions` (or equivalent for your browser).
2. Find **MindVault** → click **Remove** → confirm.
3. This also deletes all IndexedDB data stored by the extension in that browser profile.

**Firefox:**
1. Open `about:addons`.
2. Find **MindVault** → click the `...` menu → **Remove**.
3. If loaded as a Temporary Add-on (`about:debugging`): click **Remove** next to MindVault.

### 3B — Uninstall: PWA (Desktop App Shortcut)

**Windows (installed from Chrome):**

Option A — From Windows:
1. Start menu → search "MindVault" → right-click → **Uninstall**
   (or Settings → Apps → search MindVault → Uninstall)

Option B — From Chrome:
1. Open `chrome://apps`
2. Right-click MindVault → **Remove from Chrome**

Option C — From the app itself:
1. Open MindVault PWA window
2. Click `...` menu (top-right) → **Uninstall MindVault…** → confirm

**Windows (installed from Edge):**
1. Open `edge://apps`
2. Find MindVault → `...` → **Uninstall**
3. Or: Settings → Apps → MindVault → Uninstall

> Uninstalling the PWA does **not** delete your data. The companion SQLite database
> and extension data are unaffected.

### 3C — Uninstall: Companion Daemon + All Files

Run this in PowerShell (no admin required — everything is in HKCU and LOCALAPPDATA):

```powershell
# ── Step 1: Stop daemon ────────────────────────────────────────────────────────
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# ── Step 2: Remove Task Scheduler auto-start job ──────────────────────────────
schtasks /Delete /TN "MindVault Companion Daemon" /F 2>$null
Write-Host "Task Scheduler job removed."

# ── Step 3: Remove registry keys (native messaging hosts) ────────────────────
$nmBase = "HKCU:\Software"
$keys = @(
    "$nmBase\Google\Chrome\NativeMessagingHosts\com.mindvault.companion",
    "$nmBase\Microsoft\Edge\NativeMessagingHosts\com.mindvault.companion",
    "$nmBase\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.mindvault.companion",
    "$nmBase\Mozilla\NativeMessagingHosts\com.mindvault.companion",
    "$nmBase\Opera Software\NativeMessagingHosts\com.mindvault.companion",
    "$nmBase\Vivaldi\NativeMessagingHosts\com.mindvault.companion"
)
foreach ($key in $keys) {
    if (Test-Path $key) {
        Remove-Item $key -Force
        Write-Host "Removed: $key"
    }
}

# ── Step 4: Remove binary, token, manifest (LOCALAPPDATA) ────────────────────
Remove-Item "$env:LOCALAPPDATA\MindVault" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Removed: %LOCALAPPDATA%\MindVault"

# ── Step 5 (OPTIONAL): Remove database / all your data ───────────────────────
# WARNING: This permanently deletes all saved tabs, sessions, bookmarks, history.
# Skip this step if you plan to reinstall later and want to keep your data.
#
# Remove-Item "$env:APPDATA\MindVault" -Recurse -Force -ErrorAction SilentlyContinue
# Write-Host "Removed: %APPDATA%\MindVault (ALL DATA DELETED)"

Write-Host ""
Write-Host "Companion uninstalled. Extension and browser data are unaffected."
Write-Host "To also delete your data, manually remove: $env:APPDATA\MindVault"
```

### 3D — Uninstall: Browser Extension IndexedDB Data

After removing the extension from the browser, the IndexedDB data is usually deleted
automatically. If you want to force-delete it:

**Chrome / Edge / Brave:**
1. Go to `chrome://settings/cookies`
2. Search for `127.0.0.1` — delete any MindVault storage entries.
3. Or: DevTools (F12) → Application → IndexedDB → right-click MindVault DB → Delete.

**Firefox:**
1. `about:preferences#privacy` → Cookies and Site Data → Manage Data
2. Search `127.0.0.1` → Remove selected.

### 3E — Complete Wipe (Everything — No Trace Left)

Run steps 3A + 3B + 3C (including Step 5 for data) + 3D in order.

Checklist after full wipe:

- [ ] Extension removed from all browsers
- [ ] PWA uninstalled from Windows
- [ ] `%LOCALAPPDATA%\MindVault\` — deleted
- [ ] `%APPDATA%\MindVault\` — deleted (all data gone)
- [ ] Registry keys — all 6 removed (verify with `regedit` → HKCU\Software)
- [ ] Task Scheduler job — removed (verify with `taskschd.msc`)
- [ ] Browser IndexedDB — cleared
- [ ] Browser SW cache — cleared (if PWA was installed)

---

## Quick Reference — Stop / Start / Verify

```powershell
# Stop
Stop-Process -Name mvaultd -Force -ErrorAction SilentlyContinue

# Start
Start-Process "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe" -WindowStyle Hidden

# Health check
Invoke-WebRequest http://127.0.0.1:47821/health -UseBasicParsing | Select -Expand Content

# Check Task Scheduler
schtasks /Query /TN "MindVault Companion Daemon" /FO LIST

# Check registry (Chrome as example)
Get-Item "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion"
```

---

_For first-time install instructions, see [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)._
