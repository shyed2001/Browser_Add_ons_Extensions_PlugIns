# MindVault Session Log — 2026-02-23 (Steps 12–13)

**Date:** 2026-02-23  
**Steps:** Phase 2 Step 12 (Native Messaging Registration) + Step 13 (Firefox Polyfill)  
**Commits:** `ffcabf9` (Step 12), `a8c4a68` (Step 13)

---

## Step 12 — Native Messaging Host Registration

### What Was Done
- Created `companion/com.mindvault.companion.json` — manifest template for Chrome native messaging
- Created `scripts/register-native-host.ps1` — PowerShell registration script
  - Writes manifest to `%LOCALAPPDATA%\MindVault\`
  - Registers `HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion`
  - Accepts `-ExtensionId` and `-BinaryPath` params; prompts interactively if omitted
  - No admin required (HKCU only)
- Created `scripts/unregister-native-host.ps1` — cleanup script

### Registry Verification
```
Path: HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mindvault.companion
Value: C:\Users\Dell Vostro\AppData\Local\MindVault\com.mindvault.companion.json
```

### Issue: Path-with-spaces workaround
`C:\Users\Dell Vostro\` path broke `start_process` / PowerShell invocations.  
Fix: Wrote scripts to `C:\Temp\` (no spaces), called via `powershell.exe -File C:\Temp\script.ps1`.

### Dev Mode Note
Registered manifest uses wildcard origin `chrome-extension://*/` for dev convenience.  
Before production: replace with real extension ID from `chrome://extensions`.

---

## Step 13 — Firefox Polyfill + Cross-Browser Manifest

### What Was Done
- Added `webextension-polyfill` as runtime dependency
- Added `@types/webextension-polyfill` as devDependency
- Created `packages/extension/src/polyfill.ts`:
  ```typescript
  import 'webextension-polyfill';
  ```
- Added `import '../polyfill';` as first import in:
  - `src/background/index.ts`
  - `src/popup/index.ts`
  - `src/dashboard/index.ts`
- Created `packages/extension/manifest-firefox.json` (MV2, Firefox 115+):
  - `manifest_version: 2`, `browser_action`, `background.scripts` array
  - `browser_specific_settings.gecko.id = "mindvault@mindvault.app"`
  - `strict_min_version: "115.0"`

### Build Verification
```
✓ 32 modules transformed (up from 28)
✓ 116 tests passing (no regressions)
✓ built in 345ms
```

---

## Files Changed (cumulative, both steps)

| File | Status |
|------|--------|
| `companion/com.mindvault.companion.json` | NEW |
| `scripts/register-native-host.ps1` | NEW |
| `scripts/unregister-native-host.ps1` | NEW |
| `packages/extension/src/polyfill.ts` | NEW |
| `packages/extension/manifest-firefox.json` | NEW |
| `packages/extension/src/background/index.ts` | MODIFIED |
| `packages/extension/src/popup/index.ts` | MODIFIED |
| `packages/extension/src/dashboard/index.ts` | MODIFIED |
| `packages/extension/package.json` | MODIFIED |
| `pnpm-lock.yaml` | MODIFIED |
| `CHANGELOG.md` | MODIFIED |

---

## Next: Step 14 — Windows Installer Scaffold

The plan calls for a Windows installer that:
- Copies `mvaultd.exe` to a stable location (e.g. `%LOCALAPPDATA%\MindVault\bin\`)
- Runs `register-native-host.ps1` automatically
- Optionally adds `mvaultd` to startup (Task Scheduler or HKCU Run key)
