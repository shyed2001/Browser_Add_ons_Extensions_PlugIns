// ============================================================
// MindVault — Popup Script (TypeScript)
// v4.1: library dropdown with last-used memory.
// ============================================================
import '../polyfill'; // webextension-polyfill — must be first import
import browser from 'webextension-polyfill'; // use browser.* for cross-browser compat

import { openDB } from '../db/index';
import { migrateV1ToV2 } from '../db/migrations/v1-to-v2';
import { getDefaultLibrary, getAllLibraries, getLibraryById } from '../db/repositories/libraries';
import { createSession } from '../db/repositories/sessions';
import { saveTabWithDedup } from '../db/repositories/saved-tabs';
import { MIGRATION_FLAG_KEY, type MigrationRecord } from '@mindvault/shared';
import { pushSession, pushTabs } from '../services/companion-client';

const LAST_LIBRARY_KEY = 'mv_last_library_id';
const COMPANION_URL   = 'http://127.0.0.1:47821';

// ---- DOM refs ----------------------------------------------
const tabListEl       = document.getElementById('tabList')        as HTMLUListElement;
const tabTextareaEl   = document.getElementById('tabListText')    as HTMLTextAreaElement;
const copyBtn         = document.getElementById('copyButton')     as HTMLButtonElement;
const copyStatus      = document.getElementById('copyStatus')     as HTMLDivElement;
const saveBtn         = document.getElementById('saveAllBtn')     as HTMLButtonElement;
const statusMsg       = document.getElementById('statusMsg')      as HTMLDivElement;
const errorMsg        = document.getElementById('errorMsg')       as HTMLDivElement;
const dashBtn         = document.getElementById('openDashboard')  as HTMLButtonElement;
const storageLink     = document.getElementById('viewStoragePlace') as HTMLAnchorElement;
const sessionNameInput = document.getElementById('sessionName')   as HTMLInputElement;
const librarySelect   = document.getElementById('librarySelect')  as HTMLSelectElement;
const migrationBanner = document.getElementById('migrationBanner') as HTMLDivElement;
const migrationMsgEl  = document.getElementById('migrationMsg')   as HTMLSpanElement;
const migrationDismiss = document.getElementById('migrationDismiss') as HTMLButtonElement;
const companionDot    = document.getElementById('companionStatus') as HTMLSpanElement;

// ---- Init --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  void init();
});

async function init(): Promise<void> {
  // Ensure DB is open and migrations have run
  try {
    await openDB();
  } catch (err) {
    showError(`DB init failed: ${String(err)}`);
  }

  // Check companion daemon status (non-blocking)
  void checkCompanionStatus();

  // Check if this is first launch after migration and show banner
  void checkMigrationBanner();

  // Populate library dropdown (new v4.1)
  void populateLibraryDropdown();

  // Load current tabs
  void loadCurrentTabs();

  // Wire up events
  copyBtn.addEventListener('click', () => void handleCopy());
  saveBtn.addEventListener('click', () => void handleSave());
  dashBtn.addEventListener('click', () => { void browser.runtime.openOptionsPage(); });
  storageLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert(
      "Your data is stored locally in your browser's IndexedDB storage.\n" +
        'No data is sent to any server.\n\n' +
        'You can export everything as JSON, CSV, or HTML from the Dashboard.'
    );
  });
  migrationDismiss.addEventListener('click', dismissMigrationBanner);
}

// ---- Library dropdown (v4.1) --------------------------------

async function populateLibraryDropdown(): Promise<void> {
  try {
    const [libraries, stored] = await Promise.all([
      getAllLibraries(),
      browser.storage.local.get([LAST_LIBRARY_KEY]),
    ]);

    if (!libraries.length) return; // No libraries yet — keep "Loading…" placeholder

    const lastId = stored[LAST_LIBRARY_KEY] as string | undefined;
    const defaultLib = libraries.find((l) => l.isDefault) ?? libraries[0];

    // Decide which library to pre-select
    const selectId = (lastId && libraries.some((l) => l.id === lastId)) ? lastId : defaultLib.id;

    // Build options (default library first, then rest sorted by name)
    const sorted = [
      ...libraries.filter((l) => l.id === defaultLib.id),
      ...libraries.filter((l) => l.id !== defaultLib.id).sort((a, b) => a.name.localeCompare(b.name)),
    ];

    librarySelect.innerHTML = sorted
      .map((l) => `<option value="${l.id}"${l.id === selectId ? ' selected' : ''}>${escHtml(l.name)}</option>`)
      .join('');
  } catch {
    // Silent — falls back to default library in handleSave
    librarySelect.innerHTML = '<option value="">Default Library</option>';
  }
}

/** Persist the selected library ID so it's remembered next time the popup opens. */
function rememberLibrary(id: string): void {
  void browser.storage.local.set({ [LAST_LIBRARY_KEY]: id });
}

// ---- Load current tabs -------------------------------------

async function loadCurrentTabs(): Promise<void> {
  // lastFocusedWindow is cross-browser safe (currentWindow resolves to the popup's
  // own window in Firefox MV2, returning 0 tabs)
  const tabs = await browser.tabs.query({ lastFocusedWindow: true });
  let fullText = '';

  tabs.forEach((tab) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = tab.url ?? '#';
    a.textContent = tab.title ?? tab.url ?? 'No Title';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    li.appendChild(a);
    tabListEl.appendChild(li);
    fullText += `${tab.title ?? 'No Title'}\n${tab.url ?? ''}\n\n`;
  });

  tabTextareaEl.value = fullText.trim();
}

// ---- Copy to clipboard -------------------------------------

async function handleCopy(): Promise<void> {
  const text = tabTextareaEl.value;
  try {
    // Modern Clipboard API (preferred)
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers / restricted contexts
    tabTextareaEl.select();
    document.execCommand('copy');
    window.getSelection()?.removeAllRanges();
  }
  copyBtn.textContent = 'Copied!';
  copyStatus.style.display = 'block';
  setTimeout(() => {
    copyBtn.textContent = 'Copy to Clipboard';
    copyStatus.style.display = 'none';
  }, 2000);
}

// ---- Save tabs to DB ---------------------------------------

async function handleSave(): Promise<void> {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  hideMessages();

  try {
    const tabs = await browser.tabs.query({ lastFocusedWindow: true });

    // Resolve the selected library — fallback chain: selected → default → throw
    const selectedId = librarySelect.value;
    let library = selectedId ? await getLibraryById(selectedId) : null;
    if (!library) library = await getDefaultLibrary();
    if (!library) throw new Error('No library found. Please open the Dashboard.');

    // Remember this choice for next popup open
    rememberLibrary(library.id);

    // Generate session name
    const rawName = sessionNameInput.value.trim();
    const sessionName =
      rawName.length > 0 ? rawName : `Session — ${new Date().toLocaleString()}`;

    // Create session record
    const session = await createSession({
      libraryId: library.id,
      name: sessionName,
      tabCount: tabs.length,
      windowCount: 1,
      notes: '',
      tags: [],
      isFavorite: false,
    });

    // Save each tab (with URL-based dedup = RGYB) and collect for companion push
    const companionTabs: Array<{ id: string; sessionId: string; url: string;
                                 title: string; favIconUrl: string; notes: string }> = [];
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') ||
          tab.url.startsWith('moz-extension://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') || tab.url.startsWith('opera://') ||
          tab.url.startsWith('brave://') || tab.url.startsWith('vivaldi://')) continue;
      const saved = await saveTabWithDedup(
        session.id,
        library.id,
        tab.url,
        tab.title ?? '(No Title)',
        tab.favIconUrl ?? ''
      );
      companionTabs.push({
        id: saved.id,
        sessionId: session.id,
        url: saved.url,
        title: saved.title,
        favIconUrl: saved.favicon ?? '',
        notes: saved.notes ?? '',
      });
    }

    // Push session + tabs to companion (fire-and-forget — silent if companion offline)
    void pushSession(library.id, {
      id: session.id,
      name: session.name,
      notes: session.notes ?? '',
      tabCount: session.tabCount,
    });
    void pushTabs(library.id, companionTabs);

    // Show success
    statusMsg.style.display = 'block';
    const savedCount = companionTabs.length;
    statusMsg.textContent = `✅ Saved ${savedCount} tab${savedCount !== 1 ? 's' : ''} to "${library.name}"`;
    sessionNameInput.value = ''; // Clear name for next save
    setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
  } catch (err) {
    showError(`Save failed: ${String(err)}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Current Tabs';
  }
}

// ---- Migration banner --------------------------------------

async function checkMigrationBanner(): Promise<void> {
  try {
    const result = await browser.storage.local.get([MIGRATION_FLAG_KEY, 'migration_banner_dismissed']);
    const flag = result[MIGRATION_FLAG_KEY] as MigrationRecord | undefined;
    const dismissed = result['migration_banner_dismissed'] as boolean | undefined;
    if (flag && !dismissed) {
      migrationMsgEl.textContent =
        `${flag.recordCount} tabs migrated from v1.1 to MindVault v2!`;
      migrationBanner.classList.remove('hidden');
    }
  } catch {
    // Silent fail — banner is non-critical
  }
}

function dismissMigrationBanner(): void {
  migrationBanner.classList.add('hidden');
  void browser.storage.local.set({ migration_banner_dismissed: true });
}

// ---- Companion status check --------------------------------

/** Ping companion /health endpoint; update status dot. Non-blocking, fire-and-forget. */
async function checkCompanionStatus(): Promise<void> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000); // 2s timeout — popup is short-lived
    const res = await fetch(`${COMPANION_URL}/health`, { signal: ctrl.signal });
    if (res.ok) {
      companionDot.classList.add('online');
      companionDot.classList.remove('offline');
      companionDot.title = 'Companion: online — tabs sync to local vault';
    } else {
      setCompanionOffline();
    }
  } catch {
    setCompanionOffline();
  }
}

function setCompanionOffline(): void {
  companionDot.classList.add('offline');
  companionDot.classList.remove('online');
  companionDot.title = 'Companion: offline — saving locally only';
}

// ---- Helpers -----------------------------------------------

function showError(message: string): void {
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  setTimeout(() => { errorMsg.style.display = 'none'; }, 5000);
}

function hideMessages(): void {
  statusMsg.style.display = 'none';
  errorMsg.style.display = 'none';
}

/** Minimal HTML escaping for option text */
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Run migration on first launch (idempotent)
void (async () => {
  try {
    const db = await openDB();
    await migrateV1ToV2(db);
  } catch {
    // Silent — migration errors are non-fatal
  }
})();
