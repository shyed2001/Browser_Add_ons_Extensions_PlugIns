// ============================================================
// MindVault — Tags Repository Tests
// CRUD + unique name constraint
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  getTagsByLibrary,
  getTagByName,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  incrementTagUsage,
  decrementTagUsage,
  ensureTagsExist,
} from './tags';
import { createLibrary } from './libraries';

// ---- Helpers -----------------------------------------------

let testLibraryId: string;

async function setupLibrary(): Promise<void> {
  const lib = await createLibrary({
    name: 'Test Library',
    icon: '📚',
    color: '#007bff',
    isDefault: true,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
  });
  testLibraryId = lib.id;
}

// ---- Tests -------------------------------------------------

describe('Tags Repository', () => {
  beforeEach(async () => {
    await setupLibrary();
  });

  describe('createTag', () => {
    it('creates a tag with generated id and zero usage', async () => {
      const tag = await createTag(testLibraryId, 'research', '#ff0000');

      expect(tag.id).toBeDefined();
      expect(tag.name).toBe('research');
      expect(tag.color).toBe('#ff0000');
      expect(tag.usageCount).toBe(0);
      expect(tag.createdAt).toBeGreaterThan(0);
    });

    it('normalizes tag name to lowercase trimmed', async () => {
      const tag = await createTag(testLibraryId, '  JavaScript  ');
      expect(tag.name).toBe('javascript');
    });

    it('uses default color when none specified', async () => {
      const tag = await createTag(testLibraryId, 'default-color');
      expect(tag.color).toBe('#6c757d');
    });

    it('returns existing tag if name already exists in library', async () => {
      const tag1 = await createTag(testLibraryId, 'duplicate');
      const tag2 = await createTag(testLibraryId, 'duplicate');

      expect(tag1.id).toBe(tag2.id);
    });
  });

  describe('getTagsByLibrary', () => {
    it('returns all tags sorted by usageCount desc', async () => {
      const tag1 = await createTag(testLibraryId, 'low');
      const tag2 = await createTag(testLibraryId, 'high');
      await updateTag({ ...tag2, usageCount: 10 });

      const all = await getTagsByLibrary(testLibraryId);
      expect(all).toHaveLength(2);
      expect(all[0].name).toBe('high');
      expect(all[1].name).toBe('low');
    });

    it('returns empty array for unknown library', async () => {
      const all = await getTagsByLibrary('nonexistent');
      expect(all).toHaveLength(0);
    });
  });

  describe('getTagByName', () => {
    it('finds tag by library+name', async () => {
      await createTag(testLibraryId, 'findme');

      const found = await getTagByName(testLibraryId, 'findme');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('findme');
    });

    it('returns null for nonexistent name', async () => {
      const found = await getTagByName(testLibraryId, 'nope');
      expect(found).toBeNull();
    });
  });

  describe('getTagById', () => {
    it('returns tag by id', async () => {
      const tag = await createTag(testLibraryId, 'byid');
      const found = await getTagById(tag.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('byid');
    });

    it('returns null for nonexistent id', async () => {
      const found = await getTagById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateTag', () => {
    it('updates tag fields', async () => {
      const tag = await createTag(testLibraryId, 'update-me');
      await updateTag({ ...tag, color: '#00ff00', usageCount: 5 });

      const updated = await getTagById(tag.id);
      expect(updated!.color).toBe('#00ff00');
      expect(updated!.usageCount).toBe(5);
    });
  });

  describe('deleteTag', () => {
    it('removes a tag', async () => {
      const tag = await createTag(testLibraryId, 'delete-me');
      await deleteTag(tag.id);

      const found = await getTagById(tag.id);
      expect(found).toBeNull();
    });
  });

  describe('incrementTagUsage', () => {
    it('increments usageCount by 1', async () => {
      await createTag(testLibraryId, 'counter');
      await incrementTagUsage(testLibraryId, 'counter');

      const tag = await getTagByName(testLibraryId, 'counter');
      expect(tag!.usageCount).toBe(1);
    });

    it('does nothing for nonexistent tag', async () => {
      // Should not throw
      await incrementTagUsage(testLibraryId, 'nonexistent');
    });
  });

  describe('decrementTagUsage', () => {
    it('decrements usageCount by 1', async () => {
      const tag = await createTag(testLibraryId, 'decrement');
      await updateTag({ ...tag, usageCount: 3 });

      await decrementTagUsage(testLibraryId, 'decrement');

      const updated = await getTagByName(testLibraryId, 'decrement');
      expect(updated!.usageCount).toBe(2);
    });

    it('does not go below 0', async () => {
      await createTag(testLibraryId, 'zero');
      await decrementTagUsage(testLibraryId, 'zero');

      const tag = await getTagByName(testLibraryId, 'zero');
      expect(tag!.usageCount).toBe(0);
    });
  });

  describe('ensureTagsExist', () => {
    it('creates missing tags, skips existing', async () => {
      await createTag(testLibraryId, 'existing');

      await ensureTagsExist(testLibraryId, ['existing', 'new-one', 'new-two']);

      const all = await getTagsByLibrary(testLibraryId);
      expect(all).toHaveLength(3);
    });

    it('skips empty/whitespace tag names', async () => {
      await ensureTagsExist(testLibraryId, ['', '   ', 'valid']);

      const all = await getTagsByLibrary(testLibraryId);
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('valid');
    });
  });
});
