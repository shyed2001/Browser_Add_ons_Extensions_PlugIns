# ==============================================================================
# MindVault — Full Windows Installer
# Installs companion daemon + native messaging + opens extension pages
# ==============================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File install-windows-full.ps1
#   powershell -ExecutionPolicy Bypass -File install-windows-full.ps1 -AutoStart
#   powershell -ExecutionPolicy Bypass -File install-windows-full.ps1 -AutoStart -Force
#
# Parameters:
#   -AutoStart     Register Task Scheduler logon job (no admin required)
#   -Force         Stop and replace even if daemon is already running
#   -NoExtension   Skip opening browser extension install pages
#   -BinaryPath    Override auto-detected source binary path
#   -ExtDir        Override auto-detected extension dist/ folder
# ==============================================================================

param(
    [string]$BinaryPath  = "",
    [string]$ExtDir      = "",
    [switch]$AutoStart,
    [switch]$Force,
    [switch]$NoExtension
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Constants ──────────────────────────────────────────────────────────────────
$AppName      = "MindVault"
$DaemonName   = "com.mindvault.companion"
$TaskName     = "MindVault Companion Daemon"
$InstallDir   = "$env:LOCALAPPDATA\MindVault\bin"
$DataDir      = "$env:APPDATA\MindVault"
$InstalledBin = "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe"
$CrManifest   = "$env:LOCALAPPDATA\MindVault\$DaemonName.json"   # Chromium manifest
$FxManifestD  = "$env:APPDATA\Mozilla\NativeMessagingHosts"       # Firefox dir
$FxManifest   = "$FxManifestD\$DaemonName.json"                   # Firefox manifest

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step { param([string]$msg) Write-Host "  ► $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "  ✗ $msg" -ForegroundColor Red }
function Log-Info   { param([string]$msg) Write-Host "    $msg" -ForegroundColor DarkGray }

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   MindVault — Full Windows Installer         ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── Step 1: Find companion binary ─────────────────────────────────────────────
Write-Step "Locating mvaultd.exe..."

if (-not $BinaryPath) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot  = Split-Path -Parent (Split-Path -Parent $ScriptDir)
    $candidates = @(
        (Join-Path $RepoRoot "companion\mvaultd.exe"),          # built in-place (correct)
        (Join-Path $RepoRoot "companion\bin\mvaultd.exe"),      # old path (fallback)
        $InstalledBin,                                          # already installed
        ".\mvaultd.exe"                                         # current dir
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $BinaryPath = $c; break }
    }
}

if (-not $BinaryPath -or -not (Test-Path $BinaryPath)) {
    Write-Fail "mvaultd.exe not found. Build it first:"
    Log-Info "  cd companion"
    Log-Info "  go build ./cmd/mvaultd"
    Log-Info "Then retry or pass: -BinaryPath <path\to\mvaultd.exe>"
    exit 1
}
Write-OK "Binary: $BinaryPath"

# ── Step 2: Find extension dist/ folder ───────────────────────────────────────
if (-not $NoExtension) {
    Write-Step "Locating extension dist/ folder..."
    if (-not $ExtDir) {
        $ScriptDir2 = Split-Path -Parent $MyInvocation.MyCommand.Path
        $RepoRoot2  = Split-Path -Parent (Split-Path -Parent $ScriptDir2)
        $extCandidates = @(
            (Join-Path $RepoRoot2 "packages\extension\dist"),
            (Join-Path $RepoRoot2 "dist")
        )
        foreach ($c in $extCandidates) {
            if (Test-Path (Join-Path $c "manifest.json")) { $ExtDir = $c; break }
        }
    }
    $ExtDirFirefox = ""
    if ($ExtDir) {
        $parentDir = Split-Path -Parent $ExtDir
        $fxCandidate = Join-Path $parentDir "dist-firefox"
        if (Test-Path (Join-Path $fxCandidate "manifest.json")) {
            $ExtDirFirefox = $fxCandidate
        }
        Write-OK "Chrome/Edge dist : $ExtDir"
        if ($ExtDirFirefox) { Write-OK "Firefox dist     : $ExtDirFirefox" }
        else { Write-Warn "Firefox dist-firefox/ not found (build it separately)" }
    } else {
        Write-Warn "Extension dist/ not found. Build first:"
        Log-Info "  cd packages\extension"
        Log-Info "  npx vite build"
        Log-Info "Continuing with companion install only..."
    }
}

# ── Step 3: Stop running daemon if needed ─────────────────────────────────────
Write-Step "Checking for running daemon..."
$running = Get-Process -Name "mvaultd" -ErrorAction SilentlyContinue
if ($running) {
    if (-not $Force) {
        Write-Warn "Daemon already running (PID $($running.Id)). Use -Force to replace."
        $ans = Read-Host "    Stop it and continue? [Y/n]"
        if ($ans -match '^[Nn]') { Write-Host "Aborted."; exit 0 }
    }
    Stop-Process -Name "mvaultd" -Force
    Start-Sleep -Milliseconds 800
    Write-OK "Stopped previous daemon"
} else {
    Write-OK "No daemon running"
}

# ── Step 4: Create directories + install binary ────────────────────────────────
Write-Step "Installing binary to $InstallDir..."
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir    -Force | Out-Null
Copy-Item -Path $BinaryPath -Destination $InstalledBin -Force
Write-OK "Binary installed: $InstalledBin"

# Verify it runs
try {
    $ver = & $InstalledBin --version 2>&1
    Write-OK "Verified: $ver"
} catch {
    Write-Warn "Binary ran but --version flag not supported (non-fatal)"
}

# ── Step 5: Write native messaging manifest (Chromium format) ─────────────────
Write-Step "Writing native messaging manifest..."
$escapedBin = $InstalledBin.Replace('\', '\\')
$crManifestJson = @"
{
  "name": "$DaemonName",
  "description": "MindVault Companion Daemon — SQLite mirror, REST API, and native messaging bridge",
  "path": "$escapedBin",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://*/",
    "app://*"
  ]
}
"@
[System.IO.File]::WriteAllText($CrManifest, $crManifestJson.Trim(), [System.Text.Encoding]::UTF8)
Write-OK "Chromium manifest: $CrManifest"

# Firefox manifest (uses allowed_extensions instead of allowed_origins)
New-Item -ItemType Directory -Path $FxManifestD -Force | Out-Null
$fxManifestJson = @"
{
  "name": "$DaemonName",
  "description": "MindVault Companion Daemon — SQLite mirror and REST API",
  "path": "$escapedBin",
  "type": "stdio",
  "allowed_extensions": [
    "mindvault@mindvault.app",
    "*"
  ]
}
"@
[System.IO.File]::WriteAllText($FxManifest, $fxManifestJson.Trim(), [System.Text.Encoding]::UTF8)
Write-OK "Firefox manifest : $FxManifest"

# ── Step 6: Detect installed browsers + register native messaging ──────────────
Write-Step "Detecting installed browsers and registering native messaging..."

# Each entry: Exe = path to detect, RegKey = HKCU registry key to create
# Firefox uses file-based manifest (already written above) + optional registry
$browserDefs = [ordered]@{
    "Chrome"       = @{
        Exe    = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        RegKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$DaemonName"
        ExtUrl = "chrome://extensions"
        Dist   = "dist"
    }
    "Chrome Beta"  = @{
        Exe    = "$env:LOCALAPPDATA\Google\Chrome Beta\Application\chrome.exe"
        RegKey = "HKCU:\Software\Google\Chrome Beta\NativeMessagingHosts\$DaemonName"
        ExtUrl = "chrome://extensions"
        Dist   = "dist"
    }
    "Chrome Dev"   = @{
        Exe    = "$env:LOCALAPPDATA\Google\Chrome Dev\Application\chrome.exe"
        RegKey = "HKCU:\Software\Google\Chrome Dev\NativeMessagingHosts\$DaemonName"
        ExtUrl = "chrome://extensions"
        Dist   = "dist"
    }
    "Chromium"     = @{
        Exe    = "$env:LOCALAPPDATA\Chromium\Application\chrome.exe"
        RegKey = "HKCU:\Software\Chromium\NativeMessagingHosts\$DaemonName"
        ExtUrl = "chrome://extensions"
        Dist   = "dist"
    }
    "Edge"         = @{
        Exe    = "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
        RegKey = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$DaemonName"
        ExtUrl = "edge://extensions"
        Dist   = "dist"
    }
    "Edge Beta"    = @{
        Exe    = "$env:LOCALAPPDATA\Microsoft\Edge Beta\Application\msedge.exe"
        RegKey = "HKCU:\Software\Microsoft\Edge Beta\NativeMessagingHosts\$DaemonName"
        ExtUrl = "edge://extensions"
        Dist   = "dist"
    }
    "Brave"        = @{
        Exe    = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
        RegKey = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$DaemonName"
        ExtUrl = "brave://extensions"
        Dist   = "dist"
    }
    "Opera"        = @{
        Exe    = "$env:APPDATA\Opera Software\Opera Stable\opera.exe"
        RegKey = "HKCU:\Software\Opera Software\NativeMessagingHosts\$DaemonName"
        ExtUrl = "opera://extensions"
        Dist   = "dist"
    }
    "Opera GX"     = @{
        Exe    = "$env:APPDATA\Opera Software\Opera GX Stable\opera.exe"
        RegKey = "HKCU:\Software\Opera Software\Opera GX Stable\NativeMessagingHosts\$DaemonName"
        ExtUrl = "opera://extensions"
        Dist   = "dist"
    }
    "Vivaldi"      = @{
        Exe    = "$env:LOCALAPPDATA\Vivaldi\Application\vivaldi.exe"
        RegKey = "HKCU:\Software\Vivaldi\NativeMessagingHosts\$DaemonName"
        ExtUrl = "vivaldi://extensions"
        Dist   = "dist"
    }
    "Firefox"      = @{
        Exe    = "C:\Program Files\Mozilla Firefox\firefox.exe"
        RegKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\$DaemonName"
        ExtUrl = "about:debugging#/runtime/this-firefox"
        Dist   = "dist-firefox"
        FxFile = $true   # Also write file-based manifest (already done above)
    }
    "Firefox ESR"  = @{
        Exe    = "C:\Program Files\Mozilla Firefox ESR\firefox.exe"
        RegKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\$DaemonName"
        ExtUrl = "about:debugging#/runtime/this-firefox"
        Dist   = "dist-firefox"
        FxFile = $true
    }
}

$installedBrowsers = [System.Collections.Generic.List[hashtable]]::new()
$skippedBrowsers   = [System.Collections.Generic.List[string]]::new()

foreach ($name in $browserDefs.Keys) {
    $def   = $browserDefs[$name]
    $found = Test-Path $def.Exe -ErrorAction SilentlyContinue

    if ($found) {
        # Register in registry
        try {
            $parentKey = Split-Path $def.RegKey -Parent
            if (-not (Test-Path $parentKey)) {
                New-Item -Path $parentKey -Force | Out-Null
            }
            New-Item -Path $def.RegKey -Force | Out-Null
            # Chromium: point to Chromium manifest; Firefox: point to Firefox manifest
            $manifestTarget = if ($def.ContainsKey("FxFile")) { $FxManifest } else { $CrManifest }
            Set-ItemProperty -Path $def.RegKey -Name "(default)" -Value $manifestTarget
            Write-OK "  $name — native messaging registered"
            $installedBrowsers.Add(@{ Name = $name; Exe = $def.Exe; ExtUrl = $def.ExtUrl; Dist = $def.Dist })
        } catch {
            Write-Warn "  $name — registry write failed: $_"
        }
    } else {
        $skippedBrowsers.Add($name)
    }
}

if ($skippedBrowsers.Count -gt 0) {
    Log-Info "Not installed (skipped): $($skippedBrowsers -join ', ')"
}

# ── Step 7: Task Scheduler auto-start (optional) ──────────────────────────────
if ($AutoStart) {
    Write-Step "Registering Task Scheduler auto-start job..."
    try {
        schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
        schtasks /Create /F `
            /TN $TaskName `
            /TR "`"$InstalledBin`"" `
            /SC ONLOGON `
            /RL LIMITED | Out-Null
        Write-OK "Task '$TaskName' registered — daemon starts at every login"
    } catch {
        Write-Warn "Task Scheduler failed (non-fatal): $_"
        Log-Info "Start manually: Start-Process '$InstalledBin' -WindowStyle Hidden"
    }
} else {
    Log-Info "Tip: re-run with -AutoStart to launch daemon automatically at login"
    Log-Info "Or use Settings → Auto-Start toggle in the web dashboard after install"
}

# ── Step 8: Start daemon + wait for health check ──────────────────────────────
Write-Step "Starting companion daemon..."
Start-Process -FilePath $InstalledBin -WindowStyle Hidden
Start-Sleep -Seconds 2

$proc = Get-Process -Name "mvaultd" -ErrorAction SilentlyContinue
if ($proc) {
    Write-OK "Daemon running (PID $($proc.Id))"
} else {
    Write-Fail "Daemon did not start. Try manually:"
    Log-Info "  Start-Process '$InstalledBin'"
    exit 1
}

# Health check
try {
    $health = Invoke-WebRequest "http://127.0.0.1:47821/health" -UseBasicParsing -TimeoutSec 5
    Write-OK "Health check: $($health.Content)"
} catch {
    Write-Warn "Health check timed out — daemon may still be starting. Check: http://127.0.0.1:47821/health"
}

# Show auth token location
$tokenFile = "$env:LOCALAPPDATA\MindVault\token"
if (Test-Path $tokenFile) {
    $tok = Get-Content $tokenFile -Raw
    Write-OK "Auth token: $($tok.Trim().Substring(0, [Math]::Min(12, $tok.Trim().Length)))… (saved at $tokenFile)"
} else {
    Log-Info "Auth token will be generated on first daemon run at: $tokenFile"
}

# ── Step 9: Extension install — open each browser's extensions page ────────────
if (-not $NoExtension -and $installedBrowsers.Count -gt 0) {
    Write-Host ""
    Write-Host "  ════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Browser Extension Install" -ForegroundColor Cyan
    Write-Host "  ════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    # NOTE: Unpacked extensions can't be auto-installed without group policy.
    # We open each browser's extensions page and print the exact path to Load Unpacked.
    # The user clicks Load Unpacked → selects the folder shown → done.

    if (-not $ExtDir) {
        Write-Warn "Extension dist/ folder not found — skipping browser extension steps."
        Log-Info "  cd packages\extension"
        Log-Info "  npx vite build"
    } else {
        $shownUrls = @{}   # deduplicate — Edge Beta + Edge both use edge://extensions

        foreach ($b in $installedBrowsers) {
            $name    = $b.Name
            $extUrl  = $b.ExtUrl
            $distKey = $b.Dist

            # Resolve correct dist folder
            if ($distKey -eq "dist-firefox") {
                $folder = if ($ExtDirFirefox) { $ExtDirFirefox } else { "(build dist-firefox first)" }
            } else {
                $folder = $ExtDir
            }

            Write-Host "  [$name]" -ForegroundColor White
            Write-Host "    Extensions page : $extUrl" -ForegroundColor DarkGray
            Write-Host "    Load Unpacked   : $folder" -ForegroundColor Yellow
            if ($distKey -eq "dist-firefox") {
                Write-Host "    How             : Load Temporary Add-on → select manifest.json" -ForegroundColor DarkGray
            } else {
                Write-Host "    How             : Enable Developer Mode → Load unpacked → select folder above" -ForegroundColor DarkGray
            }
            Write-Host ""

            # Open the extensions page (deduplicated by URL)
            if (-not $shownUrls.ContainsKey($extUrl)) {
                $shownUrls[$extUrl] = $true
                try {
                    Start-Process $b.Exe $extUrl -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 600
                } catch { <# non-fatal #> }
            }
        }

        Write-Host "  Opened extensions page in each detected browser." -ForegroundColor Green
        Write-Host "  Follow the on-screen steps above to load MindVault." -ForegroundColor Green
    }
}

# ── Step 10: Final summary ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "  ════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Companion binary  : $InstalledBin" -ForegroundColor White
Write-Host "  Database location : $DataDir\db.sqlite" -ForegroundColor White
Write-Host "  Auth token        : $env:LOCALAPPDATA\MindVault\token" -ForegroundColor White
Write-Host "  Chromium manifest : $CrManifest" -ForegroundColor White
Write-Host "  Firefox manifest  : $FxManifest" -ForegroundColor White
if ($AutoStart) {
    Write-Host "  Auto-start        : Task Scheduler → '$TaskName'" -ForegroundColor White
} else {
    Write-Host "  Auto-start        : Not configured (use -AutoStart or Settings UI)" -ForegroundColor DarkGray
}
Write-Host ""

# Browsers registered
if ($installedBrowsers.Count -gt 0) {
    $bNames = ($installedBrowsers | ForEach-Object { $_.Name }) -join ", "
    Write-Host "  Native messaging  : $bNames" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Open web dashboard     : http://127.0.0.1:47821/ui/" -ForegroundColor Cyan
Write-Host "  Health check           : http://127.0.0.1:47821/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To start dashboard now:" -ForegroundColor DarkGray
Write-Host "    Start-Process 'http://127.0.0.1:47821/ui/'" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To uninstall everything:" -ForegroundColor DarkGray
Write-Host "    powershell -ExecutionPolicy Bypass -File tools\install-companion\uninstall-windows.ps1" -ForegroundColor DarkGray
Write-Host ""

# Open dashboard in default browser
$openDash = Read-Host "  Open MindVault dashboard in browser now? [Y/n]"
if ($openDash -notmatch '^[Nn]') {
    Start-Process "http://127.0.0.1:47821/ui/"
}
