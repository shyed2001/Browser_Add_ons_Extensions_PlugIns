# MindVault — Configuration Reference

## Extension Configuration

### manifest.json
`packages/extension/manifest.json`

| Field | Value | Notes |
|-------|-------|-------|
| `manifest_version` | 3 | Chrome MV3 (required for new extensions) |
| `permissions` | tabs, storage, downloads, history, bookmarks, nativeMessaging | All declared upfront |
| `action.default_popup` | `src/popup/popup.html` | Extension icon click |
| `options_page` | `src/dashboard/dashboard.html` | Right-click → Options |
| `background.service_worker` | `src/background/index.ts` | MV3 service worker |

### vite.config.ts
`packages/extension/vite.config.ts`

| Setting | Value | Notes |
|---------|-------|-------|
| `plugin` | `@samrum/vite-plugin-web-extension` | Handles MV3 manifest processing |
| `outDir` | `dist` | All built files go here |
| `emptyOutDir` | `true` | Clean build every time |
| `sourcemap` | `true` in dev, `false` in prod | `NODE_ENV !== 'production'` |
| `alias @mindvault/shared` | `../shared/src/index.ts` | Direct TS source, no build step |

### tsconfig.json
`packages/extension/tsconfig.json` extends `../../tsconfig.base.json`

Key settings:
- `target`: `ES2020` (Chrome 80+)
- `module`: `ESNext`
- `strict`: `true`
- `paths`: `@mindvault/shared` → `../shared/src/index.ts`

### tsconfig.base.json (workspace root)
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `exactOptionalPropertyTypes: true`

## Test Configuration

In `vite.config.ts` under the `test` key:

| Setting | Value |
|---------|-------|
| `environment` | `happy-dom` |
| `globals` | `true` |
| `setupFiles` | `./src/test-setup.ts` |
| Coverage provider | `v8` |
| Coverage reporters | `text`, `json`, `html` |
| Coverage thresholds (global) | branches 70%, functions 75%, lines 75% |

### test-setup.ts
```typescript
import 'fake-indexeddb/auto';   // polyfills IndexedDB globally
beforeEach(() => {
  // @ts-expect-error reset IDB between tests
  globalThis.indexedDB = new IDBFactory();
});
```

## Encryption Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | PBKDF2-SHA256 | Key derivation |
| Iterations | 600,000 | OWASP 2024 recommendation |
| Salt size | 16 bytes | Random, stored in library record |
| Key size | 256 bits | AES-256-GCM |
| IV size | 12 bytes | Random per encryption operation |
| Verification | SHA-256(rawKey + salt) | Stored in library, never the key |

## IndexedDB Schema

| Store | Version | Indexes |
|-------|---------|---------|
| `libraries` | 2 | `isDefault` |
| `sessions` | 2 | `libraryId`, `createdAt`, `isFavorite` |
| `saved_tabs` | 2 | `libraryId`, `url`, `sessionId`, `repeatCount`, `lastSeenAt`, `libraryId_url` |
| `bookmarks` | 2 | `libraryId`, `parentId`, `url` |
| `history_entries` | 2 | `libraryId`, `visitTime`, `visitDate`, `isImportant` |
| `downloads` | 2 | `libraryId`, `downloadedAt`, `mimeType` |
| `tags` | 2 | `libraryId`, `name` (unique per library) |
| `audit_log` | 2 | `timestamp`, `entityType`, `libraryId` |
| `schema_meta` | 2 | (keyPath: `key`) |

**Note:** Boolean and null values cannot be used in IDB compound key ranges.
Use memory-side filtering for `isImportant` and `parentId === null` queries.

## pnpm Workspace

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
```

Packages reference each other as:
```json
{ "@mindvault/shared": "workspace:*" }
```

## Environment

No environment variables are required for the extension.
The extension runs entirely client-side (browser + IndexedDB + WebCrypto).

Future phases will add:
- Companion daemon: `COMPANION_PORT=47821` (default, configurable)
- Web API (Phase 4): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
