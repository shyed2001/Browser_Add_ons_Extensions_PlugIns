# MindVault — Developer Setup

## Prerequisites

Install these once before starting:

1. **Node.js 20+** — https://nodejs.org/en/download (LTS recommended)
2. **pnpm 9+** — after Node.js is installed, run:
   ```
   npm install -g pnpm
   ```
3. **Git** — https://git-scm.com/downloads (if not already installed)

## First-time setup

```bash
# 1. Navigate to the project
cd "C:\Users\Dell Vostro\Documents\TabExtetion\mindvault"

# 2. Install all workspace dependencies
pnpm install

# 3. Run tests (should all pass)
pnpm test

# 4. Build the extension
pnpm build

# 5. Load in Chrome:
#    - Open chrome://extensions
#    - Enable "Developer mode" (top right toggle)
#    - Click "Load unpacked"
#    - Select: C:\Users\Dell Vostro\Documents\TabExtetion\mindvault\packages\extension\dist
```

## Daily development workflow

```bash
# Watch mode — auto-rebuilds on file save
pnpm dev

# Run tests once
pnpm test

# Run tests in watch mode
pnpm --filter @mindvault/extension test:watch

# Lint + format check
pnpm lint
pnpm format:check

# Fix formatting
pnpm format

# Full typecheck
pnpm typecheck
```

## Packages

| Package | Path | Purpose |
|---|---|---|
| `@mindvault/shared` | `packages/shared/` | Types, utilities, crypto |
| `@mindvault/extension` | `packages/extension/` | Chrome/Firefox extension |
| `companion` | `packages/companion/` | Go daemon (Phase 2) |
| `desktop` | `packages/desktop/` | .NET MAUI desktop app (Phase 3) |
| `web` | `packages/web/` | Web app (Phase 4) |

## Git workflow

```bash
# Create feature branch
git checkout develop
git checkout -b feature/your-feature-name

# After work: commit and PR to develop
git add <specific-files>
git commit -m "feat: your change description"
# Push and open PR on GitHub
```

## Testing

Tests use **Vitest** with `fake-indexeddb` for IndexedDB simulation.

```bash
# Run all tests with coverage
pnpm test:coverage

# Run only shared package tests
pnpm --filter @mindvault/shared test

# Run only extension tests
pnpm --filter @mindvault/extension test
```
