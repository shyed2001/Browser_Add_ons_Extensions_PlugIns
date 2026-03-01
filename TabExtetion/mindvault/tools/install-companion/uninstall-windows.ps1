# ==============================================================================
# MindVault Companion Daemon — Windows Uninstaller
# ==============================================================================
# Usage:
#   .\uninstall-windows.ps1
#   .\uninstall-windows.ps1 -KeepData   (preserves SQLite DB and token)
# ==============================================================================

param(
    [switch]$KeepData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "SilentlyContinue"

$DaemonName  = "com.mindvault.companion"
$TaskName    = "MindVault Companion Daemon"
$InstallDir  = Join-Path $env:LOCALAPPDATA "MindVault\bin"
$DataDir     = Join-Path $env:LOCALAPPDATA "MindVault"
$InstalledBin = Join-Path $InstallDir "mvaultd.exe"
$ManifestPath = Join-Path $DataDir "$DaemonName.json"
$RegKey      = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$DaemonName"
$EdgeRegKey  = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$DaemonName"

function Write-Step { param([string]$msg) Write-Host "  ► $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  ! $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  MindVault Companion Daemon — Uninstaller" -ForegroundColor White
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host ""

# ---- Stop running process ----------------------------------------------------
Write-Step "Stopping daemon if running..."
$proc = Get-Process -Name "mvaultd" -ErrorAction SilentlyContinue
if ($proc) {
    Stop-Process -Name "mvaultd" -Force
    Start-Sleep -Milliseconds 300
    Write-OK "Process stopped"
} else {
    Write-OK "Daemon not running"
}

# ---- Remove Task Scheduler entry ---------------------------------------------
Write-Step "Removing Task Scheduler entry..."
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-OK "Task removed"
} else {
    Write-OK "No scheduled task found"
}

# ---- Remove registry keys ----------------------------------------------------
Write-Step "Removing Chrome registry key..."
if (Test-Path $RegKey) {
    Remove-Item -Path $RegKey -Recurse -Force
    Write-OK "Chrome key removed"
} else {
    Write-OK "No Chrome key found"
}

Write-Step "Removing Edge registry key..."
if (Test-Path $EdgeRegKey) {
    Remove-Item -Path $EdgeRegKey -Recurse -Force
    Write-OK "Edge key removed"
} else {
    Write-OK "No Edge key found"
}

# ---- Remove manifest ---------------------------------------------------------
Write-Step "Removing manifest..."
if (Test-Path $ManifestPath) {
    Remove-Item -Path $ManifestPath -Force
    Write-OK "Manifest removed"
} else {
    Write-OK "No manifest found"
}

# ---- Remove binary -----------------------------------------------------------
Write-Step "Removing binary..."
if (Test-Path $InstalledBin) {
    Remove-Item -Path $InstalledBin -Force
    Write-OK "Binary removed"
} else {
    Write-OK "No binary found"
}

# ---- Remove install dir (if empty) ------------------------------------------
if (Test-Path $InstallDir) {
    $items = Get-ChildItem $InstallDir -ErrorAction SilentlyContinue
    if (-not $items) {
        Remove-Item -Path $InstallDir -Force
        Write-OK "Empty bin/ dir removed"
    }
}

# ---- Optionally remove data dir ----------------------------------------------
if ($KeepData) {
    Write-Warn "Keeping data directory (SQLite DB, token): $DataDir"
} else {
    Write-Step "Removing data directory..."
    if (Test-Path $DataDir) {
        $remaining = Get-ChildItem $DataDir -Recurse -ErrorAction SilentlyContinue
        if ($remaining) {
            Write-Warn "Data directory has files — removing: $DataDir"
            Remove-Item -Path $DataDir -Recurse -Force
            Write-OK "Data directory removed"
        } else {
            Remove-Item -Path $DataDir -Force
            Write-OK "Empty data directory removed"
        }
    } else {
        Write-OK "No data directory found"
    }
}

# ---- Summary -----------------------------------------------------------------
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host "  Uninstall complete." -ForegroundColor Green
if ($KeepData) {
    Write-Host "  Data preserved at: $DataDir" -ForegroundColor DarkGray
}
Write-Host ""
