# ==============================================================================
# MindVault — Full Windows Installer  (install.ps1)
# Installs companion daemon + native messaging + opens extension pages
#
# USAGE (run from ANY directory):
#   powershell -ExecutionPolicy Bypass -File tools\install-companion\install.ps1
#   powershell -ExecutionPolicy Bypass -File tools\install-companion\install.ps1 -AutoStart
#   powershell -ExecutionPolicy Bypass -File tools\install-companion\install.ps1 -AutoStart -Force
#
# PARAMETERS:
#   -AutoStart     Register Task Scheduler logon job (no admin required)
#   -Force         Stop and replace daemon without prompting
#   -NoExtension   Skip opening browser extension install pages
#   -BinaryPath    Override auto-detected source mvaultd.exe path
#   -ExtDir        Override auto-detected extension dist/ folder
# ==============================================================================

param(
    [string]$BinaryPath  = "",
    [string]$ExtDir      = "",
    [switch]$AutoStart,
    [switch]$Force,
    [switch]$NoExtension
)

$ErrorActionPreference = "Stop"

# ── Constants ──────────────────────────────────────────────────────────────────
$DaemonName   = "com.mindvault.companion"
$TaskName     = "MindVault Companion Daemon"
$InstallDir   = "$env:LOCALAPPDATA\MindVault\bin"
$DataDir      = "$env:APPDATA\MindVault"
$InstalledBin = "$env:LOCALAPPDATA\MindVault\bin\mvaultd.exe"
$CrManifest   = "$env:LOCALAPPDATA\MindVault\$DaemonName.json"
$FxManifestD  = "$env:APPDATA\Mozilla\NativeMessagingHosts"
$FxManifest   = "$FxManifestD\$DaemonName.json"

# ── Banner ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   MindVault — Full Windows Installer         ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── Step 1: Locate mvaultd.exe ────────────────────────────────────────────────
Write-Host "  ► [1/8] Locating mvaultd.exe..." -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent (Split-Path -Parent $ScriptDir)

if (-not $BinaryPath) {
    foreach ($c in @(
        (Join-Path $RepoRoot "companion\mvaultd.exe"),
        (Join-Path $RepoRoot "companion\bin\mvaultd.exe"),
        $InstalledBin,
        ".\mvaultd.exe"
    )) {
        if (Test-Path $c) { $BinaryPath = $c; break }
    }
}

if (-not $BinaryPath -or -not (Test-Path $BinaryPath)) {
    Write-Host "  ✗ mvaultd.exe not found. Build it first:" -ForegroundColor Red
    Write-Host "    cd companion" -ForegroundColor DarkGray
    Write-Host "    go build ./cmd/mvaultd" -ForegroundColor DarkGray
    Write-Host "  Then retry or pass: -BinaryPath <path\to\mvaultd.exe>" -ForegroundColor DarkGray
    exit 1
}
Write-Host "  ✓ Binary: $BinaryPath" -ForegroundColor Green

# ── Step 2: Locate extension dist/ ───────────────────────────────────────────
$ExtDirFirefox = ""
if (-not $NoExtension) {
    Write-Host "  ► [2/8] Locating extension dist/ folder..." -ForegroundColor Cyan
    if (-not $ExtDir) {
        foreach ($c in @(
            (Join-Path $RepoRoot "packages\extension\dist"),
            (Join-Path $RepoRoot "dist")
        )) {
            if (Test-Path (Join-Path $c "manifest.json")) { $ExtDir = $c; break }
        }
    }
    if ($ExtDir) {
        $fxCandidate = Join-Path (Split-Path -Parent $ExtDir) "dist-firefox"
        if (Test-Path (Join-Path $fxCandidate "manifest.json")) {
            $ExtDirFirefox = $fxCandidate
        }
        Write-Host "  ✓ Chrome/Edge dist : $ExtDir" -ForegroundColor Green
        if ($ExtDirFirefox) {
            Write-Host "  ✓ Firefox dist     : $ExtDirFirefox" -ForegroundColor Green
        } else {
            Write-Host "  ! Firefox dist-firefox/ not found (run: npx vite build --config vite.config.firefox.ts)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ! Extension dist/ not found — will install companion only" -ForegroundColor Yellow
        Write-Host "    Build: cd packages\extension && npx vite build" -ForegroundColor DarkGray
    }
}

# ── Step 3: Stop running daemon ───────────────────────────────────────────────
Write-Host "  ► [3/8] Checking for running daemon..." -ForegroundColor Cyan
$running = Get-Process -Name "mvaultd" -ErrorAction SilentlyContinue
if ($running) {
    if (-not $Force) {
        Write-Host "  ! Daemon already running (PID $($running.Id)). Use -Force to skip this prompt." -ForegroundColor Yellow
        $ans = Read-Host "    Stop it and continue? [Y/n]"
        if ($ans -match '^[Nn]') { Write-Host "Aborted."; exit 0 }
    }
    Stop-Process -Name "mvaultd" -Force
    Start-Sleep -Milliseconds 800
    Write-Host "  ✓ Stopped previous daemon" -ForegroundColor Green
} else {
    Write-Host "  ✓ No daemon running" -ForegroundColor Green
}

# ── Step 4: Create dirs + install binary ──────────────────────────────────────
Write-Host "  ► [4/8] Installing binary to $InstallDir..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir    -Force | Out-Null
Copy-Item -Path $BinaryPath -Destination $InstalledBin -Force
Write-Host "  ✓ Installed: $InstalledBin" -ForegroundColor Green

try {
    $ver = & $InstalledBin --version 2>&1
    Write-Host "  ✓ Binary OK: $ver" -ForegroundColor Green
} catch {
    Write-Host "  ! --version not supported (non-fatal)" -ForegroundColor Yellow
}

# ── Step 5: Write native messaging manifests ──────────────────────────────────
Write-Host "  ► [5/8] Writing native messaging manifests..." -ForegroundColor Cyan

$crObj = [ordered]@{
    name            = $DaemonName
    description     = "MindVault Companion Daemon - SQLite mirror and REST API"
    path            = $InstalledBin
    type            = "stdio"
    allowed_origins = @("chrome-extension://*/", "app://*")
}
$crJson = $crObj | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($CrManifest, $crJson, [System.Text.Encoding]::UTF8)
Write-Host "  ✓ Chromium manifest : $CrManifest" -ForegroundColor Green

New-Item -ItemType Directory -Path $FxManifestD -Force | Out-Null
$fxObj = [ordered]@{
    name               = $DaemonName
    description        = "MindVault Companion Daemon - SQLite mirror and REST API"
    path               = $InstalledBin
    type               = "stdio"
    allowed_extensions = @("mindvault@mindvault.app", "*")
}
$fxJson = $fxObj | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($FxManifest, $fxJson, [System.Text.Encoding]::UTF8)
Write-Host "  ✓ Firefox  manifest : $FxManifest" -ForegroundColor Green

# ── Step 6: Detect browsers + register native messaging ───────────────────────
Write-Host "  ► [6/8] Detecting browsers and registering native messaging..." -ForegroundColor Cyan

$browserDefs = [ordered]@{
    "Chrome"      = @{ Exe = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe";                  Reg = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$DaemonName";                         Url = "chrome://extensions";  Dist = "dist" }
    "Chrome Beta" = @{ Exe = "$env:LOCALAPPDATA\Google\Chrome Beta\Application\chrome.exe";             Reg = "HKCU:\Software\Google\Chrome Beta\NativeMessagingHosts\$DaemonName";                   Url = "chrome://extensions";  Dist = "dist" }
    "Chrome Dev"  = @{ Exe = "$env:LOCALAPPDATA\Google\Chrome Dev\Application\chrome.exe";              Reg = "HKCU:\Software\Google\Chrome Dev\NativeMessagingHosts\$DaemonName";                    Url = "chrome://extensions";  Dist = "dist" }
    "Chromium"    = @{ Exe = "$env:LOCALAPPDATA\Chromium\Application\chrome.exe";                       Reg = "HKCU:\Software\Chromium\NativeMessagingHosts\$DaemonName";                             Url = "chrome://extensions";  Dist = "dist" }
    "Edge"        = @{ Exe = "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe";                 Reg = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$DaemonName";                       Url = "edge://extensions";    Dist = "dist" }
    "Edge Beta"   = @{ Exe = "$env:LOCALAPPDATA\Microsoft\Edge Beta\Application\msedge.exe";            Reg = "HKCU:\Software\Microsoft\Edge Beta\NativeMessagingHosts\$DaemonName";                  Url = "edge://extensions";    Dist = "dist" }
    "Brave"       = @{ Exe = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe";     Reg = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$DaemonName";          Url = "brave://extensions";   Dist = "dist" }
    "Opera"       = @{ Exe = "$env:APPDATA\Opera Software\Opera Stable\opera.exe";                      Reg = "HKCU:\Software\Opera Software\NativeMessagingHosts\$DaemonName";                       Url = "opera://extensions";   Dist = "dist" }
    "Opera GX"    = @{ Exe = "$env:APPDATA\Opera Software\Opera GX Stable\opera.exe";                   Reg = "HKCU:\Software\Opera Software\Opera GX Stable\NativeMessagingHosts\$DaemonName";       Url = "opera://extensions";   Dist = "dist" }
    "Vivaldi"     = @{ Exe = "$env:LOCALAPPDATA\Vivaldi\Application\vivaldi.exe";                       Reg = "HKCU:\Software\Vivaldi\NativeMessagingHosts\$DaemonName";                              Url = "vivaldi://extensions"; Dist = "dist" }
    "Firefox"     = @{ Exe = "C:\Program Files\Mozilla Firefox\firefox.exe";                            Reg = "HKCU:\Software\Mozilla\NativeMessagingHosts\$DaemonName";                              Url = "about:debugging#/runtime/this-firefox"; Dist = "dist-firefox"; IsFx = $true }
    "Firefox ESR" = @{ Exe = "C:\Program Files\Mozilla Firefox ESR\firefox.exe";                        Reg = "HKCU:\Software\Mozilla\NativeMessagingHosts\$DaemonName";                              Url = "about:debugging#/runtime/this-firefox"; Dist = "dist-firefox"; IsFx = $true }
}

$foundBrowsers = New-Object System.Collections.Generic.List[hashtable]
$skipped       = New-Object System.Collections.Generic.List[string]

foreach ($name in $browserDefs.Keys) {
    $def = $browserDefs[$name]
    if (Test-Path $def.Exe -ErrorAction SilentlyContinue) {
        try {
            $parentKey = Split-Path $def.Reg -Parent
            if (-not (Test-Path $parentKey)) { New-Item -Path $parentKey -Force | Out-Null }
            New-Item -Path $def.Reg -Force | Out-Null
            $mf = if ($def.ContainsKey("IsFx") -and $def.IsFx) { $FxManifest } else { $CrManifest }
            Set-ItemProperty -Path $def.Reg -Name "(default)" -Value $mf
            Write-Host "  ✓ $name — registered" -ForegroundColor Green
            $foundBrowsers.Add(@{ Name = $name; Exe = $def.Exe; Url = $def.Url; Dist = $def.Dist })
        } catch {
            Write-Host "  ! $name — registry failed: $_" -ForegroundColor Yellow
        }
    } else {
        $skipped.Add($name) | Out-Null
    }
}

if ($skipped.Count -gt 0) {
    Write-Host "    Not installed: $($skipped -join ', ')" -ForegroundColor DarkGray
}

# ── Step 7: Task Scheduler auto-start (optional) ──────────────────────────────
if ($AutoStart) {
    Write-Host "  ► [7/8] Registering Task Scheduler auto-start job..." -ForegroundColor Cyan
    try {
        schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
        schtasks /Create /F /TN $TaskName /TR "`"$InstalledBin`"" /SC ONLOGON /RL LIMITED | Out-Null
        Write-Host "  ✓ Task '$TaskName' registered — daemon starts at every login" -ForegroundColor Green
    } catch {
        Write-Host "  ! Task Scheduler failed (non-fatal): $_" -ForegroundColor Yellow
        Write-Host "    Manual start: Start-Process '$InstalledBin' -WindowStyle Hidden" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  - [7/8] Auto-start: skipped (add -AutoStart flag, or use Settings UI after install)" -ForegroundColor DarkGray
}

# ── Step 8: Start daemon + health check ───────────────────────────────────────
Write-Host "  ► [8/8] Starting companion daemon..." -ForegroundColor Cyan
Start-Process -FilePath $InstalledBin -WindowStyle Hidden
Start-Sleep -Seconds 2

$proc = Get-Process -Name "mvaultd" -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "  ✓ Daemon running (PID $($proc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ✗ Daemon did not start. Try manually:" -ForegroundColor Red
    Write-Host "    Start-Process '$InstalledBin'" -ForegroundColor DarkGray
    exit 1
}

try {
    $health = Invoke-WebRequest "http://127.0.0.1:47821/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "  ✓ Health check OK: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "  ! Health check timed out — daemon may still be initialising" -ForegroundColor Yellow
    Write-Host "    Check: http://127.0.0.1:47821/health" -ForegroundColor DarkGray
}

$tokenFile = "$env:LOCALAPPDATA\MindVault\token"
if (Test-Path $tokenFile) {
    $tok = (Get-Content $tokenFile -Raw).Trim()
    $preview = $tok.Substring(0, [Math]::Min(12, $tok.Length))
    Write-Host "  ✓ Auth token: ${preview}... (saved at $tokenFile)" -ForegroundColor Green
} else {
    Write-Host "    Auth token will be generated on first daemon run at: $tokenFile" -ForegroundColor DarkGray
}

# ── Extension install instructions ────────────────────────────────────────────
if (-not $NoExtension -and $foundBrowsers.Count -gt 0) {
    Write-Host ""
    Write-Host "  ════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Browser Extension — Manual Load Required" -ForegroundColor Cyan
    Write-Host "  ════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    if (-not $ExtDir) {
        Write-Host "  ! Extension dist/ not found. Build first:" -ForegroundColor Yellow
        Write-Host "    cd packages\extension && npx vite build" -ForegroundColor DarkGray
    } else {
        $shownUrls = @{}
        foreach ($b in $foundBrowsers) {
            $folder = if ($b.Dist -eq "dist-firefox") {
                if ($ExtDirFirefox) { $ExtDirFirefox } else { "(not built — run: npx vite build --config vite.config.firefox.ts)" }
            } else { $ExtDir }

            Write-Host "  [$($b.Name)]" -ForegroundColor White
            Write-Host "    Extensions page : $($b.Url)" -ForegroundColor DarkGray
            Write-Host "    Load folder     : $folder" -ForegroundColor Yellow
            if ($b.Dist -eq "dist-firefox") {
                Write-Host "    How             : Load Temporary Add-on -> select manifest.json in that folder" -ForegroundColor DarkGray
            } else {
                Write-Host "    How             : Enable Developer Mode -> Load unpacked -> select folder" -ForegroundColor DarkGray
            }
            Write-Host ""

            if (-not $shownUrls.ContainsKey($b.Url)) {
                $shownUrls[$b.Url] = $true
                try { Start-Process $b.Exe $b.Url -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 600 } catch {}
            }
        }
        Write-Host "  Extensions page opened in each browser above." -ForegroundColor Green
    }
}

# ── Final summary ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "  ════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Companion binary  : $InstalledBin" -ForegroundColor White
Write-Host "  Data + database   : $DataDir\" -ForegroundColor White
Write-Host "  Auth token file   : $env:LOCALAPPDATA\MindVault\token" -ForegroundColor White
Write-Host "  Chromium manifest : $CrManifest" -ForegroundColor White
Write-Host "  Firefox manifest  : $FxManifest" -ForegroundColor White
if ($AutoStart) {
    Write-Host "  Auto-start        : Task Scheduler -> '$TaskName'" -ForegroundColor White
} else {
    Write-Host "  Auto-start        : Not configured (use -AutoStart or Settings UI)" -ForegroundColor DarkGray
}
if ($foundBrowsers.Count -gt 0) {
    $names = ($foundBrowsers | ForEach-Object { $_.Name }) -join ", "
    Write-Host "  Native messaging  : $names" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Dashboard : http://127.0.0.1:47821/ui/" -ForegroundColor Cyan
Write-Host "  Health    : http://127.0.0.1:47821/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Uninstall : powershell -ExecutionPolicy Bypass -File tools\install-companion\uninstall-windows.ps1" -ForegroundColor DarkGray
Write-Host ""

$openDash = Read-Host "  Open MindVault dashboard in browser now? [Y/n]"
if ($openDash -notmatch '^[Nn]') {
    Start-Process "http://127.0.0.1:47821/ui/"
}
