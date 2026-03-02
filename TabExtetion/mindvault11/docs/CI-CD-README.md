# MindVault — CI/CD Reference

**Version:** 2.0  
**Date:** 2026-02-22  

---

## 1. Overview

MindVault uses a **lightweight local CI** approach. There is no cloud CI pipeline yet (GitHub Actions planned for Phase 3). All quality gates run locally before commits.

---

## 2. Local Quality Gates

Run these before every commit (in order):

```bash
# 1. Lint (if ESLint configured)
cd packages/extension && npx eslint src --ext .ts

# 2. Type-check both packages
cd packages/shared && npx tsc --noEmit
cd packages/extension && npx tsc --noEmit

# 3. Run all tests
cd packages/shared && npx vitest run
cd packages/extension && npx vitest run

# 4. Build the extension
cd packages/extension && npx vite build

# 5. Check dist is valid
ls dist/manifest.json dist/serviceWorker.js
```

Or use root workspace scripts:
```bash
# From monorepo root (Git Bash with PATH fix)
export PATH="/e/Program Files/nodejs:$PATH"
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --recursive test
node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" --filter @mindvault/extension build
```

---

## 3. Test Suite

### Current Status
| Package | Tests | Status |
|---------|-------|--------|
| @mindvault/shared | 47 | ✅ Passing |
| @mindvault/extension | 116 | ✅ Passing |
| **Total** | **163** | ✅ |

### Test Files (Extension)
```
src/db/repositories/
  libraries.test.ts       — CRUD + encryption flag
  sessions.test.ts        — create/read/delete + encrypt notes
  saved-tabs.test.ts      — CRUD + colour + RGYB filter
  bookmarks.test.ts       — tree structure + parent/child
  history.test.ts         — capture + isImportant filter
  downloads.test.ts       — metadata + state updates + notes
  tags.test.ts            — CRUD
  audit-log.test.ts       — logAction fire-and-forget
src/services/
  session-key.test.ts     — encrypt/decrypt/derive + lock/unlock
  import.test.ts          — parseJsonBackup + importFromJson
  export.test.ts          — exportToJson round-trip
  mvault.test.ts          — export/import encrypted backup
```

### Test Environment
- **Test runner:** Vitest 1.6
- **DOM environment:** happy-dom 14
- **IndexedDB mock:** fake-indexeddb 5
- **Setup file:** `test-setup.ts` — resets IDB factory + calls `closeDB()` between tests
- **Coverage:** `@vitest/coverage-v8` (run with `vitest run --coverage`)

---

## 4. Build Pipeline

### Extension Build (`vite build`)
```
Input:  manifest.json + src/**
Output: dist/
  manifest.json          (processed, paths resolved)
  serviceWorker.js       (bundled service worker)
  src/popup/popup.html
  src/popup/popup.js
  src/dashboard/dashboard.html
  src/dashboard/dashboard.js
  images/icon{16,48,128}.png
```

### Shared Package
No build step — TypeScript source is consumed directly by extension via `workspace:*` import and Vite resolves it at build time.

---

## 5. Release Process

### Versioning
- Follows **SemVer**: `MAJOR.MINOR.PATCH`
- Pre-release: `-alpha`, `-beta` suffixes
- Git tags: `v2.0.0`, `v2.1.0`, etc.

### Release Checklist
```
[ ] All tests passing (163/163)
[ ] TypeScript compiles without errors (both packages)
[ ] vite build succeeds, dist/ is valid
[ ] CHANGELOG.md updated with version entry
[ ] version bumped in packages/extension/package.json
[ ] version bumped in manifest.json
[ ] Git commit: "chore: release vX.Y.Z"
[ ] Git tag: git tag vX.Y.Z
[ ] Test extension loaded in Chrome manually
[ ] docs/ files updated if APIs changed
```

### Tag Commands
```bash
git tag v2.0.0
git push origin v2.0.0
```

---

## 6. Planned GitHub Actions (Phase 3)

When the repo is made public, the following workflows will be added:

### `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
      - run: pnpm --recursive typecheck
      - run: pnpm --recursive test
      - run: pnpm --filter @mindvault/extension build
```

### `.github/workflows/release.yml`
```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install && pnpm --filter @mindvault/extension build
      - name: Package extension
        run: cd packages/extension && zip -r mindvault-${{ github.ref_name }}.zip dist/
      - uses: softprops/action-gh-release@v1
        with:
          files: packages/extension/mindvault-*.zip
```

---

## 7. Companion Daemon CI (Phase 2+)

When the Go companion is built (Step 11), add:

```bash
# Go quality gates
cd companion
go vet ./...
go test ./...
go build -o bin/mvaultd ./cmd/mvaultd
```

GitHub Actions matrix for companion:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    go: ['1.22']
```

---

## 8. Environment-Specific Notes

### Windows (Development Machine)
- Node.js: `E:\Program Files\nodejs\node.exe`
- pnpm: `node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs"` (shell wrapper broken)
- Git Bash PATH: `export PATH="/e/Program Files/nodejs:$PATH"`
- PowerShell execution policy: use `-ExecutionPolicy Bypass` for scripts

### Linux/macOS (CI)
- Standard `pnpm install` works normally
- No PATH workarounds needed
- Use `pnpm` directly

---

## 9. Code Quality Standards

| Standard | Tool | Config |
|----------|------|--------|
| TypeScript strict mode | tsc | `tsconfig.json` → `"strict": true` |
| No `any` types | tsc | `"noImplicitAny": true` |
| Test coverage target | vitest | 80%+ for repositories |
| Module size limit | manual review | ≤ 300 lines per file |
| No external runtime deps | pnpm audit | Extension has 0 runtime npm deps |
