# MindVault — Developer Environment Reference

**Version:** 3.0  
**Date:** 2026-02-24  

---

## 1. Required Tools

| Tool | Version | Location | Purpose |
|------|---------|----------|---------|
| Node.js | v24.13.1 | `E:\Program Files\nodejs\node.exe` | Runtime + build |
| pnpm | 10.30.1 | `%APPDATA%\npm\node_modules\pnpm\bin\pnpm.cjs` | Package manager |
| Git | Latest | `D:\Program Files\Git` | Version control |
| VS Code | Latest | `E:\Program Files\Microsoft VS Code` | Editor |
| Go | 1.26.0 | `C:\Program Files\Go\bin\go.exe` | Companion daemon |
| .NET SDK | 8.0.x | `C:\Program Files\dotnet\dotnet.exe` | MAUI desktop app |
| .NET MAUI Workload | 8.x | via `dotnet workload install maui` | MAUI UI framework |
| Chrome | 120+ | System | Extension testing |
| Edge | 120+ | System | Extension testing (MV3 compatible) |

---

## 2. Windows-Specific Quirks

### pnpm Shell Wrapper Broken in Git Bash
The `pnpm` shell wrapper (`pnpm.ps1` / `pnpm.cmd`) does not work correctly in Git Bash on this machine.

**Use this instead:**
```bash
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" <command>
```

Or create a shell alias:
```bash
# Add to ~/.bashrc
alias pnpm='node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs"'
```

### PATH Fix in Git Bash
Node.js is not on the default Git Bash PATH. Fix for the session:
```bash
export PATH="/e/Program Files/nodejs:$PATH"
```

Add to `~/.bashrc` to make permanent.

### PowerShell Execution Policy
Running `.ps1` scripts may be blocked. Use:
```
powershell.exe -ExecutionPolicy Bypass -File script.ps1
```

Or unblock permanently (admin):
```
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### npm in PowerShell
`npm.ps1` may be blocked by execution policy. Use via node directly:
```
node "E:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" <args>
```

---

## 3. Environment Variables

### Extension (no env vars required)
The extension build uses no environment variables. All configuration is compile-time via TypeScript constants.

### Companion Daemon (Phase 2 Step 11)

| Variable | Default | Description |
|----------|---------|-------------|
| `MINDVAULT_PORT` | `47821` | REST API listen port |
| `MINDVAULT_DB_PATH` | `%APPDATA%\MindVault\db.sqlite` | SQLite database path |
| `MINDVAULT_LOG_LEVEL` | `info` | Logging level: debug/info/warn/error |
| `MINDVAULT_TOKEN_PATH` | `%APPDATA%\MindVault\token` | Shared secret token file |

---

## 4. pnpm Workspace Commands

All commands run from monorepo root unless noted.

```bash
# Install all dependencies
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" install

# Add dev dep to specific package
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --filter @mindvault/extension add -D <pkg>
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --filter @mindvault/shared add -D <pkg>

# Run script in specific package
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --filter @mindvault/extension run build
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --filter @mindvault/extension run test

# Run tests in all packages
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --recursive test

# Run from within package directory (avoids pnpm wrapper)
cd packages/extension && npx vitest run
cd packages/extension && npx vite build
```

---

## 5. Build Environment Details

| Tool | Version | Config File |
|------|---------|-------------|
| Vite | `^5.4.21` | `packages/extension/vite.config.ts` |
| TypeScript | `^5.x` | `packages/extension/tsconfig.json` |
| @samrum/vite-plugin-web-extension | `^3.0.3` | via `vite.config.ts` |
| vitest | `^1.6.1` | via `vite.config.ts` test block |
| @vitest/ui | `^1.6.1` | optional UI for test browser |
| @vitest/coverage-v8 | `^1.6.1` | coverage reporting |

---

## 6. Test Environment Details

| Tool | Version | Purpose |
|------|---------|---------|
| fake-indexeddb | ^5.0.2 | In-memory IndexedDB for tests |
| happy-dom | ^14.12.3 | DOM environment (lighter than jsdom) |
| vitest | ^1.6.0 | Test runner + expect |

### Test Setup Pattern
```typescript
// test-setup.ts (runs before each test file)
import { IDBFactory } from 'fake-indexeddb';

beforeEach(() => {
  // Fresh IDB instance per test
  (globalThis as any).indexedDB = new IDBFactory();
});

afterEach(async () => {
  // Close DB connection to allow next test to re-open
  await closeDB();
});
```

---

## 7. Vitest UI Dev Servers

Start the interactive test UIs:
```bash
# Extension tests UI at http://localhost:51204
cd packages/extension && npx vitest --ui --port 51204

# Shared tests UI at http://localhost:51205
cd packages/shared && npx vitest --ui --port 51205
```

Or use the saved launch configs (Claude Code):
- `extension-vitest-ui` → port 51204
- `shared-vitest-ui` → port 51205

---

## 8. Chrome Extension Dev Workflow

1. Run build watch: `cd packages/extension && npx vite build --watch`
2. Open `chrome://extensions`
3. Enable "Developer mode" toggle
4. Click "Load unpacked" → select `packages/extension/dist/`
5. After code changes: Vite rebuilds automatically → click 🔄 in Chrome extensions page

---

## 9. Exact Binary Paths

```
Node.js:    E:\Program Files\nodejs\node.exe
npm CLI:    E:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js
pnpm CJS:   C:\Users\Dell Vostro\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs
npx:        E:\Program Files\nodejs\npx  (or via node + npm)
Go:         C:\Program Files\Go\bin\go.exe  (Go 1.26.0)
GOPATH:     C:\Users\Dell Vostro\go
dotnet:     C:\Program Files\dotnet\dotnet.exe  (.NET 8 SDK)
```

PATH fixes for Git Bash:
```bash
export PATH="/e/Program Files/nodejs:$PATH"   # Node.js
export PATH="/c/Program Files/Go/bin:$PATH"   # Go
```

## 10. Companion Daemon Dev Workflow

```bash
cd companion

# Build binary
go build -o bin/mvaultd.exe ./cmd/mvaultd

# Run (REST mode, port 47821)
./bin/mvaultd.exe

# Run tests
go test ./...

# Check for issues
go vet ./...
```

---

## 11. Companion Daemon Install Paths (Windows)

| Item | Path |
|------|------|
| Binary | `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe` |
| SQLite DB | `%APPDATA%\MindVault\db.sqlite` |
| Auth token | `%APPDATA%\MindVault\token` |
| Native messaging manifest | `%LOCALAPPDATA%\MindVault\com.mindvault.companion.json` |
| Chrome registry key | `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion` |
| Edge registry key | `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.mindvault.companion` |

Install/reinstall: run `C:\Temp\install-mv-companion.ps1` (PowerShell, no admin required).

---

## 12. Helper Bat / Script Files (`C:\Temp\`)

These files were created to work around PATH and PowerShell execution policy issues on this machine.

| File | Purpose |
|------|---------|
| `C:\Temp\build-extension.bat` | Build extension (`npx vite build` with Node PATH set) |
| `C:\Temp\run-extension-tests.bat` | Run TS tests (`npx vitest run`) |
| `C:\Temp\build-companion.bat` | Build `companion/bin/mvaultd.exe` (`go build`) |
| `C:\Temp\build-maui.bat` | `dotnet restore` + `dotnet build` for MAUI project |
| `C:\Temp\install-mv-companion.ps1` | Install companion daemon + register native host |

---

## 13. MAUI Desktop Dev Workflow

```
# Restore NuGet packages
"C:\Program Files\dotnet\dotnet.exe" restore desktop\MindVault.Desktop.csproj

# Build (Windows target)
"C:\Program Files\dotnet\dotnet.exe" build desktop\MindVault.Desktop.csproj ^
  -f net8.0-windows10.0.19041.0 --no-restore

# Or use the bat file:
C:\Temp\build-maui.bat

# Run desktop app
"C:\Program Files\dotnet\dotnet.exe" run ^
  --project desktop\MindVault.Desktop.csproj ^
  -f net8.0-windows10.0.19041.0
```

Prerequisites:
1. Companion daemon running: `%LOCALAPPDATA%\MindVault\bin\mvaultd.exe` (or run `install-mv-companion.ps1`)
2. Verify daemon: `curl http://127.0.0.1:47821/health` should return `{"status":"ok","version":"0.1.0"}`
