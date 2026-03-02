// ============================================================
// MindVault — Downloads Repository Tests
// CRUD + state updates + mime-type filter + dedup helper
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createDownload,
  getDownloadsByLibrary,
  getDownloadById,
  getDownloadsByMimeType,
  updateDownloadState,
  updateDownloadNotes,
  deleteDownload,
  getDownloadCount,
  findDownloadByUrl,
} from './downloads';
import { createLibrary } from './libraries';
import type { DownloadState } from '@mindvault/shared';

// ---- Helpers -----------------------------------------------

const NOW = Date.now();

let testLibraryId: string;

async function setupLibrary(): Promise<void> {
  const lib = await createLibrary({
    name: 'Downloads Test Library',
    icon: '⬇️',
    color: '#ff6600',
    isDefault: false,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
  });
  testLibraryId = lib.id;
}

function makeDl(overrides: Partial<{
  url: string;
  filename: string;
  mimeType: string;
  state: DownloadState;
  downloadedAt: number;
}> = {}) {
  return {
    libraryId: testLibraryId,
    filename: overrides.filename ?? 'file.pdf',
    url: overrides.url ?? 'https://example.com/file.pdf',
    finalUrl: overrides.url ?? 'https://example.com/file.pdf',
    fileSize: 1024,
    mimeType: overrides.mimeType ?? 'application/pdf',
    downloadedAt: overrides.downloadedAt ?? NOW,
    state: (overrides.state ?? 'complete') as DownloadState,
    referrer: 'https://example.com',
    notes: '',
    tags: [],
  };
}

// ---- Tests -------------------------------------------------

describe('Downloads Repository', () => {
  beforeEach(async () => {
    await setupLibrary();
  });

  // ----------------------------------------------------------
  describe('createDownload', () => {
    it('generates an id and stores all fields', async () => {
      const dl = await createDownload(makeDl());

      expect(dl.id).toBeDefined();
      expect(typeof dl.id).toBe('string');
      expect(dl.filename).toBe('file.pdf');
      expect(dl.mimeType).toBe('application/pdf');
      expect(dl.state).toBe('complete');
    });

    it('persists to IndexedDB (retrievable by id)', async () => {
      const dl = await createDownload(makeDl({ url: 'https://persist.com/a.zip' }));

      const found = await getDownloadById(dl.id);
      expect(found).not.toBeNull();
      expect(found!.url).toBe('https://persist.com/a.zip');
    });
  });

  // ----------------------------------------------------------
  describe('getDownloadsByLibrary', () => {
    it('returns all downloads for the library sorted newest first', async () => {
      await createDownload(makeDl({ url: 'https://older.com/a.pdf', downloadedAt: NOW - 10000 }));
      await createDownload(makeDl({ url: 'https://newer.com/b.pdf', downloadedAt: NOW }));

      const all = await getDownloadsByLibrary(testLibraryId);
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all[0].downloadedAt).toBeGreaterThanOrEqual(all[1].downloadedAt);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await createDownload(makeDl({ url: `https://limit${i}.com/file.pdf` }));
      }

      const limited = await getDownloadsByLibrary(testLibraryId, 2);
      expect(limited).toHaveLength(2);
    });

    it('returns empty array for unknown library', async () => {
      const all = await getDownloadsByLibrary('no-such-library');
      expect(all).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  describe('getDownloadById', () => {
    it('returns download by id', async () => {
      const dl = await createDownload(makeDl({ url: 'https://getbyid.com/c.pdf' }));

      const found = await getDownloadById(dl.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(dl.id);
    });

    it('returns null for nonexistent id', async () => {
      const found = await getDownloadById('ghost-dl-id');
      expect(found).toBeNull();
    });
  });

  // ----------------------------------------------------------
  describe('getDownloadsByMimeType', () => {
    it('returns only downloads matching the given mime type', async () => {
      await createDownload(makeDl({ url: 'https://pdf.com/a.pdf', mimeType: 'application/pdf' }));
      await createDownload(makeDl({ url: 'https://zip.com/b.zip', mimeType: 'application/zip' }));
      await createDownload(makeDl({ url: 'https://img.com/c.png', mimeType: 'image/png' }));

      const pdfs = await getDownloadsByMimeType(testLibraryId, 'application/pdf');
      expect(pdfs.every((d) => d.mimeType === 'application/pdf')).toBe(true);
      expect(pdfs.some((d) => d.url.includes('pdf.com'))).toBe(true);
    });

    it('returns empty for mime type with no matches', async () => {
      const results = await getDownloadsByMimeType(testLibraryId, 'video/mp4');
      expect(results).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  describe('updateDownloadState', () => {
    it('updates state to in_progress', async () => {
      const dl = await createDownload(makeDl({ state: 'in_progress' }));

      await updateDownloadState(dl.id, 'complete');

      const updated = await getDownloadById(dl.id);
      expect(updated!.state).toBe('complete');
    });

    it('updates state to interrupted', async () => {
      const dl = await createDownload(makeDl({ state: 'complete' }));

      await updateDownloadState(dl.id, 'interrupted');

      const updated = await getDownloadById(dl.id);
      expect(updated!.state).toBe('interrupted');
    });

    it('is a no-op for nonexistent id', async () => {
      await expect(updateDownloadState('ghost', 'complete')).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  describe('updateDownloadNotes', () => {
    it('sets notes on an existing download', async () => {
      const dl = await createDownload(makeDl());

      await updateDownloadNotes(dl.id, 'Important research paper');

      const updated = await getDownloadById(dl.id);
      expect(updated!.notes).toBe('Important research paper');
    });

    it('overwrites existing notes', async () => {
      const dl = await createDownload(makeDl());
      await updateDownloadNotes(dl.id, 'First note');
      await updateDownloadNotes(dl.id, 'Second note');

      const updated = await getDownloadById(dl.id);
      expect(updated!.notes).toBe('Second note');
    });

    it('is a no-op for nonexistent id', async () => {
      await expect(updateDownloadNotes('ghost', 'note')).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  describe('deleteDownload', () => {
    it('removes a download from the store', async () => {
      const dl = await createDownload(makeDl({ url: 'https://trash.com/x.pdf' }));

      await deleteDownload(dl.id);

      const found = await getDownloadById(dl.id);
      expect(found).toBeNull();
    });
  });

  // ----------------------------------------------------------
  describe('getDownloadCount', () => {
    it('returns total downloads for library', async () => {
      await createDownload(makeDl({ url: 'https://cnt1.com/a.pdf' }));
      await createDownload(makeDl({ url: 'https://cnt2.com/b.pdf' }));

      const count = await getDownloadCount(testLibraryId);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('returns 0 for unknown library', async () => {
      const count = await getDownloadCount('nonexistent-dl-lib');
      expect(count).toBe(0);
    });
  });

  // ----------------------------------------------------------
  describe('findDownloadByUrl', () => {
    it('finds an existing download by URL', async () => {
      await createDownload(makeDl({ url: 'https://findme.com/report.pdf' }));

      const found = await findDownloadByUrl(testLibraryId, 'https://findme.com/report.pdf');
      expect(found).not.toBeNull();
      expect(found!.url).toBe('https://findme.com/report.pdf');
    });

    it('returns null when URL not found', async () => {
      const found = await findDownloadByUrl(testLibraryId, 'https://nothere.com/ghost.pdf');
      expect(found).toBeNull();
    });

    it('does not return a match from a different library', async () => {
      const otherLib = await createLibrary({
        name: 'Other Lib',
        icon: '📁',
        color: '#999',
        isDefault: false,
        encryptionEnabled: false,
        encryptionSalt: null,
        encryptionKeyHash: null,
      });
      await createDownload({
        ...makeDl({ url: 'https://shared-url.com/doc.pdf' }),
        libraryId: otherLib.id,
      });

      const found = await findDownloadByUrl(testLibraryId, 'https://shared-url.com/doc.pdf');
      expect(found).toBeNull();
    });
  });
});
