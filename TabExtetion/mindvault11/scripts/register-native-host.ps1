# register-native-host.ps1
# Registers the MindVault companion daemon as a Chrome native messaging host.
# Writes ONE key under HKCU (current user only, no admin needed, fully reversible).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\register-native-host.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\register-native-host.ps1 -ExtensionId "abcdefghij..."

param(
    [string]$ExtensionId = "",
    [string]$BinaryPath = ""
)

$ErrorActionPreference = "Stop"

# ── Resolve paths ──────────────────────────────────────────────────────────────
$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot  = Split-Path -Parent $ScriptDir
$CompanionDir = Join-Path $ProjectRoot "companion"
$BinDir       = Join-Path $CompanionDir "bin"

if (-not $BinaryPath) {
    $BinaryPath = Join-Path $BinDir "mvaultd.exe"
}

# ── Check binary exists ────────────────────────────────────────────────────────
if (-not (Test-Path $BinaryPath)) {
    Write-Host "ERROR: Binary not found at: $BinaryPath" -ForegroundColor Red
    Write-Host "Build it first: cd companion && go build -o bin/mvaultd.exe ./cmd/mvaultd" -ForegroundColor Yellow
    exit 1
}

Write-Host "Binary: $BinaryPath" -ForegroundColor Green

# ── Get extension ID ───────────────────────────────────────────────────────────
if (-not $ExtensionId) {
    Write-Host ""
    Write-Host "To find your extension ID:" -ForegroundColor Cyan
    Write-Host "  1. Open Chrome → chrome://extensions"
    Write-Host "  2. Enable Developer mode"
    Write-Host "  3. Load unpacked from: $ProjectRoot\packages\extension\dist"
    Write-Host "  4. Copy the extension ID (32-char string)"
    Write-Host ""
    $ExtensionId = Read-Host "Enter extension ID (or press Enter to use wildcard '*' for dev)"
    if (-not $ExtensionId) {
        $ExtensionId = "*"
    }
}

# ── Build allowed_origins ──────────────────────────────────────────────────────
if ($ExtensionId -eq "*") {
    Write-Host "WARNING: Using wildcard origin — any extension can connect. OK for dev." -ForegroundColor Yellow
    $AllowedOrigins = '["chrome-extension://*/"]'
} else {
    $AllowedOrigins = "[`"chrome-extension://$ExtensionId/`"]"
}

# ── Write manifest JSON ────────────────────────────────────────────────────────
$ManifestDir  = "$env:LOCALAPPDATA\MindVault"
$ManifestPath = "$ManifestDir\com.mindvault.companion.json"
New-Item -ItemType Directory -Force -Path $ManifestDir | Out-Null

$Manifest = @{
    name             = "com.mindvault.companion"
    description      = "MindVault Companion Daemon — SQLite mirror and REST API bridge"
    path             = $BinaryPath.Replace("\", "\\")
    type             = "stdio"
    allowed_origins  = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 3

[System.IO.File]::WriteAllText($ManifestPath, $Manifest, [System.Text.Encoding]::UTF8)
Write-Host "Manifest: $ManifestPath" -ForegroundColor Green

# ── Write registry key ─────────────────────────────────────────────────────────
$RegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion"
New-Item -Path $RegPath -Force | Out-Null
Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath
Write-Host "Registry: $RegPath → $ManifestPath" -ForegroundColor Green

# ── Verify ─────────────────────────────────────────────────────────────────────
$ReadBack = (Get-ItemProperty -Path $RegPath)."(default)"
if ($ReadBack -eq $ManifestPath) {
    Write-Host ""
    Write-Host "✓ Native messaging host registered successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart Chrome (if open)"
    Write-Host "  2. The extension can now call chrome.runtime.connectNative('com.mindvault.companion')"
    Write-Host "  3. To unregister: powershell -ExecutionPolicy Bypass -File scripts\unregister-native-host.ps1"
} else {
    Write-Host "ERROR: Registry write failed (readback mismatch)" -ForegroundColor Red
    exit 1
}
