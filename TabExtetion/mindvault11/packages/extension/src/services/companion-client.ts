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

/** Read token from chrome.storage.local — returns null if not set. */
async function loadCachedToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);
    return (result[TOKEN_STORAGE_KEY] as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Fetch token from companion /token endpoint and cache it. */
async function fetchAndCacheToken(): Promise<string | null> {
  try {
    const resp = await fetch(`${BASE}/token`, { method: 'GET' });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { token?: string };
    if (!data.token) return null;
    await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: data.token });
    return data.token;
  } catch {
    return null; // companion not running
  }
}

/** Get token — try cache first, fall back to fetching from companion. */
async function getToken(): Promise<string | null> {
  const cached = await loadCachedToken();
  if (cached) return cached;
  return fetchAndCacheToken();
}

/** Make an authenticated POST to the companion. Swallows all errors. */
async function post(path: string, token: string, body: unknown): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MindVault-Token': token,
      },
      body: JSON.stringify(body),
    });
    return resp.ok;
  } catch {
    return false; // companion offline
  }
}

/** Check if a library already exists in companion. Returns true if it does. */
async function libraryExistsInCompanion(libraryId: string, token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE}/libraries/${libraryId}`, {
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
  } catch {
    // Silent — companion is optional
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
