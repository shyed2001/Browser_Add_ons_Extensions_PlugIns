@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: MindVault — Full Windows Installer  (install.bat)
:: Works on Windows 7+ with PowerShell 2+. No admin required.
::
:: USAGE:
::   install.bat
::   install.bat /autostart
::   install.bat /autostart /force
::
:: FLAGS:
::   /autostart     Register Task Scheduler logon job
::   /force         Kill running daemon without prompting
::   /noext         Skip extension install instructions
:: ==============================================================================

set "DAEMON=com.mindvault.companion"
set "TASK=MindVault Companion Daemon"
set "INSTALL_DIR=%LOCALAPPDATA%\MindVault\bin"
set "DATA_DIR=%APPDATA%\MindVault"
set "BIN=%LOCALAPPDATA%\MindVault\bin\mvaultd.exe"
set "CR_MANIFEST=%LOCALAPPDATA%\MindVault\%DAEMON%.json"
set "FX_MANIFEST_DIR=%APPDATA%\Mozilla\NativeMessagingHosts"
set "FX_MANIFEST=%FX_MANIFEST_DIR%\%DAEMON%.json"

set AUTOSTART=0
set FORCE=0
set NOEXT=0

for %%A in (%*) do (
    if /I "%%A"=="/autostart" set AUTOSTART=1
    if /I "%%A"=="/force"     set FORCE=1
    if /I "%%A"=="/noext"     set NOEXT=1
)

echo.
echo   ====================================================
echo   MindVault -- Full Windows Installer
echo   ====================================================
echo.

:: ── Step 1: Locate mvaultd.exe ───────────────────────────────────────────────
echo   [1/8] Locating mvaultd.exe...

set "SRC_BIN="
pushd "%~dp0..\.."
set "REPO_ROOT=%CD%"
popd

if exist "%REPO_ROOT%\companion\mvaultd.exe"     set "SRC_BIN=%REPO_ROOT%\companion\mvaultd.exe"
if not defined SRC_BIN (
  if exist "%REPO_ROOT%\companion\bin\mvaultd.exe" set "SRC_BIN=%REPO_ROOT%\companion\bin\mvaultd.exe"
)
if not defined SRC_BIN (
  if exist "%BIN%"                                 set "SRC_BIN=%BIN%"
)
if not defined SRC_BIN (
  if exist ".\mvaultd.exe"                         set "SRC_BIN=.\mvaultd.exe"
)

if not defined SRC_BIN (
    echo   ERROR: mvaultd.exe not found.
    echo   Build it first:  cd companion  ^&^&  go build ./cmd/mvaultd
    echo   Then retry or copy mvaultd.exe next to this script.
    exit /b 1
)
echo   OK  Binary: %SRC_BIN%

:: ── Step 2: Locate extension dist/ ──────────────────────────────────────────
set "EXT_DIR="
set "EXT_DIR_FF="
if %NOEXT%==0 (
    echo   [2/8] Locating extension dist/ folder...
    if exist "%REPO_ROOT%\packages\extension\dist\manifest.json" (
        set "EXT_DIR=%REPO_ROOT%\packages\extension\dist"
    )
    if not defined EXT_DIR (
      if exist "%REPO_ROOT%\dist\manifest.json" set "EXT_DIR=%REPO_ROOT%\dist"
    )
    if defined EXT_DIR (
        echo   OK  Chrome/Edge dist: !EXT_DIR!
        if exist "%REPO_ROOT%\packages\extension\dist-firefox\manifest.json" (
            set "EXT_DIR_FF=%REPO_ROOT%\packages\extension\dist-firefox"
            echo   OK  Firefox dist: !EXT_DIR_FF!
        ) else (
            echo   !   Firefox dist-firefox\ not found (run: npx vite build --config vite.config.firefox.ts^)
        )
    ) else (
        echo   !   Extension dist\ not found -- companion-only install
        echo       Build: cd packages\extension ^&^& npx vite build
    )
) else (
    echo   [2/8] Extension: skipped (/noext)
)

:: ── Step 3: Stop running daemon ──────────────────────────────────────────────
echo   [3/8] Checking for running daemon...
tasklist /FI "IMAGENAME eq mvaultd.exe" 2>nul | findstr /I "mvaultd.exe" >nul
if %ERRORLEVEL%==0 (
    if %FORCE%==0 (
        set /P STOP_ANS=   Daemon is running. Stop it and continue? [Y/n]:
        if /I "!STOP_ANS!"=="n" goto :abort
    )
    taskkill /F /IM mvaultd.exe >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo   OK  Daemon stopped
) else (
    echo   OK  No daemon running
)

:: ── Step 4: Install binary ───────────────────────────────────────────────────
echo   [4/8] Installing binary...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%DATA_DIR%"    mkdir "%DATA_DIR%"
copy /Y "%SRC_BIN%" "%BIN%" >nul
if %ERRORLEVEL% neq 0 (
    echo   ERROR: Could not copy binary to %BIN%
    exit /b 1
)
echo   OK  Installed: %BIN%

:: ── Step 5: Write native messaging manifests via PowerShell ──────────────────
echo   [5/8] Writing native messaging manifests...
if not exist "%FX_MANIFEST_DIR%" mkdir "%FX_MANIFEST_DIR%"

powershell -NoProfile -NonInteractive -Command ^
    "$d = '%DAEMON%'; $b = '%BIN%'; $cr = '%CR_MANIFEST%'; $fx = '%FX_MANIFEST%';" ^
    "$crObj = [ordered]@{ name=$d; description='MindVault Companion Daemon'; path=$b; type='stdio'; allowed_origins=@('chrome-extension://*/','app://*') };" ^
    "[IO.File]::WriteAllText($cr, ($crObj | ConvertTo-Json -Depth 3), [Text.Encoding]::UTF8);" ^
    "$fxObj = [ordered]@{ name=$d; description='MindVault Companion Daemon'; path=$b; type='stdio'; allowed_extensions=@('mindvault@mindvault.app','*') };" ^
    "[IO.File]::WriteAllText($fx, ($fxObj | ConvertTo-Json -Depth 3), [Text.Encoding]::UTF8);" ^
    "Write-Host '   OK  Manifests written'"

:: ── Step 6: Register native messaging (all detected browsers) ────────────────
echo   [6/8] Registering native messaging...

if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Chrome registered
)
if exist "%LOCALAPPDATA%\Google\Chrome Beta\Application\chrome.exe" (
    reg add "HKCU\Software\Google\Chrome Beta\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Chrome Beta registered
)
if exist "%LOCALAPPDATA%\Google\Chrome Dev\Application\chrome.exe" (
    reg add "HKCU\Software\Google\Chrome Dev\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Chrome Dev registered
)
if exist "%LOCALAPPDATA%\Chromium\Application\chrome.exe" (
    reg add "HKCU\Software\Chromium\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Chromium registered
)
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" (
    reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Edge registered
)
if exist "%LOCALAPPDATA%\Microsoft\Edge Beta\Application\msedge.exe" (
    reg add "HKCU\Software\Microsoft\Edge Beta\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Edge Beta registered
)
if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Brave registered
)
if exist "%APPDATA%\Opera Software\Opera Stable\opera.exe" (
    reg add "HKCU\Software\Opera Software\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Opera registered
)
if exist "%APPDATA%\Opera Software\Opera GX Stable\opera.exe" (
    reg add "HKCU\Software\Opera Software\Opera GX Stable\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Opera GX registered
)
if exist "%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe" (
    reg add "HKCU\Software\Vivaldi\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%CR_MANIFEST%" /f >nul 2>&1
    echo   OK  Vivaldi registered
)
if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    reg add "HKCU\Software\Mozilla\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%FX_MANIFEST%" /f >nul 2>&1
    echo   OK  Firefox registered
)
if exist "C:\Program Files\Mozilla Firefox ESR\firefox.exe" (
    reg add "HKCU\Software\Mozilla\NativeMessagingHosts\%DAEMON%" /ve /t REG_SZ /d "%FX_MANIFEST%" /f >nul 2>&1
    echo   OK  Firefox ESR registered
)

:: ── Step 7: Task Scheduler auto-start ────────────────────────────────────────
if %AUTOSTART%==1 (
    echo   [7/8] Registering auto-start Task Scheduler job...
    schtasks /Delete /TN "%TASK%" /F >nul 2>&1
    schtasks /Create /F /TN "%TASK%" /TR "\"%BIN%\"" /SC ONLOGON /RL LIMITED >nul
    if %ERRORLEVEL%==0 (
        echo   OK  Task registered -- daemon starts at every login
    ) else (
        echo   !   Task Scheduler failed (non-fatal)
    )
) else (
    echo   [7/8] Auto-start: skipped (use /autostart flag to enable)
)

:: ── Step 8: Start daemon + health check ──────────────────────────────────────
echo   [8/8] Starting daemon...
start "" /B "%BIN%"
timeout /t 2 /nobreak >nul

tasklist /FI "IMAGENAME eq mvaultd.exe" 2>nul | findstr /I "mvaultd.exe" >nul
if %ERRORLEVEL%==0 (
    echo   OK  Daemon is running
) else (
    echo   ERROR: Daemon did not start. Run manually: "%BIN%"
    exit /b 1
)

:: Health check via PowerShell
powershell -NoProfile -NonInteractive -Command ^
    "try { $r=(New-Object Net.WebClient).DownloadString('http://127.0.0.1:47821/health'); Write-Host '   OK  Health:' $r } catch { Write-Host '   !   Health check timed out (daemon may still be starting)' }"

:: ── Extension install instructions ───────────────────────────────────────────
if %NOEXT%==0 (
    echo.
    echo   ====================================================
    echo   Browser Extension -- Manual Load Required
    echo   ====================================================
    echo.
    if defined EXT_DIR (
        echo   Chrome/Edge/Brave/Vivaldi/Opera:
        echo     1. Open chrome://extensions  (or edge://extensions etc.)
        echo     2. Enable Developer Mode (toggle, top right)
        echo     3. Click "Load unpacked"
        echo     4. Select this folder:  !EXT_DIR!
        echo.
        if defined EXT_DIR_FF (
            echo   Firefox:
            echo     1. Open about:debugging#/runtime/this-firefox
            echo     2. Click "Load Temporary Add-on"
            echo     3. Select manifest.json in:  !EXT_DIR_FF!
            echo.
        ) else (
            echo   Firefox: Build dist-firefox first, then load as Temporary Add-on.
            echo.
        )
    ) else (
        echo   Extension dist\ not found. Build first:
        echo     cd packages\extension ^&^& npx vite build
        echo.
    )
)

:: ── Summary ───────────────────────────────────────────────────────────────────
echo.
echo   ====================================================
echo   Installation Complete!
echo   ====================================================
echo.
echo   Binary    : %BIN%
echo   Data dir  : %DATA_DIR%
echo   Manifests : %CR_MANIFEST%
echo              : %FX_MANIFEST%
echo.
echo   Dashboard : http://127.0.0.1:47821/ui/
echo   Health    : http://127.0.0.1:47821/health
echo.
echo   Start dashboard: start http://127.0.0.1:47821/ui/
echo.
goto :eof

:abort
echo   Aborted.
endlocal
exit /b 0
