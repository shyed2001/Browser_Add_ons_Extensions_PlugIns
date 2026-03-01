// ============================================================
// MindVault — History Repository Tests
// CRUD + date queries + star/important flags + upsert
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createHistoryEntry,
  getHistoryByLibrary,
  getHistoryByDateRange,
  getHistoryByDate,
  getImportantHistory,
  getHistoryById,
  upsertHistoryEntry,
  markHistoryStarred,
  markHistoryImportant,
  deleteHistoryEntry,
  getHistoryCount,
} from './history';
import { createLibrary } from './libraries';

// ---- Helpers -----------------------------------------------

// Fixed timestamps for deterministic date-slice tests
// 2026-01-10T12:00:00.000Z
const DAY1_MS = 1736510400000;
// 2026-01-11T12:00:00.000Z
const DAY2_MS = 1736596800000;

let testLibraryId: string;

async function setupLibrary(): Promise<void> {
  const lib = await createLibrary({
    name: 'History Test Library',
    icon: '📜',
    color: '#333333',
    isDefault: false,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
  });
  testLibraryId = lib.id;
}

// ---- Tests -------------------------------------------------

describe('History Repository', () => {
  beforeEach(async () => {
    await setupLibrary();
  });

  // ----------------------------------------------------------
  describe('createHistoryEntry', () => {
    it('generates id and visitDate automatically', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://example.com',
        title: 'Example',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      expect(entry.id).toBeDefined();
      expect(typeof entry.id).toBe('string');
      expect(entry.visitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('stores all supplied fields', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://stored.com',
        title: 'Stored',
        visitTime: DAY1_MS,
        visitCount: 3,
        transition: 'typed',
        isImportant: true,
        isStarred: true,
        tags: ['work'],
      });

      const found = await getHistoryById(entry.id);
      expect(found).not.toBeNull();
      expect(found!.url).toBe('https://stored.com');
      expect(found!.visitCount).toBe(3);
      expect(found!.transition).toBe('typed');
      expect(found!.isImportant).toBe(true);
      expect(found!.isStarred).toBe(true);
      expect(found!.tags).toEqual(['work']);
    });
  });

  // ----------------------------------------------------------
  describe('getHistoryByLibrary', () => {
    it('returns all entries sorted newest first', async () => {
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://old.com',
        title: 'Old',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://new.com',
        title: 'New',
        visitTime: DAY2_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      const entries = await getHistoryByLibrary(testLibraryId);
      expect(entries.length).toBeGreaterThanOrEqual(2);
      // Most recent first
      expect(entries[0].visitTime).toBeGreaterThanOrEqual(entries[1].visitTime);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await createHistoryEntry({
          libraryId: testLibraryId,
          url: `https://limit${i}.com`,
          title: `Limit ${i}`,
          visitTime: DAY1_MS + i * 1000,
          visitCount: 1,
          transition: 'link',
          isImportant: false,
          isStarred: false,
          tags: [],
        });
      }

      const limited = await getHistoryByLibrary(testLibraryId, 3);
      expect(limited).toHaveLength(3);
    });

    it('returns empty array for unknown library', async () => {
      const entries = await getHistoryByLibrary('nonexistent-lib');
      expect(entries).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  describe('getHistoryByDateRange', () => {
    it('returns entries within the given time range', async () => {
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://inrange.com',
        title: 'In Range',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://outrange.com',
        title: 'Out Range',
        visitTime: DAY2_MS + 86400000, // DAY3
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      const results = await getHistoryByDateRange(
        testLibraryId,
        DAY1_MS - 1000,
        DAY2_MS
      );
      const urls = results.map((e) => e.url);
      expect(urls).toContain('https://inrange.com');
      expect(urls).not.toContain('https://outrange.com');
    });
  });

  // ----------------------------------------------------------
  describe('getHistoryByDate', () => {
    it('returns entries matching a specific date slice', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://datetest.com',
        title: 'Date Test',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      const byDate = await getHistoryByDate(testLibraryId, entry.visitDate);
      const urls = byDate.map((e) => e.url);
      expect(urls).toContain('https://datetest.com');
    });

    it('returns empty for a date with no entries', async () => {
      const byDate = await getHistoryByDate(testLibraryId, '1999-01-01');
      expect(byDate).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  describe('getImportantHistory', () => {
    it('returns only entries flagged isImportant=true', async () => {
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://important.com',
        title: 'Important',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: true,
        isStarred: false,
        tags: [],
      });
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://noisy.com',
        title: 'Noise',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      const important = await getImportantHistory(testLibraryId);
      const urls = important.map((e) => e.url);
      expect(urls).toContain('https://important.com');
      expect(urls).not.toContain('https://noisy.com');
    });
  });

  // ----------------------------------------------------------
  describe('getHistoryById', () => {
    it('returns entry by id', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://byid.com',
        title: 'By ID',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      const found = await getHistoryById(entry.id);
      expect(found).not.toBeNull();
      expect(found!.url).toBe('https://byid.com');
    });

    it('returns null for nonexistent id', async () => {
      const found = await getHistoryById('no-such-id');
      expect(found).toBeNull();
    });
  });

  // ----------------------------------------------------------
  describe('upsertHistoryEntry', () => {
    it('creates a new entry when URL is first seen on that day', async () => {
      const entry = await upsertHistoryEntry(
        testLibraryId,
        'https://first-visit.com',
        'First Visit',
        DAY1_MS
      );

      expect(entry.id).toBeDefined();
      expect(entry.visitCount).toBe(1);
      expect(entry.url).toBe('https://first-visit.com');
    });

    it('increments visitCount when same URL visited again on same day', async () => {
      // First visit
      await upsertHistoryEntry(
        testLibraryId,
        'https://revisit.com',
        'Revisit',
        DAY1_MS
      );
      // Second visit — same URL, same day
      const updated = await upsertHistoryEntry(
        testLibraryId,
        'https://revisit.com',
        'Revisit (updated title)',
        DAY1_MS + 3600000 // 1 hour later, same day
      );

      expect(updated.visitCount).toBe(2);
      expect(updated.url).toBe('https://revisit.com');
    });

    it('creates new entry for same URL on different day', async () => {
      await upsertHistoryEntry(
        testLibraryId,
        'https://twodays.com',
        'Two Days',
        DAY1_MS
      );
      const day2Entry = await upsertHistoryEntry(
        testLibraryId,
        'https://twodays.com',
        'Two Days',
        DAY2_MS
      );

      // Should be a new entry (visitCount = 1, not 2)
      expect(day2Entry.visitCount).toBe(1);
    });
  });

  // ----------------------------------------------------------
  describe('markHistoryStarred', () => {
    it('sets isStarred to true', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://star.com',
        title: 'Star Me',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      await markHistoryStarred(entry.id, true);

      const updated = await getHistoryById(entry.id);
      expect(updated!.isStarred).toBe(true);
    });

    it('sets isStarred to false (unstar)', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://unstar.com',
        title: 'Unstar Me',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: true,
        tags: [],
      });

      await markHistoryStarred(entry.id, false);

      const updated = await getHistoryById(entry.id);
      expect(updated!.isStarred).toBe(false);
    });

    it('is a no-op for nonexistent id', async () => {
      await expect(markHistoryStarred('ghost-id', true)).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  describe('markHistoryImportant', () => {
    it('sets isImportant to true', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://markimportant.com',
        title: 'Mark Important',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      await markHistoryImportant(entry.id, true);

      const updated = await getHistoryById(entry.id);
      expect(updated!.isImportant).toBe(true);
    });

    it('sets isImportant to false', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://unimportant.com',
        title: 'Unimportant',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: true,
        isStarred: false,
        tags: [],
      });

      await markHistoryImportant(entry.id, false);

      const updated = await getHistoryById(entry.id);
      expect(updated!.isImportant).toBe(false);
    });
  });

  // ----------------------------------------------------------
  describe('deleteHistoryEntry', () => {
    it('removes the entry', async () => {
      const entry = await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://delete-me.com',
        title: 'Delete Me',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      await deleteHistoryEntry(entry.id);

      const found = await getHistoryById(entry.id);
      expect(found).toBeNull();
    });
  });

  // ----------------------------------------------------------
  describe('getHistoryCount', () => {
    it('returns the number of entries for a library', async () => {
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://count1.com',
        title: 'Count 1',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });
      await createHistoryEntry({
        libraryId: testLibraryId,
        url: 'https://count2.com',
        title: 'Count 2',
        visitTime: DAY1_MS,
        visitCount: 1,
        transition: 'link',
        isImportant: false,
        isStarred: false,
        tags: [],
      });

      const count = await getHistoryCount(testLibraryId);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('returns 0 for unknown library', async () => {
      const count = await getHistoryCount('nonexistent-hist-lib');
      expect(count).toBe(0);
    });
  });
});
