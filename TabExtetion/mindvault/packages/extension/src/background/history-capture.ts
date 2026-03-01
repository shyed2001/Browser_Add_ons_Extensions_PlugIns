// ============================================================
// MindVault — History Capture (Background Service Worker)
// Imports full browser history on first run, then listens for new visits.
// ============================================================

import {
  upsertHistoryEntry,
  getHistoryCount,
} from '../db/repositories/history';
import { pushHistoryEntry } from '../services/companion-client';

const BATCH_SIZE = 500;

/**
 * Import all browser history from the beginning of time into IndexedDB.
 * Uses upsertHistoryEntry to avoid duplicates (same URL, same day = update).
 * Skips if library already has history (avoid double-import on restart).
 */
export async function importAllHistory(libraryId: string): Promise<number> {
  const existing = await getHistoryCount(libraryId);
  if (existing > 0) return existing; // Already imported

  let total = 0;
  let startTime = 0; // epoch — fetch from the very beginning

  // Paginate in batches since maxResults can be large
  while (true) {
    const results = await chrome.history.search({
      text: '',
      startTime,
      maxResults: BATCH_SIZE,
    });

    if (results.length === 0) break;

    for (const item of results) {
      if (!item.url) continue;
      const visitTime = item.lastVisitTime ?? Date.now();
      await upsertHistoryEntry(
        libraryId,
        item.url,
        item.title ?? '',
        visitTime,
        'link'
      );
      total++;
    }

    if (results.length < BATCH_SIZE) break;

    // Advance past the oldest entry in this batch to avoid infinite loop
    const oldest = Math.min(...results.map((r) => r.lastVisitTime ?? Date.now()));
    if (oldest <= startTime) break;
    startTime = oldest + 1;
  }

  return total;
}

/**
 * Listen for new history visits and persist them in real time.
 */
function registerLiveCapture(libraryId: string): void {
  chrome.history.onVisited.addListener((item: chrome.history.HistoryItem) => {
    if (!item.url) return;
    const visitTime = item.lastVisitTime ?? Date.now();
    void upsertHistoryEntry(libraryId, item.url, item.title ?? '', visitTime, 'link').then(
      (entry) => {
        if (!entry) return;
        let domain = item.url ?? '';
        try { domain = new URL(item.url ?? '').hostname; } catch { /* use raw url */ }
        void pushHistoryEntry(libraryId, {
          id: entry.id,
          url: item.url ?? '',
          title: item.title ?? '',
          visitTime,
          domain,
          isImportant: entry.isImportant ?? false,
        });
      }
    );
  });
}

/**
 * Full init: import all existing history, then start live capture.
 */
export async function initHistoryCapture(libraryId: string): Promise<void> {
  try {
    const count = await importAllHistory(libraryId);
    console.log('MindVault: imported', count, 'history entries for library', libraryId);
  } catch (err) {
    console.error('MindVault: history import failed', err);
  }

  registerLiveCapture(libraryId);
}
