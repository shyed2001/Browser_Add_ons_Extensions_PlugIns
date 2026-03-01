# ==============================================================================
# MindVault Companion Daemon — Windows Installer
# ==============================================================================
# Usage:
#   .\install-windows.ps1
#   .\install-windows.ps1 -ExtensionId <32charID> -BinaryPath <path\to\mvaultd.exe>
#   .\install-windows.ps1 -AutoStart
#
# No admin required — installs to %LOCALAPPDATA% and HKCU registry only.
# For Task Scheduler auto-start, no elevation needed (current user only).
# ==============================================================================

param(
    [string]$ExtensionId = "",
    [string]$BinaryPath  = "",
    [switch]$AutoStart,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---- Constants ---------------------------------------------------------------
$AppName        = "MindVault"
$DaemonName     = "com.mindvault.companion"
$TaskName       = "MindVault Companion Daemon"
$InstallDir     = Join-Path $env:LOCALAPPDATA "MindVault\bin"
$DataDir        = Join-Path $env:LOCALAPPDATA "MindVault"
$InstalledBin   = Join-Path $InstallDir "mvaultd.exe"
$ManifestDir    = Join-Path $env:LOCALAPPDATA "MindVault"
$ManifestPath   = Join-Path $ManifestDir "$DaemonName.json"
$RegKey         = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$DaemonName"
$EdgeRegKey     = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$DaemonName"

function Write-Step { param([string]$msg) Write-Host "  ► $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

# ---- Banner ------------------------------------------------------------------
Write-Host ""
Write-Host "  MindVault Companion Daemon — Windows Installer" -ForegroundColor White
Write-Host "  ================================================" -ForegroundColor DarkGray
Write-Host ""

# ---- Resolve binary path -----------------------------------------------------
Write-Step "Locating mvaultd.exe..."

if (-not $BinaryPath) {
    # Auto-detect from common locations relative to this script
    $ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot    = Split-Path -Parent (Split-Path -Parent $ScriptDir)
    $Candidates  = @(
        (Join-Path $RepoRoot "companion\bin\mvaultd.exe"),
        (Join-Path $env:LOCALAPPDATA "MindVault\bin\mvaultd.exe"),
        ".\mvaultd.exe"
    )
    foreach ($c in $Candidates) {
        if (Test-Path $c) { $BinaryPath = $c; break }
    }
}

if (-not $BinaryPath -or -not (Test-Path $BinaryPath)) {
    Write-Fail "mvaultd.exe not found. Build it first:"
    Write-Host "    cd companion && go build -o bin\mvaultd.exe .\cmd\mvaultd" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Then retry with:" -ForegroundColor DarkGray
    Write-Host "    .\install-windows.ps1 -BinaryPath <path\to\mvaultd.exe>" -ForegroundColor DarkGray
    exit 1
}

Write-OK "Binary found: $BinaryPath"

# ---- Resolve extension ID ----------------------------------------------------
if (-not $ExtensionId) {
    Write-Host ""
    Write-Host "  Enter your Chrome extension ID (32 lowercase letters)." -ForegroundColor White
    Write-Host "  Find it at: chrome://extensions → MindVault → Details" -ForegroundColor DarkGray
    Write-Host "  Press Enter without input to use wildcard '*' (dev mode only)." -ForegroundColor DarkGray
    Write-Host ""
    $ExtensionId = (Read-Host "  Extension ID").Trim()
}

if ($ExtensionId -eq "" -or $ExtensionId -eq "*") {
    $Origin = "chrome-extension://*/"
    Write-Warn "Using wildcard origin — for development only. Replace with real ID before production."
} elseif ($ExtensionId -match "^[a-z]{32}$") {
    $Origin = "chrome-extension://$ExtensionId/"
    Write-OK "Extension origin: $Origin"
} else {
    Write-Fail "Invalid extension ID format. Expected 32 lowercase letters."
    exit 1
}

# ---- Create install directory ------------------------------------------------
Write-Step "Creating install directory: $InstallDir"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}
Write-OK "Directory ready"

# ---- Copy binary -------------------------------------------------------------
Write-Step "Installing binary to $InstalledBin"

# Check if already installed and running
$Running = Get-Process -Name "mvaultd" -ErrorAction SilentlyContinue
if ($Running) {
    if (-not $Force) {
        Write-Warn "mvaultd is currently running. Stop it first or use -Force."
        exit 1
    }
    Write-Warn "Stopping running mvaultd process..."
    Stop-Process -Name "mvaultd" -Force
    Start-Sleep -Milliseconds 500
}

Copy-Item -Path $BinaryPath -Destination $InstalledBin -Force
Write-OK "Binary installed"

# ---- Verify binary runs ------------------------------------------------------
Write-Step "Verifying binary..."
try {
    $ver = & $InstalledBin --version 2>&1
    Write-OK "Verified: $ver"
} catch {
    Write-Fail "Binary failed to run: $_"
    exit 1
}

# ---- Write native messaging manifest -----------------------------------------
Write-Step "Writing native messaging manifest..."

$Manifest = [ordered]@{
    name        = $DaemonName
    description = "MindVault Companion Daemon — SQLite mirror, REST API, and native messaging bridge"
    path        = $InstalledBin
    type        = "stdio"
    allowed_origins = @($Origin)
}
$ManifestJson = $Manifest | ConvertTo-Json -Depth 3
Set-Content -Path $ManifestPath -Value $ManifestJson -Encoding UTF8
Write-OK "Manifest written: $ManifestPath"

# ---- Register in Chrome -------------------------------------------------------
Write-Step "Registering native messaging host in Chrome (HKCU)..."
if (-not (Test-Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts")) {
    New-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts" -Force | Out-Null
}
New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty -Path $RegKey -Name "(default)" -Value $ManifestPath
Write-OK "Chrome registry key set: $RegKey"

# ---- Register in Edge (bonus — same manifest format) -------------------------
Write-Step "Registering in Microsoft Edge (HKCU)..."
try {
    if (-not (Test-Path "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts")) {
        New-Item -Path "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts" -Force | Out-Null
    }
    New-Item -Path $EdgeRegKey -Force | Out-Null
    Set-ItemProperty -Path $EdgeRegKey -Name "(default)" -Value $ManifestPath
    Write-OK "Edge registry key set"
} catch {
    Write-Warn "Could not register for Edge (non-fatal): $_"
}

# ---- Optional: Task Scheduler auto-start -------------------------------------
if ($AutoStart) {
    Write-Step "Registering Task Scheduler job for auto-start at logon..."
    try {
        $Action  = New-ScheduledTaskAction -Execute $InstalledBin
        $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $Settings = New-ScheduledTaskSettingsSet `
            -ExecutionTimeLimit ([TimeSpan]::Zero) `
            -RestartCount 3 `
            -RestartInterval ([TimeSpan]::FromMinutes(1)) `
            -StartWhenAvailable

        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Settings $Settings `
            -RunLevel Limited `
            -Force | Out-Null

        Write-OK "Task '$TaskName' registered — daemon will start at next logon"
    } catch {
        Write-Warn "Task Scheduler registration failed (non-fatal): $_"
        Write-Warn "You can start the daemon manually: $InstalledBin"
    }
} else {
    Write-Host ""
    Write-Host "  Tip: Add -AutoStart to register a Task Scheduler job." -ForegroundColor DarkGray
    Write-Host "  The daemon will then start automatically at logon." -ForegroundColor DarkGray
}

# ---- Summary -----------------------------------------------------------------
Write-Host ""
Write-Host "  ================================================" -ForegroundColor DarkGray
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Binary   : $InstalledBin" -ForegroundColor White
Write-Host "  Manifest : $ManifestPath" -ForegroundColor White
Write-Host "  Chrome   : $RegKey" -ForegroundColor White
Write-Host "  Origin   : $Origin" -ForegroundColor White
if ($AutoStart) {
    Write-Host "  AutoStart: Task Scheduler → '$TaskName'" -ForegroundColor White
}
Write-Host ""
Write-Host "  To start the daemon now:" -ForegroundColor DarkGray
Write-Host "    Start-Process '$InstalledBin' -WindowStyle Hidden" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To uninstall:" -ForegroundColor DarkGray
Write-Host "    .\uninstall-windows.ps1" -ForegroundColor DarkGray
Write-Host ""
