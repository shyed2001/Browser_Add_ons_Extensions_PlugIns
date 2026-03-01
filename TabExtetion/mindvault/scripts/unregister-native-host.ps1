# unregister-native-host.ps1
# Removes the MindVault companion daemon from Chrome native messaging hosts.
# Deletes the HKCU registry key and the manifest JSON file.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\unregister-native-host.ps1

$ErrorActionPreference = "Stop"

$RegPath      = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion"
$ManifestPath = "$env:LOCALAPPDATA\MindVault\com.mindvault.companion.json"

$removed = $false

# Remove registry key
if (Test-Path $RegPath) {
    Remove-Item -Path $RegPath -Force
    Write-Host "Removed registry key: $RegPath" -ForegroundColor Green
    $removed = $true
} else {
    Write-Host "Registry key not found (already removed?): $RegPath" -ForegroundColor Yellow
}

# Remove manifest file
if (Test-Path $ManifestPath) {
    Remove-Item -Path $ManifestPath -Force
    Write-Host "Removed manifest: $ManifestPath" -ForegroundColor Green
    $removed = $true
} else {
    Write-Host "Manifest not found (already removed?): $ManifestPath" -ForegroundColor Yellow
}

if ($removed) {
    Write-Host ""
    Write-Host "✓ Native messaging host unregistered. Restart Chrome to take effect." -ForegroundColor Green
}
