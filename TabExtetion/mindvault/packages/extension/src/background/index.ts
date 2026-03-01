// ============================================================
// MindVault — Background Service Worker Entry
// Coordinates history capture, download capture, and bookmark sync.
// ============================================================

import '../polyfill'; // webextension-polyfill — must be first import
import { getDefaultLibrary } from '../db/repositories/libraries';
import { initHistoryCapture } from './history-capture';
import { initDownloadCapture } from './download-capture';
import { initBookmarkSync } from './bookmark-sync';
import { bootstrapCompanion, syncAllUnpushedSessions } from '../services/companion-client';

// ---- Startup -----------------------------------------------

async function onStartup(): Promise<void> {
  const lib = await getDefaultLibrary();
  if (!lib) {
    console.warn('MindVault: No default library found — skipping capture init.');
    return;
  }

  await initHistoryCapture(lib.id);
  await initDownloadCapture(lib.id);
  await initBookmarkSync(lib.id);

  // Bootstrap companion sync (fire-and-forget — companion may not be running)
  // Map IDB Library field names → companion REST payload field names.
  // After bootstrap, sync any offline-saved sessions that missed the daemon.
  void (async () => {
    await bootstrapCompanion({
      id: lib.id,
      name: lib.name,
      isEncrypted: lib.encryptionEnabled,
      passwordSalt: lib.encryptionSalt ?? null,
    });
    // ISSUE-011 fix: push IndexedDB sessions that were saved while daemon was offline
    void syncAllUnpushedSessions();
  })();
}

// ---- Install -----------------------------------------------

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install' || reason === 'update') {
    void onStartup();
  }
});

// ---- Service Worker Startup --------------------------------

chrome.runtime.onStartup.addListener(() => {
  void onStartup();
});

// Trigger immediately when service worker first activates
void onStartup();
