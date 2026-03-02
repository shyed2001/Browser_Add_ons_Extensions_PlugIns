// ============================================================
// MindVault — Download Capture (Background Service Worker)
// Stores download METADATA ONLY — never file content.
// ============================================================

import {
  createDownload,
  findDownloadByUrl,
  updateDownloadState,
  getDownloadCount,
} from '../db/repositories/downloads';
import type { DownloadState } from '@mindvault/shared';
import { pushDownload } from '../services/companion-client';

/** Map Chrome download state to our DownloadState type. */
function mapState(state: chrome.downloads.State): DownloadState {
  if (state === 'complete') return 'complete';
  if (state === 'interrupted') return 'interrupted';
  return 'in_progress';
}

/**
 * Import all existing downloads from Chrome download history.
 * Skips entries already in IndexedDB (checks by source URL).
 */
export async function importAllDownloads(libraryId: string): Promise<number> {
  const existing = await getDownloadCount(libraryId);
  if (existing > 0) return existing; // Already imported

  const items = await chrome.downloads.search({
    orderBy: ['-startTime'],
    limit: 2000,
  });

  let total = 0;
  for (const item of items) {
    if (!item.url) continue;
    const already = await findDownloadByUrl(libraryId, item.url);
    if (already) continue;

    await createDownload({
      libraryId,
      filename: item.filename ?? '',
      url: item.url,
      finalUrl: item.finalUrl ?? item.url,
      fileSize: item.fileSize ?? 0,
      mimeType: item.mime ?? 'application/octet-stream',
      downloadedAt: item.startTime ? new Date(item.startTime).getTime() : Date.now(),
      state: mapState(item.state as chrome.downloads.State),
      referrer: item.referrer ?? '',
      notes: '',
      tags: [],
    });
    total++;
  }

  return total;
}

/**
 * Listen for new downloads in real time and persist metadata.
 */
function registerLiveCapture(libraryId: string): void {
  chrome.downloads.onCreated.addListener((item: chrome.downloads.DownloadItem) => {
    if (!item.url) return;
    const downloadedAt = item.startTime ? new Date(item.startTime).getTime() : Date.now();
    const state = mapState(item.state as chrome.downloads.State);
    void createDownload({
      libraryId,
      filename: item.filename ?? '',
      url: item.url,
      finalUrl: item.finalUrl ?? item.url,
      fileSize: item.fileSize ?? 0,
      mimeType: item.mime ?? 'application/octet-stream',
      downloadedAt,
      state,
      referrer: item.referrer ?? '',
      notes: '',
      tags: [],
    }).then((dl) => {
      if (!dl) return;
      // Map 'interrupted' → 'error' (companion DB only allows in_progress|complete|error)
      const companionState = dl.state === 'interrupted' ? 'error' : dl.state;
      void pushDownload(libraryId, {
        id: dl.id,
        filename: dl.filename,
        url: dl.url,
        mimeType: dl.mimeType,
        fileSize: dl.fileSize,
        downloadedAt: dl.downloadedAt,
        state: companionState,
        notes: dl.notes,
      });
    });
  });

  chrome.downloads.onChanged.addListener((delta: chrome.downloads.DownloadDelta) => {
    if (!delta.state?.current) return;
    // We do not have the URL in delta — update is best-effort via chrome.downloads.search
    void chrome.downloads.search({ id: delta.id }).then((items) => {
      if (!items[0]?.url) return;
      void findDownloadByUrl(libraryId, items[0].url).then((dl) => {
        if (!dl) return;
        void updateDownloadState(dl.id, mapState(delta.state!.current as chrome.downloads.State));
      });
    });
  });
}

/**
 * Full init: import all existing downloads, then start live capture.
 */
export async function initDownloadCapture(libraryId: string): Promise<void> {
  try {
    const count = await importAllDownloads(libraryId);
    console.log('MindVault: imported', count, 'download records for library', libraryId);
  } catch (err) {
    console.error('MindVault: download import failed', err);
  }

  registerLiveCapture(libraryId);
}