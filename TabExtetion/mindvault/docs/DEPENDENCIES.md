# MindVault — Dependencies
_Last updated: 2026-02-24_

## packages/extension

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@mindvault/shared` | `workspace:*` | Shared types, crypto, utilities |
| `webextension-polyfill` | `^0.12.0` | Firefox/Chrome MV2/MV3 API compatibility shim |

> The extension has minimal external runtime deps. All crypto uses browser WebCrypto.

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@samrum/vite-plugin-web-extension` | `^3.0.3` | MV3 extension bundling with Vite |
| `vite` | `^5.4.21` | Build tool, dev server |
| `vitest` | `^1.6.1` | Test runner (Vitest) |
| `@vitest/coverage-v8` | `^1.6.1` | Coverage reporting |
| `happy-dom` | `^14.x` | DOM environment for Vitest |
| `fake-indexeddb` | `^5.0.2` | IndexedDB polyfill for Node test env |
| `typescript` | `^5.x` | TypeScript compiler |
| `@types/chrome` | `^0.0.x` | Chrome extension API types |

### Deliberately Excluded

| Category | Excluded | Reason |
|----------|----------|--------|
| UI Framework | React, Vue, Svelte | Vanilla TS + HTML templates (DRY/KISS) |
| CSS Framework | Tailwind, Bootstrap | Custom in-house styles only |
| State management | Redux, Zustand | Module-level variables sufficient |
| ORM/query builder | Dexie, idb | Direct IndexedDB via promisifyRequest() |
| Test framework | Jest | Vitest preferred (native ESM, faster) |

---

## packages/shared

### Runtime Dependencies

None — pure TypeScript types and utilities; uses browser WebCrypto only.

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5.x` | TypeScript compiler |
| `vitest` | `^1.6.1` | Test runner |
| `@vitest/coverage-v8` | `^1.6.1` | Coverage |
| `happy-dom` | `^14.x` | DOM for WebCrypto in tests |

---

## Workspace Root

| Package | Version | Purpose |
|---------|---------|---------|
| `pnpm` | `10.30.1` | Package manager + workspace |
| `typescript` | `^5.x` | Base tsconfig |

---

## companion/ (Go Daemon) — Actual Dependencies

**Go version:** 1.26.0  
**Module:** `github.com/mindvault/companion`

### Runtime (go.mod)

| Module | Version | Purpose |
|--------|---------|---------|
| `modernc.org/sqlite` | `v1.29.0` | Pure-Go SQLite driver (no CGo required) |

### Transitive (auto-managed by `go mod tidy`)

| Module | Purpose |
|--------|---------|
| `modernc.org/libc` | C runtime emulation for pure-Go SQLite |
| `modernc.org/mathutil` | Math utilities for SQLite |
| `modernc.org/memory` | Memory management for SQLite |
| `golang.org/x/sys` | OS syscall abstractions |

### Deliberately Excluded (Go)

| Excluded | Alternative used | Reason |
|----------|-----------------|--------|
| `github.com/mattn/go-sqlite3` | `modernc.org/sqlite` | Avoids CGo — pure Go build |
| `github.com/gin-gonic/gin` | `net/http` stdlib | Zero deps; Go 1.22 pattern routing sufficient |
| `github.com/google/uuid` | `crypto/rand` + `encoding/hex` | Single function, no dep needed |
| `golang.org/x/crypto` | `crypto/sha256` stdlib | PBKDF2 done via WebCrypto in extension |

---

## desktop/ (.NET MAUI Desktop App) — Actual Dependencies

**Target framework:** `net8.0-windows10.0.19041.0`  
**Language:** C# 12  
**Status:** Phase 3 Step 1 — scaffold complete (commit `1b1cbcd`)

### NuGet Packages (desktop/MindVault.Desktop.csproj)

| Package | Version | Purpose |
|---------|---------|---------|
| `Microsoft.Maui.Controls` | `8.x` (via workload) | Cross-platform UI framework |
| `Microsoft.Maui.Controls.Compatibility` | `8.x` | Legacy renderers compatibility layer |
| `CommunityToolkit.Mvvm` | `8.3.2` | MVVM source generators (`[ObservableProperty]`, `[RelayCommand]`) |
| `Microsoft.Extensions.Http` | `8.0.0` | `HttpClient` factory + DI integration |

### Runtime Requirements (Desktop)

| Requirement | Version | Notes |
|-------------|---------|-------|
| .NET 8 SDK | `8.0.x` | `winget install Microsoft.DotNet.SDK.8` |
| .NET MAUI workload | `8.x` | `dotnet workload install maui` |
| Windows App SDK | `1.5.x` | Bundled with MAUI workload |
| companion daemon | `0.1.0` | Must be running on port 47821 |

### Deliberately Excluded (Desktop)

| Excluded | Alternative used | Reason |
|----------|-----------------|--------|
| `RestSharp`, `Refit` | `System.Net.Http.Json` stdlib | No extra deps for simple REST calls |
| `Microsoft.Data.Sqlite` | companion daemon REST API | Desktop reads data via REST, not SQLite directly |
| `LiveChartsCore`, `OxyPlot` | Plain MAUI views | No charts needed in Phase 3 |
| `Newtonsoft.Json` | `System.Text.Json` stdlib | Built-in JSON sufficient |

---

## Planned Future Dependencies

### Phase 4: PWA Companion (packages/web — Vanilla TS)

> Per DRY/KISS constraints, no Node.js framework. Vanilla TypeScript + Vite, served statically.

No additional npm packages planned — same pnpm workspace, same toolchain.

### Phase 5: Mobile (iOS / Android — .NET MAUI)

```
NuGet packages (planned, no extras beyond existing desktop NuGets):
  Microsoft.Maui  — same MAUI but targeting net8.0-ios / net8.0-android
```

### Phase 6: Cloud Sync (optional, packages/sync — Go or Node.js)

```
Possible additions:
  ioredis    — Redis client (session state)
  pg         — PostgreSQL client (user data)
  zod        — Schema validation
  (or Go equivalents if companion extended)
```

---

## Security Notes

- No packages with known high/critical CVEs as of 2026-02-24
- All crypto operations use **browser-native WebCrypto API** — no third-party crypto library
- `fake-indexeddb` is dev-only — never in production build
- `happy-dom` is dev-only — test environment only
- Companion daemon binds to `127.0.0.1:47821` only — not exposed to network
- MAUI desktop app communicates with companion via localhost only
