/**
 * CompanionClient — fire-and-forget HTTP client for the local companion daemon.
 *
 * Responsibilities:
 *  - Bootstrap: fetch auth token from GET /token (no auth required, localhost only)
 *  - Cache token in chrome.storage.local as 'mv_companion_token'
 *  - Push library / session / tab records to companion after IDB writes
 *  - Silent on all errors — companion may not be running; extension works standalone
 *
 * Security note:
 *  GET /token is unauthenticated but companion binds only to 127.0.0.1.
 *  Only processes on the same machine can reach it.
 */

const BASE = 'http://127.0.0.1:47821';
const TOKEN_STORAGE_KEY = 'mv_companion_token';
const BOOTSTRAP_FLAG_KEY = 'mv_companion_bootstrapped';

// ── Repository imports (used by syncAllUnpushedSessions only) ─────────────────
// Lazy imports at the bottom of the module to avoid circular-dep concerns.

// ── Types matching companion REST API ─────────────────────────────────────────

interface PushLibraryPayload {
  id: string;
  name: string;
  isEncrypted: boolean;        // maps from Library.encryptionEnabled
  passwordSalt?: string | null; // maps from Library.encryptionSalt
}

interface PushSessionPayload {
  id: string;
  name: string;
  notes: string;
  tabCount: number;
  sourceBrowser?: string; // auto-injected by pushSession if not set
}

interface PushTabPayload {
  id: string;
  sessionId?: string | null;
  url: string;
  title: string;
  favIconUrl?: string | null;
  notes: string;
  colour?: string | null;
}

interface PushBookmarkPayload {
  id: string;
  parentId?: string | null;
  title: string;
  url?: string | null;
  notes: string;
  isFolder: boolean;
}

interface PushHistoryPayload {
  id: string;
  url: string;
  title: string;
  visitTime: number;
  domain: string;
  isImportant: boolean;
}

interface PushDownloadPayload {
  id: string;
  filename: string;
  url: string;
  mimeType?: string | null;
  fileSize?: number | null;
  downloadedAt: number;
  state: string;
  notes: string;
}

// ── Browser detection ─────────────────────────────────────────────────────────

/**
 * Detect the browser this extension is running in.
 * Order matters — Edge / Opera / Vivaldi all include "Chrome" in their UA,
 * so they must be matched before the generic Chrome check.
 * Note: Brave cannot be distinguished from Chrome via userAgent alone in
 * service-worker context; it appears as 'Chrome'.
 */
export function detectBrowser(): string {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  if (/Edg\//.test(ua))     return 'Edge';
  if (/OPR\//.test(ua))     return 'Opera';
  if (/Vivaldi\//.test(ua)) return 'Vivaldi';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua))  return 'Chrome';
  return '';
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5000; // 5s timeout for all companion requests

/** Wrapper around fetch() with AbortController timeout. */
function timedFetch(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** Retry a function up to `n` times with `delayMs` between attempts. */
async function retry<T>(fn: () => Promise<T>, n: number, delayMs: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { lastErr = e; }
    if (i < n - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  throw lastErr;
}

/** Read token from chrome.storage.local — returns null if not set. */
async function loadCachedToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);
    return (result[TOKEN_STORAGE_KEY] as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Fetch token from companion /token endpoint and cache it. Retries twice on failure. */
async function fetchAndCacheToken(): Promise<string | null> {
  try {
    return await retry(async () => {
      const resp = await timedFetch(`${BASE}/token`, { method: 'GET' });
      if (!resp.ok) throw new Error(`token ${resp.status}`);
      const data = (await resp.json()) as { token?: string };
      if (!data.token) throw new Error('no token in response');
      await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: data.token });
      return data.token;
    }, 2, 1000);
  } catch {
    return null; // companion not running — all retries exhausted
  }
}

/** Get token — try cache first, fall back to fetching from companion. */
async function getToken(): Promise<string | null> {
  const cached = await loadCachedToken();
  if (cached) return cached;
  return fetchAndCacheToken();
}

/** Make an authenticated POST to the companion. Swallows all errors; uses 5s timeout. */
async function post(path: string, token: string, body: unknown): Promise<boolean> {
  try {
    const resp = await timedFetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MindVault-Token': token,
      },
      body: JSON.stringify(body),
    });
    return resp.ok;
  } catch {
    return false; // companion offline or timeout
  }
}

/** Check if a library already exists in companion. Returns true if it does. Uses 5s timeout. */
async function libraryExistsInCompanion(libraryId: string, token: string): Promise<boolean> {
  try {
    const resp = await timedFetch(`${BASE}/libraries/${libraryId}`, {
      headers: { 'X-MindVault-Token': token },
    });
    return resp.status === 200;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Bootstrap the companion client.
 * - Fetches and caches the auth token
 * - Ensures the given library exists in companion SQLite (creates if missing)
 * Call once on extension startup from background service worker.
 */
export async function bootstrapCompanion(library: PushLibraryPayload): Promise<void> {
  try {
    const token = await fetchAndCacheToken(); // always re-fetch on startup
    if (!token) return; // companion not running

    const exists = await libraryExistsInCompanion(library.id, token);
    if (!exists) {
      await post('/libraries', token, library);
    }
    // Mark bootstrapped so we don't re-check every popup open
    await chrome.storage.local.set({ [BOOTSTRAP_FLAG_KEY]: true });
  } catch {
    // Silent — standalone mode
  }
}

/**
 * Push a session to the companion after it was saved to IndexedDB.
 * Returns true on success, false if companion is offline or push failed.
 * Existing callers that use `void pushSession(...)` are unaffected by the boolean return.
 */
export async function pushSession(libraryId: string, payload: PushSessionPayload): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false; // companion not running
    // Auto-inject sourceBrowser so companion can auto-rename "Default Library"
    const enriched: PushSessionPayload = {
      ...payload,
      sourceBrowser: payload.sourceBrowser ?? detectBrowser(),
    };
    return await post(`/libraries/${libraryId}/sessions`, token, enriched);
  } catch {
    return false; // Silent — companion optional
  }
}

/**
 * Push a batch of tabs to the companion after they were saved to IndexedDB.
 * Fire-and-forget — caller does not need to await.
 */
export async function pushTabs(libraryId: string, tabs: PushTabPayload[]): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await Promise.allSettled(
      tabs.map((tab) => post(`/libraries/${libraryId}/tabs`, token, tab))
    );
  } catch {
    // Silent
  }
}

/**
 * Push a single bookmark to the companion (fire-and-forget).
 * Only call for live captures — not bulk import.
 */
export async function pushBookmark(libraryId: string, payload: PushBookmarkPayload): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await post(`/libraries/${libraryId}/bookmarks`, token, payload);
  } catch {
    // Silent
  }
}

/**
 * Push a single history entry to the companion (fire-and-forget).
 * Only call for live captures — not bulk import.
 */
export async function pushHistoryEntry(libraryId: string, payload: PushHistoryPayload): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await post(`/libraries/${libraryId}/history`, token, payload);
  } catch {
    // Silent
  }
}

/**
 * Push a single download record to the companion (fire-and-forget).
 * Only call for live captures — not bulk import.
 */
export async function pushDownload(libraryId: string, payload: PushDownloadPayload): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await post(`/libraries/${libraryId}/downloads`, token, payload);
  } catch {
    // Silent
  }
}

/**
 * Sync all unsynced IndexedDB sessions to companion SQLite.
 *
 * Called automatically by bootstrapCompanion() on every daemon reconnect.
 * Scans every library → every session where syncedToCompanion !== true →
 * pushes session + tabs → marks session synced on success.
 *
 * Companion uses INSERT OR IGNORE so re-pushing existing rows is a safe no-op.
 * Silent on all errors — companion is optional.
 */
export async function syncAllUnpushedSessions(): Promise<void> {
  // Dynamic imports avoid circular-dep issues at module load time
  const { getAllLibraries } = await import('../db/repositories/libraries');
  const { getSessionsByLibrary, markSessionSynced } = await import('../db/repositories/sessions');
  const { getTabsBySession } = await import('../db/repositories/saved-tabs');

  try {
    const token = await getToken();
    if (!token) return; // companion offline — nothing to sync

    const libraries = await getAllLibraries();
    for (const lib of libraries) {
      // Ensure the library exists in companion SQLite before pushing its sessions.
      // This fixes custom libraries that were never bootstrapped (bootstrapCompanion
      // only runs for the default library on SW startup).
      const exists = await libraryExistsInCompanion(lib.id, token);
      if (!exists) {
        const created = await post('/libraries', token, {
          id: lib.id,
          name: lib.name,
          isEncrypted: (lib as any).encryptionEnabled ?? false,
          passwordSalt: (lib as any).encryptionSalt ?? null,
        });
        if (!created) {
          console.warn(`[MindVault] syncAllUnpushed: failed to create library ${lib.id} in companion`);
          continue;
        }
      }

      const sessions = await getSessionsByLibrary(lib.id);
      // Filter to only sessions not yet pushed to companion SQLite
      const unsynced = sessions.filter(s => !s.syncedToCompanion);
      for (const session of unsynced) {
        // Push the session record first (INSERT OR IGNORE on companion side)
        const sessionOk = await pushSession(lib.id, {
          id: session.id,
          name: session.name,
          notes: session.notes ?? '',
          tabCount: session.tabCount,
          sourceBrowser: session.sourceBrowser,
        });
        if (!sessionOk) continue; // skip tab push if session failed

        // Push all tabs belonging to this session
        const tabs = await getTabsBySession(session.id);
        if (tabs.length > 0) {
          await pushTabs(lib.id, tabs.map(t => ({
            id: t.id,
            sessionId: t.sessionId ?? null,
            url: t.url,
            title: t.title,
            favIconUrl: t.favIconUrl ?? null,
            notes: t.notes ?? '',
            colour: t.colour ?? null,
          })));
        }

        // Mark synced so this session is skipped on next reconnect
        await markSessionSynced(session.id);
      }
    }
  } catch (e) {
    console.warn('[MindVault] syncAllUnpushedSessions error:', e);
  }
}

/**
 * Force-push ALL sessions from every IDB library to companion SQLite,
 * regardless of their syncedToCompanion flag. Also ensures every library
 * exists in companion first (custom libraries included).
 *
 * Used by the dashboard [Machine Sync] button and by the SW sync-pending poller.
 * Companion uses INSERT OR IGNORE — re-pushing existing rows is a safe no-op.
 * Returns the count of sessions successfully pushed.
 */
export async function forceAllSync(): Promise<number> {
  const { getAllLibraries } = await import('../db/repositories/libraries');
  const { getSessionsByLibrary, markSessionSynced } = await import('../db/repositories/sessions');
  const { getTabsBySession } = await import('../db/repositories/saved-tabs');

  let pushed = 0;
  try {
    const token = await getToken();
    if (!token) return 0; // companion offline

    const libraries = await getAllLibraries();
    for (const lib of libraries) {
      // Ensure the library exists in companion before pushing sessions
      const exists = await libraryExistsInCompanion(lib.id, token);
      if (!exists) {
        const created = await post('/libraries', token, {
          id: lib.id,
          name: lib.name,
          isEncrypted: (lib as any).encryptionEnabled ?? false,
          passwordSalt: (lib as any).encryptionSalt ?? null,
        });
        if (!created) {
          console.warn(`[MindVault] forceAllSync: failed to create library ${lib.id} in companion`);
          continue;
        }
      }

      const sessions = await getSessionsByLibrary(lib.id);
      // Push ALL sessions — no syncedToCompanion filter (force mode)
      for (const session of sessions) {
        const sessionOk = await pushSession(lib.id, {
          id: session.id,
          name: session.name,
          notes: session.notes ?? '',
          tabCount: session.tabCount,
          sourceBrowser: session.sourceBrowser,
        });
        if (!sessionOk) continue;

        const tabs = await getTabsBySession(session.id);
        if (tabs.length > 0) {
          await pushTabs(lib.id, tabs.map(t => ({
            id: t.id,
            sessionId: t.sessionId ?? null,
            url: t.url,
            title: t.title,
            favIconUrl: t.favIconUrl ?? null,
            notes: t.notes ?? '',
            colour: t.colour ?? null,
          })));
        }

        await markSessionSynced(session.id);
        pushed++;
      }
    }
  } catch (e) {
    console.warn('[MindVault] forceAllSync error:', e);
  }
  return pushed;
}

/**
 * Poll GET /sync/pending — returns true if companion has a pending Machine Sync request.
 * Used by the background SW polling interval (every 30 s).
 * Returns false silently on network error (companion offline).
 */
export async function checkSyncPending(): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;
    const resp = await timedFetch(`${BASE}/sync/pending`, {
      headers: { 'X-MindVault-Token': token },
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { pending?: boolean };
    return data.pending === true;
  } catch {
    return false;
  }
}

/**
 * Notify companion that the extension has completed a Machine Sync (POST /sync/done).
 * This clears the pending flag so the companion UI polling loop can refresh All Tabs.
 * Fire-and-forget — silent on errors.
 */
export async function notifySyncDone(): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await post('/sync/done', token, {});
  } catch {
    // Silent
  }
}

/**
 * Clear the cached token (call after companion is reinstalled / token changes).
 */
export async function clearCompanionToken(): Promise<void> {
  try {
    await chrome.storage.local.remove([TOKEN_STORAGE_KEY, BOOTSTRAP_FLAG_KEY]);
  } catch {
    // Silent
  }
}
