# MindVault Companion Daemon (`mvaultd`)

A lightweight local REST API daemon that gives the MindVault browser extension access to a full SQLite database with full-text search, background sync, and cross-device capabilities.

**Status:** Phase 2 Step 11 scaffold — builds and runs; CRUD endpoints in progress.

---

## Architecture

```
Browser Extension (MV3)
  │
  ├── REST API (HTTP :47821)    ← primary channel for data sync
  │     X-MindVault-Token header
  │
  └── Native Messaging          ← secondary channel for initial handshake
        chrome.runtime.connectNative("com.mindvault.companion")
```

---

## Requirements

- Go 1.22 or later
- No CGo required (`modernc.org/sqlite` is pure Go)

---

## Build

```bash
cd companion
go mod tidy          # download dependencies
make build           # produces bin/mvaultd.exe (Windows) or bin/mvaultd
```

Or directly:
```bash
go build -o bin/mvaultd.exe ./cmd/mvaultd
```

---

## Running

```bash
# Start the REST API server (default port 47821)
./bin/mvaultd.exe

# Custom port and database path
./bin/mvaultd.exe -port 47821 -db "C:\Users\You\AppData\Roaming\MindVault\db.sqlite"

# Native messaging mode (called by Chrome)
./bin/mvaultd.exe -native

# Print version
./bin/mvaultd.exe -version
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check + version |
| GET | `/version` | No | Version string |
| GET | `/libraries` | Token | List all libraries |
| GET | `/libraries/{id}` | Token | Get library by ID |
| POST | `/libraries` | Token | Create library (TODO) |
| DELETE | `/libraries/{id}` | Token | Delete library (TODO) |
| GET | `/libraries/{libId}/sessions` | Token | List sessions |
| POST | `/libraries/{libId}/sessions` | Token | Create session (TODO) |
| DELETE | `/libraries/{libId}/sessions/{id}` | Token | Delete session (TODO) |
| GET | `/libraries/{libId}/tabs` | Token | List saved tabs |
| POST | `/libraries/{libId}/tabs` | Token | Create tab (TODO) |
| DELETE | `/libraries/{libId}/tabs/{id}` | Token | Delete tab (TODO) |
| GET | `/search?q=&libId=` | Token | Full-text search |
| POST | `/sync` | Token | Bulk sync from extension (TODO) |

### Authentication
All protected endpoints require the header:
```
X-MindVault-Token: <token>
```
The token is stored at `%APPDATA%\MindVault\token` (Windows). It is auto-generated on first run.

---

## Directory Structure

```
companion/
  cmd/
    mvaultd/
      main.go              — entry point, flags, graceful shutdown
  internal/
    api/
      server.go            — HTTP mux + middleware (auth, CORS)
      handlers/
        handlers.go        — all HTTP handlers
    auth/
      token.go             — load/create shared-secret token
    db/
      sqlite.go            — DB struct, Open/Close/Migrate + CRUD methods
      migrate.go           — migration runner (embed SQL files)
      migrations/
        001_initial.sql    — full schema (all 8 entity stores + FTS5)
    messaging/
      host.go              — native messaging stdin/stdout protocol
  bin/                     — compiled binaries (git-ignored)
  go.mod
  go.sum
  Makefile
  README.md
```

---

## Database

SQLite at `%APPDATA%\MindVault\db.sqlite` (Windows).  
Mirrors all 8 IndexedDB entity stores from the browser extension.  
FTS5 virtual table for full-text search over tabs.

---

## Native Messaging Registration (Step 12)

To register mvaultd as a native messaging host for Chrome, write the manifest:

**`com.mindvault.companion.json`** → `%APPDATA%\Google\Chrome\NativeMessagingHosts\`
```json
{
  "name": "com.mindvault.companion",
  "description": "MindVault Companion Daemon",
  "path": "C:\\path\\to\\mvaultd.exe",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://<YOUR-EXTENSION-ID>/"]
}
```

Then in the extension manifest:
```json
"nativeMessaging": ["com.mindvault.companion"]
```

---

## Development

```bash
make test     # run unit tests
make vet      # run go vet
make tidy     # tidy + verify go.mod
make clean    # remove bin/
```
