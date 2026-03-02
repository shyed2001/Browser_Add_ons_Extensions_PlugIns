// ============================================================
// MindVault — Tags Repository
// Tags are per-library, unique by name within a library.
// Many-to-many relationship managed by tag name arrays on entities.
// ============================================================

import type { Tag } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';

export async function getTagsByLibrary(libraryId: string): Promise<Tag[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.TAGS, 'readonly');
  const index = tx.objectStore(STORE.TAGS).index('libraryId');
  const tags = await promisifyRequest<Tag[]>(index.getAll(IDBKeyRange.only(libraryId)));
  return tags.sort((a, b) => b.usageCount - a.usageCount);
}

export async function getTagByName(
  libraryId: string,
  name: string
): Promise<Tag | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.TAGS, 'readonly');
  const index = tx.objectStore(STORE.TAGS).index('libraryId_name');
  const result = await promisifyRequest<Tag | undefined>(
    index.get(IDBKeyRange.only([libraryId, name]))
  );
  return result ?? null;
}

export async function getTagById(id: string): Promise<Tag | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.TAGS, 'readonly');
  const result = await promisifyRequest<Tag | undefined>(
    tx.objectStore(STORE.TAGS).get(id)
  );
  return result ?? null;
}

/**
 * Create a tag. Returns existing tag if name already exists in this library.
 */
export async function createTag(
  libraryId: string,
  name: string,
  color = '#6c757d'
): Promise<Tag> {
  const existing = await getTagByName(libraryId, name);
  if (existing) return existing;

  const tag: Tag = {
    id: generateUUID(),
    libraryId,
    name: name.trim().toLowerCase(),
    color,
    usageCount: 0,
    createdAt: Date.now(),
  };
  const db = await openDB();
  const tx = db.transaction(STORE.TAGS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.TAGS).put(tag));
  return tag;
}

export async function updateTag(tag: Tag): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.TAGS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.TAGS).put(tag));
}

export async function deleteTag(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.TAGS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.TAGS).delete(id));
}

/** Increment usageCount when a tag is applied to an entity */
export async function incrementTagUsage(libraryId: string, tagName: string): Promise<void> {
  const tag = await getTagByName(libraryId, tagName);
  if (!tag) return;
  await updateTag({ ...tag, usageCount: tag.usageCount + 1 });
}

/** Decrement usageCount when a tag is removed from an entity */
export async function decrementTagUsage(libraryId: string, tagName: string): Promise<void> {
  const tag = await getTagByName(libraryId, tagName);
  if (!tag || tag.usageCount <= 0) return;
  await updateTag({ ...tag, usageCount: tag.usageCount - 1 });
}

/** Ensure all tag names in array exist in the library, creating missing ones */
export async function ensureTagsExist(libraryId: string, tagNames: string[]): Promise<void> {
  for (const name of tagNames) {
    if (name.trim()) await createTag(libraryId, name);
  }
}
