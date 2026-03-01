// ============================================================
// MindVault — Sessions Repository
// ============================================================

import type { Session } from '@mindvault/shared';
import { generateUUID } from '@mindvault/shared';
import { openDB, promisifyRequest } from '../index';
import { STORE } from '../schema';
import { logAction } from './audit-log';
import { getSessionKey, encryptString, decryptString } from '../../services/session-key';

/** Decrypt the notes field of a session if a session key is active. */
async function decryptSession(session: Session): Promise<Session> {
  const key = getSessionKey(session.libraryId);
  if (!key) return session;
  return { ...session, notes: await decryptString(session.notes, key) };
}

export async function getSessionsByLibrary(libraryId: string): Promise<Session[]> {
  const db = await openDB();
  const tx = db.transaction(STORE.SESSIONS, 'readonly');
  const index = tx.objectStore(STORE.SESSIONS).index('libraryId');
  const rows = await promisifyRequest<Session[]>(index.getAll(IDBKeyRange.only(libraryId)));
  return Promise.all(rows.map(decryptSession));
}

export async function getSessionById(id: string): Promise<Session | null> {
  const db = await openDB();
  const tx = db.transaction(STORE.SESSIONS, 'readonly');
  const result = await promisifyRequest<Session | undefined>(
    tx.objectStore(STORE.SESSIONS).get(id)
  );
  if (!result) return null;
  return decryptSession(result);
}

export async function createSession(
  partial: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Session> {
  const now = Date.now();
  const key = getSessionKey(partial.libraryId);
  const storedNotes = await encryptString(partial.notes, key);
  const session: Session = {
    ...partial,
    notes: storedNotes,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDB();
  const tx = db.transaction(STORE.SESSIONS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.SESSIONS).put(session));
  void logAction({ libraryId: session.libraryId, action: 'CREATE', entityType: 'session', entityId: session.id });
  // Return decrypted version to caller
  return { ...session, notes: partial.notes };
}

export async function updateSession(session: Session): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.SESSIONS, 'readwrite');
  await promisifyRequest(
    tx.objectStore(STORE.SESSIONS).put({ ...session, updatedAt: Date.now() })
  );
}

/**
 * Marks a session as successfully synced to companion SQLite.
 * Sets syncedToCompanion = true so syncAllUnpushedSessions() skips it on future reconnects.
 * No-op if the session does not exist in IndexedDB.
 * @param id - The session ID to mark as synced
 */
export async function markSessionSynced(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE.SESSIONS, 'readwrite');
  const store = tx.objectStore(STORE.SESSIONS);
  // Read raw (encrypted) record — don't decrypt, just set the flag and re-store as-is
  const session = await promisifyRequest<Session | undefined>(store.get(id));
  if (!session) return; // session not found — nothing to mark
  await promisifyRequest(store.put({ ...session, syncedToCompanion: true }));
}

export async function deleteSession(id: string): Promise<void> {
  const existing = await getSessionById(id);
  const db = await openDB();
  const tx = db.transaction(STORE.SESSIONS, 'readwrite');
  await promisifyRequest(tx.objectStore(STORE.SESSIONS).delete(id));
  if (existing) {
    void logAction({ libraryId: existing.libraryId, action: 'DELETE', entityType: 'session', entityId: id });
  }
}
