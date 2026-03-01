// ============================================================
// MindVault — Audit Log Repository
// Append-only log of all entity mutations within a library.
// ============================================================

import type { AuditLogEntry, AuditAction, AuditActor, AuditEntityType } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';

// ---- Write -------------------------------------------------

export interface LogActionParams {
  libraryId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actor?: AuditActor;
  diffJson?: string | null;
}

/**
 * Append a new audit log entry.
 * Fire-and-forget friendly: errors are swallowed so audit logging
 * never blocks or breaks normal operation.
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const db = await openDB();
    const entry: AuditLogEntry = {
      id: generateUUID(),
      libraryId: params.libraryId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      actor: params.actor ?? 'extension',
      timestamp: Date.now(),
      diffJson: params.diffJson ?? null,
      syncedAt: null,
    };
    const tx = db.transaction(STORE.AUDIT_LOG, 'readwrite');
    await promisifyRequest<IDBValidKey>(tx.objectStore(STORE.AUDIT_LOG).add(entry));
  } catch (err) {
    console.warn('MindVault: audit log write failed (non-fatal)', err);
  }
}

// ---- Read --------------------------------------------------

/**
 * Fetch the most recent audit log entries for a library.
 * Results are sorted newest-first.
 */
export async function getAuditLog(
  libraryId: string,
  limit = 500
): Promise<AuditLogEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.AUDIT_LOG, 'readonly');
  const index = tx.objectStore(STORE.AUDIT_LOG).index('libraryId');
  const all = await promisifyRequest<AuditLogEntry[]>(
    index.getAll(IDBKeyRange.only(libraryId))
  );
  return all
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Fetch all audit log entries for a specific entity (e.g. one saved tab).
 * Results are sorted newest-first.
 */
export async function getAuditLogByEntity(entityId: string): Promise<AuditLogEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.AUDIT_LOG, 'readonly');
  const all = await promisifyRequest<AuditLogEntry[]>(
    tx.objectStore(STORE.AUDIT_LOG).getAll()
  );
  return all
    .filter((e) => e.entityId === entityId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Count audit log entries for a library.
 */
export async function getAuditLogCount(libraryId: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE.AUDIT_LOG, 'readonly');
  const index = tx.objectStore(STORE.AUDIT_LOG).index('libraryId');
  return promisifyRequest<number>(index.count(IDBKeyRange.only(libraryId)));
}

/**
 * Delete all audit log entries older than the given timestamp for a library.
 * Used to control storage growth.
 */
export async function pruneAuditLog(
  libraryId: string,
  olderThanMs: number
): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE.AUDIT_LOG, 'readwrite');
  const index = tx.objectStore(STORE.AUDIT_LOG).index('libraryId');
  const all = await promisifyRequest<AuditLogEntry[]>(
    index.getAll(IDBKeyRange.only(libraryId))
  );
  const toDelete = all.filter((e) => e.timestamp < olderThanMs);
  const store2 = tx.objectStore(STORE.AUDIT_LOG);
  for (const entry of toDelete) {
    await promisifyRequest(store2.delete(entry.id));
  }
  return toDelete.length;
}