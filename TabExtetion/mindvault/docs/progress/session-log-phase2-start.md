# MindVault - Session Log: Phase 2 Start
**Date:** 2026-02-22

## Summary

Phase 2 started. Previous session completed Phase 1 (v2.0.0 tagged).

## Work Completed

### 1. History Repository Tests (22 tests)

Full coverage: createHistoryEntry, getHistoryByLibrary, getHistoryByDateRange,
getHistoryByDate, getImportantHistory, getHistoryById, upsertHistoryEntry (3 cases),
markHistoryStarred, markHistoryImportant, deleteHistoryEntry, getHistoryCount

Bug fixed: getImportantHistory used IDBKeyRange.only([libraryId, true]) but
boolean is not a valid IDB key type. Fixed to filter in memory after libraryId index fetch.

### 2. Downloads Repository Tests (21 tests)

Full coverage: createDownload, getDownloadsByLibrary, getDownloadById,
getDownloadsByMimeType, updateDownloadState, updateDownloadNotes, deleteDownload,
getDownloadCount, findDownloadByUrl (cross-library isolation)

### 3. Manifest Permissions
 - added: history, bookmarks, nativeMessaging

### 4. Background Service Worker Entry

Gets default library, calls initHistoryCapture + initDownloadCapture on install/startup.

### 5. History Capture Script

- importAllHistory: paginates chrome.history.search in batches of 500 (idempotent)
- registerLiveCapture: chrome.history.onVisited listener
- initHistoryCapture: orchestrates both

### 6. Download Capture Script

- importAllDownloads: chrome.downloads.search limit 2000, URL-deduplicated (idempotent)
- onCreated + onChanged listeners for live capture (metadata only)
- initDownloadCapture: orchestrates both

### 7. History Rules Engine

- evaluateRule(entry, rule): pure function
- applyRules(entry, rules): OR logic across enabled rules
- runRulesEngine(libraryId, rules): updates isImportant flag in IndexedDB
- Conditions: visit_count (gt/gte/lt/lte/eq), starred, tagged, domain (glob), date_range

## Test Results

Extension: 104/104 passing (up from 61)
Shared:    47/47  passing
Build:     24 modules, clean

## Bugs Fixed

1. getImportantHistory: boolean compound key bug - fixed to filter in memory
2. getHistoryByLibrary: broken IDBKeyRange compound key - fixed to simple libraryId index
3. getDownloadsByLibrary: same broken compound key pattern - fixed

## Files Created

- packages/extension/src/background/index.ts
- packages/extension/src/background/history-capture.ts
- packages/extension/src/background/download-capture.ts
- packages/extension/src/services/rules-engine.ts
- packages/extension/src/db/repositories/history.test.ts (22 tests)
- packages/extension/src/db/repositories/downloads.test.ts (21 tests)

## Files Modified

- packages/extension/manifest.json (added permissions)
- packages/extension/src/db/repositories/history.ts (3 bug fixes)
- packages/extension/src/db/repositories/downloads.ts (1 bug fix)
- CHANGELOG.md (Phase 2 section added)

## Next Phase 2 Steps Remaining

- background/bookmark-sync.ts
- Audit log implementation
- Library switcher + encryption UI
- WebCrypto wiring into repositories
- .mvault encrypted backup export/import
- Go companion daemon (major milestone)
- Firefox webextension-polyfill support
- docs/progress/checkpoint-phase2-complete.md
- git tag: v3.0.0

## Key IDB Pattern Reminder

Boolean and null values cannot be used in IDB compound keys.
Always use the plain index and filter in memory for boolean/null fields.