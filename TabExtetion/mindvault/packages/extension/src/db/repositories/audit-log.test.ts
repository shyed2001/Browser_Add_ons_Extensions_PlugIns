import { describe, it, expect, beforeEach } from 'vitest';
import { generateUUID } from '@mindvault/shared';
import { createLibrary } from './libraries';
import {
  logAction,
  getAuditLog,
  getAuditLogByEntity,
  getAuditLogCount,
  pruneAuditLog,
} from './audit-log';

// ---- Test fixtures -----------------------------------------

let testLibraryId: string;

beforeEach(async () => {
  const lib = await createLibrary({
    name: 'Audit Test Library',
    icon: '📋',
    color: '#aabbcc',
    isDefault: false,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
  });
  testLibraryId = lib.id;
});

describe('Audit Log Repository', () => {

  describe('logAction', () => {

    it('creates a log entry with correct fields', async () => {
      const entityId = generateUUID();
      await logAction({
        libraryId: testLibraryId,
        action: 'CREATE',
        entityType: 'saved_tab',
        entityId,
      });
      const entries = await getAuditLog(testLibraryId);
      expect(entries).toHaveLength(1);
      const e = entries[0];
      expect(e.libraryId).toBe(testLibraryId);
      expect(e.action).toBe('CREATE');
      expect(e.entityType).toBe('saved_tab');
      expect(e.entityId).toBe(entityId);
      expect(e.actor).toBe('extension');
      expect(e.diffJson).toBeNull();
      expect(e.syncedAt).toBeNull();
      expect(typeof e.timestamp).toBe('number');
      expect(typeof e.id).toBe('string');
    });

    it('stores diffJson when provided', async () => {
      const entityId = generateUUID();
      const diff = JSON.stringify({ before: { notes: 'old' }, after: { notes: 'new' } });
      await logAction({
        libraryId: testLibraryId,
        action: 'UPDATE',
        entityType: 'saved_tab',
        entityId,
        diffJson: diff,
      });
      const [entry] = await getAuditLog(testLibraryId);
      expect(entry.diffJson).toBe(diff);
    });

    it('uses custom actor when provided', async () => {
      await logAction({
        libraryId: testLibraryId,
        action: 'CREATE',
        entityType: 'bookmark',
        entityId: generateUUID(),
        actor: 'import',
      });
      const [entry] = await getAuditLog(testLibraryId);
      expect(entry.actor).toBe('import');
    });

    it('logs multiple actions for same entity', async () => {
      const entityId = generateUUID();
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'download', entityId });
      await logAction({ libraryId: testLibraryId, action: 'UPDATE', entityType: 'download', entityId });
      await logAction({ libraryId: testLibraryId, action: 'DELETE', entityType: 'download', entityId });
      const all = await getAuditLogByEntity(entityId);
      expect(all).toHaveLength(3);
      const actions = all.map((e) => e.action);
      expect(actions).toContain('CREATE');
      expect(actions).toContain('UPDATE');
      expect(actions).toContain('DELETE');
    });

  });

  describe('getAuditLog', () => {

    it('returns entries sorted newest-first', async () => {
      for (let i = 0; i < 3; i++) {
        await logAction({
          libraryId: testLibraryId,
          action: 'CREATE',
          entityType: 'session',
          entityId: generateUUID(),
        });
      }
      const entries = await getAuditLog(testLibraryId);
      expect(entries.length).toBe(3);
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(entries[1].timestamp);
      expect(entries[1].timestamp).toBeGreaterThanOrEqual(entries[2].timestamp);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await logAction({
          libraryId: testLibraryId,
          action: 'CREATE',
          entityType: 'tag',
          entityId: generateUUID(),
        });
      }
      const limited = await getAuditLog(testLibraryId, 3);
      expect(limited).toHaveLength(3);
    });

    it('isolates entries to the given library', async () => {
      const otherLib = await createLibrary({
        name: 'Other',
        icon: '🔒',
        color: '#000',
        isDefault: false,
        encryptionEnabled: false,
        encryptionSalt: null,
        encryptionKeyHash: null,
      });
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'session', entityId: generateUUID() });
      await logAction({ libraryId: otherLib.id, action: 'CREATE', entityType: 'session', entityId: generateUUID() });
      const mine = await getAuditLog(testLibraryId);
      expect(mine.every((e) => e.libraryId === testLibraryId)).toBe(true);
      expect(mine).toHaveLength(1);
    });

  });

  describe('getAuditLogByEntity', () => {

    it('returns only entries for the given entity', async () => {
      const eA = generateUUID();
      const eB = generateUUID();
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'saved_tab', entityId: eA });
      await logAction({ libraryId: testLibraryId, action: 'DELETE', entityType: 'saved_tab', entityId: eB });
      const forA = await getAuditLogByEntity(eA);
      expect(forA).toHaveLength(1);
      expect(forA[0].entityId).toBe(eA);
    });

    it('returns empty array for unknown entity', async () => {
      const result = await getAuditLogByEntity(generateUUID());
      expect(result).toEqual([]);
    });

  });

  describe('getAuditLogCount', () => {

    it('counts entries for a library', async () => {
      expect(await getAuditLogCount(testLibraryId)).toBe(0);
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'session', entityId: generateUUID() });
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'session', entityId: generateUUID() });
      expect(await getAuditLogCount(testLibraryId)).toBe(2);
    });

  });

  describe('pruneAuditLog', () => {

    it('deletes entries older than the cutoff and returns deleted count', async () => {
      const now = Date.now();
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'tag', entityId: generateUUID() });
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'tag', entityId: generateUUID() });
      // Prune everything older than now + 1s (prunes all entries)
      const deleted = await pruneAuditLog(testLibraryId, now + 1000);
      expect(deleted).toBe(2);
      expect(await getAuditLogCount(testLibraryId)).toBe(0);
    });

    it('leaves entries newer than cutoff intact', async () => {
      const past = Date.now() - 5000; // 5 seconds ago
      await logAction({ libraryId: testLibraryId, action: 'CREATE', entityType: 'tag', entityId: generateUUID() });
      // Prune only entries older than 5 seconds ago — none qualify
      const deleted = await pruneAuditLog(testLibraryId, past);
      expect(deleted).toBe(0);
      expect(await getAuditLogCount(testLibraryId)).toBe(1);
    });

  });

});
