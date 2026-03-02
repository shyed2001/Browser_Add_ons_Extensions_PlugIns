// ============================================================
// MindVault — Dashboard Script (TypeScript)
// Full v1.1 feature parity + sessions view + bookmarks stub.
// ============================================================
import '../polyfill'; // webextension-polyfill — must be first import

import { openDB } from '../db/index';
import { getDefaultLibrary, getAllLibraries, createLibrary, updateLibrary } from '../db/repositories/libraries';
import { generateSalt, deriveKey, generateKeyVerificationHash, verifyPassword } from '@mindvault/shared';
import { getSessionsByLibrary, updateSession, deleteSession } from '../db/repositories/sessions';
import { getTabsByLibrary, updateTabNotes, deleteTab, getTabsBySession } from '../db/repositories/saved-tabs';
import { getRepeatIndicatorsHtml } from '@mindvault/shared';
import { formatDisplayDate } from '@mindvault/shared';
import type { SavedTab, Session, Library } from '@mindvault/shared';
import { exportCSV, exportJSON, exportHTML, exportText } from '../services/export';
import { parseJsonBackup, importFromJson } from '../services/import';
import {
  getBookmarksByLibrary,
  createBookmark,
  deleteBookmark,
  updateBookmark,
} from '../db/repositories/bookmarks';
import type { Bookmark, HistoryEntry, Download } from '@mindvault/shared';
import { getTagsByLibrary } from '../db/repositories/tags';
import {
  getHistoryByLibrary,
  markHistoryStarred,
  markHistoryImportant,
  deleteHistoryEntry,
} from '../db/repositories/history';
import {
  getDownloadsByLibrary,
  deleteDownload,
} from '../db/repositories/downloads';
import { setSessionKey, clearSessionKey, getSessionKey } from '../services/session-key';
import { exportMvault, importMvault } from '../services/mvault';

// ---- State -------------------------------------------------
let currentLibrary: Library | null = null;
let allLibraries: Library[] = [];
let allTabs: SavedTab[] = [];
let filteredTabs: SavedTab[] = [];
let allSessions: Session[] = [];
let sessionSortCol: 'name' | 'createdAt' | 'tabCount' = 'createdAt';
let sessionSortDir: 'asc' | 'desc' = 'desc';
let showArchivedSessions = false;
let ctxSession: Session | null = null;
let allBookmarks: Bookmark[] = [];
let allHistory: HistoryEntry[] = [];
let filteredHistory: HistoryEntry[] = [];
let historyFilter = 'all';
let allDownloads: Download[] = [];
let filteredDownloads: Download[] = [];
let downloadsFilter = 'all';

// ---- DOM refs ----------------------------------------------
const librarySelectEl = document.getElementById('librarySelect') as HTMLSelectElement;
const tableBody = document.getElementById('tableBody') as HTMLTableSectionElement;
const tabsEmptyEl = document.getElementById('tabsEmpty') as HTMLDivElement;
const tabSearchEl = document.getElementById('tabSearch') as HTMLInputElement;
const sessionsContainerEl = document.getElementById('sessionsContainer') as HTMLDivElement;
const sessionSearchEl = document.getElementById('sessionSearch') as HTMLInputElement;
const sCtxMenuEl = document.getElementById('sCtxMenu') as HTMLDivElement;
const bookmarksContainerEl = document.getElementById('bookmarksContainer') as HTMLDivElement;
const bookmarkSearchEl = document.getElementById('bookmarkSearch') as HTMLInputElement;
const historyTableBody = document.getElementById('historyTableBody') as HTMLTableSectionElement;
const historyEmptyEl = document.getElementById('historyEmpty') as HTMLDivElement;
const historyCountEl = document.getElementById('historyCount') as HTMLDivElement;
const historySearchEl = document.getElementById('historySearch') as HTMLInputElement;
const downloadsTableBody = document.getElementById('downloadsTableBody') as HTMLTableSectionElement;
const downloadsEmptyEl = document.getElementById('downloadsEmpty') as HTMLDivElement;
const downloadsCountEl = document.getElementById('downloadsCount') as HTMLDivElement;
const downloadsSearchEl = document.getElementById('downloadsSearch') as HTMLInputElement;

// ---- Init --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  void init();
});

async function init(): Promise<void> {
  await openDB();

  // Load all libraries and select the default
  allLibraries = await getAllLibraries();
  currentLibrary = await getDefaultLibrary();
  renderLibrarySelect();

  // Load data
  await loadAllData();

  // Wire library switcher
  librarySelectEl.addEventListener('change', () => void handleLibrarySwitch());
  document.getElementById('newLibraryBtn')?.addEventListener('click', () => void handleNewLibrary());

  // Wire nav tabs
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset['view'] ?? 'sessions'));
  });

  // Wire search
  tabSearchEl.addEventListener('input', () => filterTabs(tabSearchEl.value));
  sessionSearchEl.addEventListener('input', () => filterSessions(sessionSearchEl.value));
  bookmarkSearchEl.addEventListener('input', () => filterBookmarks(bookmarkSearchEl.value));

  // Wire history search and date filters
  historySearchEl.addEventListener('input', () => applyHistoryFilter());
  document.querySelectorAll<HTMLButtonElement>('[data-history-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      historyFilter = btn.dataset['historyFilter'] ?? 'all';
      document.querySelectorAll<HTMLButtonElement>('[data-history-filter]').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      applyHistoryFilter();
    });
  });

  // Wire downloads search and state filters
  downloadsSearchEl.addEventListener('input', () => applyDownloadsFilter());
  document.querySelectorAll<HTMLButtonElement>('[data-dl-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      downloadsFilter = btn.dataset['dlFilter'] ?? 'all';
      document.querySelectorAll<HTMLButtonElement>('[data-dl-filter]').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      applyDownloadsFilter();
    });
  });

  // Wire bookmarks add button
  document.getElementById('addBookmark')?.addEventListener('click', () => void handleAddBookmark());

  // Wire sessions toolbar (show-archived toggle)
  const showArchivedBtnEl = document.getElementById('showArchivedBtn') as HTMLButtonElement | null;
  showArchivedBtnEl?.addEventListener('click', () => {
    showArchivedSessions = !showArchivedSessions;
    showArchivedBtnEl.classList.toggle('active', showArchivedSessions);
    showArchivedBtnEl.textContent = showArchivedSessions ? '☑ Archived' : '☐ Archived';
    renderSessionsView();
  });

  // Wire session context menu item clicks
  sCtxMenuEl?.querySelectorAll<HTMLButtonElement>('.s-ctx-item').forEach((btn) => {
    btn.addEventListener('click', () => void handleSessionAction(btn.dataset['action'] ?? ''));
  });

  // Dismiss context menu on outside click or Escape
  document.addEventListener('click', (e) => {
    if (sCtxMenuEl && !sCtxMenuEl.contains(e.target as Node)) hideSessionContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSessionContextMenu();
  });

  // Wire export buttons (All Tabs view)
  document.getElementById('copyAll')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(filteredTabs, null, 2))
      .then(() => alert('All data copied to clipboard as JSON.'));
  });
  document.getElementById('exportCsv')?.addEventListener('click', () => exportCSV(filteredTabs));
  document.getElementById('exportJson')?.addEventListener('click', () => exportJSON(filteredTabs));
  document.getElementById('exportHtml')?.addEventListener('click', () => exportHTML(filteredTabs));
  document.getElementById('exportText')?.addEventListener('click', () => exportText(filteredTabs));

  // Wire session export buttons
  document.getElementById('exportSessionsJson')?.addEventListener('click', () =>
    exportJSON(allSessions)
  );
  document.getElementById('exportSessionsCsv')?.addEventListener('click', () => {
    // Export sessions as CSV
    const csvRows = [
      'Session Name,Tab Count,Created,Notes',
      ...allSessions.map((s) =>
        [
          `"${s.name.replace(/"/g, '""')}"`,
          s.tabCount,
          `"${formatDisplayDate(s.createdAt)}"`,
          `"${s.notes.replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    downloadFile(
      'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n')),
      'sessions.csv'
    );
  });
  document.getElementById('exportSessionsHtml')?.addEventListener('click', () =>
    exportHTML(allSessions)
  );

  // Wire settings
  document.getElementById('clearLegacyData')?.addEventListener('click', () =>
    void handleClearLegacyData()
  );
  document.getElementById('exportFullBackup')?.addEventListener('click', () =>
    void handleFullBackup()
  );
  document.getElementById('importFile')?.addEventListener('change', (e) =>
    void handleImport(e as Event & { target: HTMLInputElement })
  );
  document.getElementById('exportMvaultBtn')?.addEventListener('click', () =>
    void handleExportMvault()
  );
  document.getElementById('importMvaultFile')?.addEventListener('change', (e) =>
    void handleImportMvault(e as Event & { target: HTMLInputElement })
  );

  updateLegacyDataStatus();
  renderEncryptionStatus();
  wireTableResize();
}

// ---- Column drag-resize ------------------------------------

/**
 * wireTableResize — attaches pointer-event drag resize to .th-resize-handle elements
 * in the All Tabs table header. Stores column widths in localStorage('mv-ext-col-widths')
 * and applies them via th.style.width so the fixed-layout table respects them.
 */
function wireTableResize(): void {
  const stored: Record<string, string> = (() => {
    try { const r = localStorage.getItem('mv-ext-col-widths'); if (r) return JSON.parse(r) as Record<string, string>; } catch { /* ignore */ }
    return {};
  })();

  // Restore persisted widths
  const table = document.getElementById('dbTable');
  if (table) {
    Object.entries(stored).forEach(([col, w]) => {
      const th = table.querySelector<HTMLElement>(`th.${col}`);
      if (th) th.style.width = w;
    });
  }

  document.querySelectorAll<HTMLElement>('.th-resize-handle').forEach(handle => {
    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault(); e.stopPropagation();
      handle.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      const th     = handle.parentElement as HTMLElement;
      const col    = handle.dataset.col ?? '';
      const startX = e.clientX;
      const startW = th.getBoundingClientRect().width;

      const onMove = (ev: PointerEvent): void => {
        const w = Math.max(40, startW + ev.clientX - startX);
        th.style.width = w + 'px';
        stored[col]    = w + 'px';
      };
      const onUp = (): void => {
        handle.classList.remove('resizing');
        handle.releasePointerCapture(e.pointerId);
        localStorage.setItem('mv-ext-col-widths', JSON.stringify(stored));
        handle.removeEventListener('pointermove', onMove as EventListener);
        handle.removeEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointermove', onMove as EventListener);
      handle.addEventListener('pointerup', onUp);
    });
  });
}

// ---- Data loading ------------------------------------------

async function loadAllData(): Promise<void> {
  if (!currentLibrary) return;

  allTabs = await getTabsByLibrary(currentLibrary.id);
  filteredTabs = [...allTabs];

  allSessions = await getSessionsByLibrary(currentLibrary.id);
  allBookmarks = await getBookmarksByLibrary(currentLibrary.id);
  allHistory = await getHistoryByLibrary(currentLibrary.id, 1000);
  filteredHistory = [...allHistory];
  allDownloads = await getDownloadsByLibrary(currentLibrary.id, 500);
  filteredDownloads = [...allDownloads];

  renderSessionsView();
  renderTabsTable(filteredTabs);
  renderBookmarksView();
  renderHistoryView();
  renderDownloadsView();
  renderEncryptionStatus();
}

// ---- View switching ----------------------------------------

function switchView(viewName: string): void {
  document.querySelectorAll<HTMLDivElement>('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach((t) => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  targetView?.classList.add('active');

  const targetTab = document.querySelector<HTMLButtonElement>(`[data-view="${viewName}"]`);
  targetTab?.classList.add('active');
  targetTab?.setAttribute('aria-selected', 'true');
}

// ---- Library switcher --------------------------------------

function renderLibrarySelect(): void {
  librarySelectEl.innerHTML = allLibraries
    .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.name.localeCompare(b.name))
    .map((lib) => `<option value="${escHtml(lib.id)}"${lib.id === currentLibrary?.id ? ' selected' : ''}>${escHtml(lib.icon)} ${escHtml(lib.name)}</option>`)
    .join('');
  if (allLibraries.length === 0) {
    librarySelectEl.innerHTML = '<option value="">No libraries</option>';
  }
}

async function handleLibrarySwitch(): Promise<void> {
  const selectedId = librarySelectEl.value;
  if (!selectedId || selectedId === currentLibrary?.id) return;
  const lib = allLibraries.find((l) => l.id === selectedId);
  if (!lib) return;
  currentLibrary = lib;
  await loadAllData();
}

async function handleNewLibrary(): Promise<void> {
  const name = prompt('New library name:');
  if (!name?.trim()) return;
  const icon = prompt('Icon (emoji, optional):', '📁') ?? '📁';
  const lib = await createLibrary({
    name: name.trim(),
    icon: icon.trim() || '📁',
    color: '#007bff',
    isDefault: false,
    encryptionEnabled: false,
    encryptionSalt: null,
    encryptionKeyHash: null,
  });
  allLibraries.push(lib);
  currentLibrary = lib;
  renderLibrarySelect();
  await loadAllData();
}

// ---- Sessions view -----------------------------------------

function renderSessionsView(sessions: Session[] = allSessions): void {
  renderSessionsTable(sessions);
}

function renderSessionsTable(sessions: Session[]): void {
  const visible = showArchivedSessions ? sessions : sessions.filter((s) => !s.archived);

  if (visible.length === 0) {
    sessionsContainerEl.innerHTML = showArchivedSessions
      ? '<div class="empty-state">No archived sessions.</div>'
      : '<div class="empty-state">No sessions yet. Save some tabs from the popup!</div>';
    return;
  }

  const sorted = sortSessions(visible, sessionSortCol, sessionSortDir);
  const arrow = (col: string) =>
    sessionSortCol === col ? (sessionSortDir === 'desc' ? ' ▼' : ' ▲') : '';

  let html = `
    <div class="session-table-header">
      <span class="sth-col sortable" data-sort="name">Name${arrow('name')}</span>
      <span class="sth-col sortable" data-sort="createdAt">Date${arrow('createdAt')}</span>
      <span class="sth-col sortable" data-sort="tabCount">Tabs${arrow('tabCount')}</span>
      <span class="sth-col sth-no-sort">Browser</span>
      <span class="sth-col sth-no-sort"></span>
    </div>`;

  for (const s of sorted) {
    const archivedCls = s.archived ? ' archived' : '';
    html += `
    <div class="session-row${archivedCls}" data-session-id="${escHtml(s.id)}">
      <span class="sr-name">
        <span class="sr-name-text" title="${escHtml(s.name)}">${escHtml(s.name)}</span>
        ${s.archived ? '<span class="archived-badge">archived</span>' : ''}
      </span>
      <span class="sr-date">${fmtDate(s.createdAt)}</span>
      <span class="sr-tabs">${s.tabCount}</span>
      <span class="sr-browser">${escHtml(s.sourceBrowser ?? '')}</span>
      <button class="sr-menu-btn" title="Options" data-session-id="${escHtml(s.id)}">⋯</button>
    </div>`;
  }

  sessionsContainerEl.innerHTML = html;

  // Sort header clicks
  sessionsContainerEl.querySelectorAll<HTMLElement>('[data-sort]').forEach((col) => {
    col.addEventListener('click', () => {
      const s = col.dataset['sort'] as 'name' | 'createdAt' | 'tabCount';
      if (sessionSortCol === s) {
        sessionSortDir = sessionSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sessionSortCol = s;
        sessionSortDir = s === 'createdAt' ? 'desc' : 'asc';
      }
      renderSessionsView();
    });
  });

  // Row click → open tabs in All Tabs view
  sessionsContainerEl.querySelectorAll<HTMLElement>('.session-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.sr-menu-btn')) return;
      const sid = row.dataset['sessionId'];
      if (sid) {
        filteredTabs = allTabs.filter((t) => t.sessionId === sid);
        renderTabsTable(filteredTabs);
        switchView('tabs');
      }
    });
  });

  // ⋯ menu button
  sessionsContainerEl.querySelectorAll<HTMLButtonElement>('.sr-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.dataset['sessionId'];
      const session = allSessions.find((s) => s.id === sid);
      if (!session) return;
      const rect = btn.getBoundingClientRect();
      showSessionContextMenu(session, rect.right, rect.bottom);
    });
  });

  // Right-click context menu
  sessionsContainerEl.querySelectorAll<HTMLElement>('.session-row').forEach((row) => {
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const sid = row.dataset['sessionId'];
      const session = allSessions.find((s) => s.id === sid);
      if (!session) return;
      showSessionContextMenu(session, e.clientX, e.clientY);
    });
  });

  // Double-click name → inline rename
  sessionsContainerEl.querySelectorAll<HTMLElement>('.sr-name-text').forEach((el) => {
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const row = el.closest<HTMLElement>('.session-row');
      if (!row) return;
      const sid = row.dataset['sessionId'];
      const session = allSessions.find((s) => s.id === sid);
      if (!session) return;
      doRenameSession(row, session);
    });
  });
}

function sortSessions(
  sessions: Session[],
  col: 'name' | 'createdAt' | 'tabCount',
  dir: 'asc' | 'desc'
): Session[] {
  return [...sessions].sort((a, b) => {
    let cmp = 0;
    if (col === 'name') cmp = a.name.localeCompare(b.name);
    else if (col === 'createdAt') cmp = a.createdAt - b.createdAt;
    else if (col === 'tabCount') cmp = a.tabCount - b.tabCount;
    return dir === 'asc' ? cmp : -cmp;
  });
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return (
      d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function showSessionContextMenu(session: Session, x: number, y: number): void {
  ctxSession = session;
  const archiveBtn = sCtxMenuEl?.querySelector<HTMLElement>('.s-ctx-archive-btn');
  const restoreBtn = sCtxMenuEl?.querySelector<HTMLElement>('.s-ctx-restore-btn');
  if (archiveBtn) archiveBtn.style.display = session.archived ? 'none' : '';
  if (restoreBtn) restoreBtn.style.display = session.archived ? '' : 'none';
  sCtxMenuEl?.classList.remove('hidden');
  const mw = sCtxMenuEl?.offsetWidth ?? 210;
  const mh = sCtxMenuEl?.offsetHeight ?? 200;
  const left = Math.min(x, window.innerWidth - mw - 8);
  const top = Math.min(y, window.innerHeight - mh - 8);
  if (sCtxMenuEl) {
    sCtxMenuEl.style.left = `${left}px`;
    sCtxMenuEl.style.top = `${top}px`;
  }
}

function hideSessionContextMenu(): void {
  sCtxMenuEl?.classList.add('hidden');
  ctxSession = null;
}

async function handleSessionAction(action: string): Promise<void> {
  const session = ctxSession;
  hideSessionContextMenu();
  if (!session) return;

  if (action === 'open') {
    filteredTabs = allTabs.filter((t) => t.sessionId === session.id);
    renderTabsTable(filteredTabs);
    switchView('tabs');
    return;
  }

  if (action === 'rename') {
    const row = sessionsContainerEl.querySelector<HTMLElement>(
      `[data-session-id="${session.id}"]`
    );
    if (row) doRenameSession(row, session);
    return;
  }

  if (action === 'archive' || action === 'restore') {
    const archived = action === 'archive';
    const updated: Session = { ...session, archived };
    await updateSession(updated);
    const idx = allSessions.findIndex((s) => s.id === session.id);
    if (idx !== -1) allSessions[idx] = updated;
    renderSessionsView();
    return;
  }

  if (action === 'delete') {
    if (!confirm(`Remove session "${session.name}" from history?\n(Tabs are kept.)`)) return;
    await deleteSession(session.id);
    allSessions = allSessions.filter((s) => s.id !== session.id);
    renderSessionsView();
    return;
  }

  if (action === 'delete-tabs') {
    if (
      !confirm(
        `Delete session "${session.name}" AND all its tabs?\n\nThis cannot be undone.`
      )
    )
      return;
    const tabs = await getTabsBySession(session.id);
    for (const t of tabs) await deleteTab(t.id);
    await deleteSession(session.id);
    allSessions = allSessions.filter((s) => s.id !== session.id);
    allTabs = allTabs.filter((t) => t.sessionId !== session.id);
    filteredTabs = filteredTabs.filter((t) => t.sessionId !== session.id);
    renderTabsTable(filteredTabs);
    renderSessionsView();
    return;
  }
}

function doRenameSession(rowEl: HTMLElement, session: Session): void {
  const nameSpan = rowEl.querySelector<HTMLElement>('.sr-name-text');
  if (!nameSpan) return;
  const originalName = session.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sr-name-input';
  input.value = originalName;
  rowEl.classList.add('renaming');
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (newName && newName !== originalName) {
      const updated: Session = { ...session, name: newName };
      void updateSession(updated).then(() => {
        const idx = allSessions.findIndex((s) => s.id === session.id);
        if (idx !== -1) allSessions[idx] = updated;
        renderSessionsView();
      });
    } else {
      renderSessionsView();
    }
  };

  const cancel = () => {
    if (committed) return;
    committed = true;
    renderSessionsView();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

function filterSessions(query: string): void {
  const q = query.toLowerCase();
  if (!q) {
    renderSessionsView(allSessions);
    return;
  }
  renderSessionsView(
    allSessions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q)
    )
  );
}

// ---- All Tabs table ----------------------------------------

function renderTabsTable(tabs: SavedTab[]): void {
  if (tabs.length === 0) {
    tableBody.innerHTML = '';
    tabsEmptyEl.style.display = 'block';
    return;
  }

  tabsEmptyEl.style.display = 'none';

  tableBody.innerHTML = tabs
    .map((tab, index) => renderTabRow(tab, index + 1))
    .join('');

  // Wire notes inputs
  tableBody.querySelectorAll<HTMLInputElement>('.notes-input').forEach((input) => {
    input.addEventListener('change', () => {
      void updateTabNotes(input.dataset['id'] ?? '', input.value);
    });
  });

  // Wire delete buttons
  tableBody.querySelectorAll<HTMLButtonElement>('.btn-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['id'] ?? '';
      void deleteTab(id).then(() => {
        allTabs = allTabs.filter((t) => t.id !== id);
        filteredTabs = filteredTabs.filter((t) => t.id !== id);
        renderTabsTable(filteredTabs);
        // Update session counts in sessions view
        renderSessionsView();
      });
    });
  });
}

function renderTabRow(tab: SavedTab, index: number): string {
  const repeatHtml = getRepeatIndicatorsHtml(tab.repeatCount);
  const lastSaved = formatDisplayDate(tab.lastSeenAt);
  const urlTrunc = tab.url.length > 60 ? tab.url.substring(0, 60) + '…' : tab.url;

  return `
    <tr>
      <td class="col-num">${index}</td>
      <td class="col-title">
        <span class="repeat-icons">${repeatHtml}</span>
        ${escHtml(tab.title)}
      </td>
      <td class="col-url">
        <span class="url-cell" title="${escHtml(tab.url)}">${escHtml(urlTrunc)}</span>
      </td>
      <td class="col-date">${lastSaved}</td>
      <td class="col-repeat" style="text-align:center;">${tab.repeatCount}</td>
      <td class="col-notes">
        <input
          type="text"
          class="notes-input"
          value="${escHtml(tab.notes)}"
          data-id="${escHtml(tab.id)}"
          placeholder="Add note…"
        >
      </td>
      <td class="col-actions">
        <button
          class="btn-open"
          onclick="window.open('${escHtml(tab.url)}','_blank','noopener')"
        >Open</button>
        <button class="btn-del" data-id="${escHtml(tab.id)}">Del</button>
      </td>
    </tr>
  `;
}

function filterTabs(query: string): void {
  const q = query.toLowerCase();
  if (!q) {
    filteredTabs = [...allTabs];
  } else {
    filteredTabs = allTabs.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.url.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
    );
  }
  renderTabsTable(filteredTabs);
}

// ---- Encryption UI -----------------------------------------

function renderEncryptionStatus(): void {
  const container = document.getElementById('encryptionStatus');
  if (!container || !currentLibrary) return;

  const lib = currentLibrary;
  const isEnabled = lib.encryptionEnabled;
  const isUnlocked = getSessionKey(lib.id) !== null;

  if (!isEnabled) {
    container.innerHTML = `
      <div>
        <div class="settings-label">Library Encryption</div>
        <div class="settings-desc">
          <span class="enc-badge off">🔓 Not Encrypted</span>
          — data stored in plain text
        </div>
      </div>
      <button id="enableEncryptionBtn" class="btn-secondary-sm">Enable Encryption</button>
    `;
    document.getElementById('enableEncryptionBtn')?.addEventListener('click', () =>
      void handleEnableEncryption()
    );
  } else if (!isUnlocked) {
    container.innerHTML = `
      <div>
        <div class="settings-label">Library Encryption</div>
        <div class="settings-desc">
          <span class="enc-badge locked">🔒 Locked</span>
          — enter password to access encrypted data
        </div>
      </div>
      <button id="unlockLibraryBtn" class="btn-primary-sm">Unlock Library</button>
    `;
    document.getElementById('unlockLibraryBtn')?.addEventListener('click', () =>
      void handleUnlockLibrary()
    );
  } else {
    container.innerHTML = `
      <div>
        <div class="settings-label">Library Encryption</div>
        <div class="settings-desc">
          <span class="enc-badge unlocked">🔓 Unlocked</span>
          — AES-256-GCM active this session
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button id="lockLibraryBtn" class="btn-secondary-sm">Lock</button>
        <button id="changePasswordBtn" class="btn-secondary-sm">Change Password</button>
      </div>
    `;
    document.getElementById('lockLibraryBtn')?.addEventListener('click', () =>
      handleLockLibrary()
    );
    document.getElementById('changePasswordBtn')?.addEventListener('click', () =>
      void handleChangePassword()
    );
  }
}

async function handleEnableEncryption(): Promise<void> {
  if (!currentLibrary) return;
  const password = prompt('Set a password for this library:\n(Remember it — lost passwords cannot be recovered)');
  if (!password) return;
  const confirm2 = prompt('Confirm password:');
  if (confirm2 !== password) { alert('Passwords do not match.'); return; }

  const salt = generateSalt();
  const hash = await generateKeyVerificationHash(password, salt);
  const key = await deriveKey(password, salt);

  const updated = { ...currentLibrary, encryptionEnabled: true, encryptionSalt: salt, encryptionKeyHash: hash };
  await updateLibrary(updated);
  currentLibrary = updated;
  allLibraries = allLibraries.map((l) => l.id === updated.id ? updated : l);
  setSessionKey(updated.id, key);
  renderEncryptionStatus();
  alert('Encryption enabled! Your session key is active.');
}

async function handleUnlockLibrary(): Promise<void> {
  if (!currentLibrary || !currentLibrary.encryptionSalt || !currentLibrary.encryptionKeyHash) return;
  const password = prompt('Enter library password:');
  if (!password) return;

  const ok = await verifyPassword(password, currentLibrary.encryptionSalt, currentLibrary.encryptionKeyHash);
  if (!ok) { alert('Incorrect password.'); return; }

  const key = await deriveKey(password, currentLibrary.encryptionSalt);
  setSessionKey(currentLibrary.id, key);
  renderEncryptionStatus();
}

function handleLockLibrary(): void {
  if (!currentLibrary) return;
  clearSessionKey(currentLibrary.id);
  renderEncryptionStatus();
}

async function handleChangePassword(): Promise<void> {
  if (!currentLibrary || !currentLibrary.encryptionSalt || !currentLibrary.encryptionKeyHash) return;
  const oldPw = prompt('Current password:');
  if (!oldPw) return;

  const ok = await verifyPassword(oldPw, currentLibrary.encryptionSalt, currentLibrary.encryptionKeyHash);
  if (!ok) { alert('Incorrect current password.'); return; }

  const newPw = prompt('New password:');
  if (!newPw) return;
  const confirm3 = prompt('Confirm new password:');
  if (confirm3 !== newPw) { alert('Passwords do not match.'); return; }

  const salt = generateSalt(); // New salt for new password
  const hash = await generateKeyVerificationHash(newPw, salt);
  const key = await deriveKey(newPw, salt);

  const updated = { ...currentLibrary, encryptionSalt: salt, encryptionKeyHash: hash };
  await updateLibrary(updated);
  currentLibrary = updated;
  allLibraries = allLibraries.map((l) => l.id === updated.id ? updated : l);
  setSessionKey(updated.id, key);
  alert('Password changed successfully.');
}

// ---- Settings actions --------------------------------------

function updateLegacyDataStatus(): void {
  const statusEl = document.getElementById('legacyDataStatus');
  if (!statusEl) return;
  chrome.storage.local.get(['tabDatabase', 'migration_v2_complete'], (result) => {
    const legacy = result['tabDatabase'] as unknown[] | undefined;
    const migrated = result['migration_v2_complete'];
    if (legacy && legacy.length > 0 && migrated) {
      statusEl.textContent = `${legacy.length} records from v1.1 still in browser storage (safe to clear after 30 days)`;
    } else if (!migrated) {
      statusEl.textContent = 'No migration has run yet';
    } else {
      statusEl.textContent = 'Legacy data already cleared ✓';
    }
  });
}

async function handleClearLegacyData(): Promise<void> {
  const confirmed = confirm(
    'This will permanently delete the v1.1 legacy data from browser storage.\n' +
    'Your MindVault v2 data is unaffected.\n\n' +
    'Are you sure?'
  );
  if (!confirmed) return;
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(['tabDatabase', 'migration_v2_complete', 'migration_banner_dismissed'], () => resolve());
  });
  updateLegacyDataStatus();
  alert('Legacy data cleared.');
}

async function handleFullBackup(): Promise<void> {
  if (!currentLibrary) return;
  const tags = await getTagsByLibrary(currentLibrary.id);
  const backup = {
    exportedAt: new Date().toISOString(),
    library: currentLibrary,
    sessions: allSessions,
    tabs: allTabs,
    bookmarks: allBookmarks,
    tags,
  };
  exportJSON(backup, `mindvault-backup-${Date.now()}.json`);
}

async function handleImport(e: Event & { target: HTMLInputElement }): Promise<void> {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const backup = await parseJsonBackup(file);
    const confirmed = confirm(
      `Import "${file.name}"?\n\n` +
      `Library: ${backup.library.name}\n` +
      `Sessions: ${backup.sessions.length}\n` +
      `Tabs: ${backup.tabs.length}\n` +
      `Bookmarks: ${backup.bookmarks?.length ?? 0}\n` +
      `Tags: ${backup.tags?.length ?? 0}`
    );
    if (!confirmed) return;

    const result = await importFromJson(backup);

    if (result.errors.length > 0) {
      console.warn('Import warnings:', result.errors);
    }

    alert(
      `Import complete!\n` +
      `Sessions: ${result.counts.sessions}\n` +
      `Tabs: ${result.counts.tabs}\n` +
      `Bookmarks: ${result.counts.bookmarks}\n` +
      `Tags: ${result.counts.tags}` +
      (result.errors.length > 0 ? `\n\n${result.errors.length} warning(s) — see console.` : '')
    );

    // Reload data
    await loadAllData();
  } catch (err) {
    alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Reset file input so same file can be re-imported
  e.target.value = '';
}

async function handleExportMvault(): Promise<void> {
  if (!currentLibrary) return;
  const password = prompt(
    'Set a password for this encrypted backup.\n' +
    '(Can be different from your library password.)\n\n' +
    'Remember it — this backup cannot be restored without it.'
  );
  if (!password) return;
  const confirm2 = prompt('Confirm backup password:');
  if (confirm2 !== password) { alert('Passwords do not match.'); return; }

  try {
    await exportMvault(currentLibrary.id, password);
  } catch (err) {
    alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleImportMvault(e: Event & { target: HTMLInputElement }): Promise<void> {
  const file = e.target.files?.[0];
  if (!file) return;

  const password = prompt(`Enter the backup password for "${file.name}":`);
  if (!password) return;

  try {
    const result = await importMvault(file, password);
    if (result.errors.length > 0) {
      console.warn('Import warnings:', result.errors);
    }
    alert(
      `Encrypted backup restored!\n` +
      `Sessions: ${result.counts.sessions}\n` +
      `Tabs: ${result.counts.tabs}\n` +
      `Bookmarks: ${result.counts.bookmarks}\n` +
      `Tags: ${result.counts.tags}` +
      (result.errors.length > 0 ? `\n\n${result.errors.length} warning(s) — see console.` : '')
    );
    await loadAllData();
  } catch (err) {
    alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  e.target.value = '';
}

// ---- Bookmarks view ----------------------------------------

function renderBookmarksView(bookmarks: Bookmark[] = allBookmarks): void {
  if (bookmarks.length === 0) {
    bookmarksContainerEl.innerHTML =
      '<div class="empty-state">No bookmarks yet. Add one above!</div>';
    return;
  }

  // Group by folder (parentId). Root items have parentId === null.
  const folders = bookmarks.filter((b) => b.type === 'folder');
  const items = bookmarks.filter((b) => b.type === 'bookmark');

  let html = '';

  // Render folders first, then root bookmarks
  for (const folder of folders.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const children = items.filter((b) => b.parentId === folder.id);
    html += `
      <div class="bookmark-folder">
        <div class="bookmark-folder-header">${escHtml(folder.title)} (${children.length})</div>
        <div class="bookmark-folder-items">
          ${children.map(renderBookmarkItem).join('')}
        </div>
      </div>
    `;
  }

  // Root-level bookmarks (no folder)
  const rootItems = items.filter((b) => b.parentId === null);
  if (rootItems.length > 0) {
    html += rootItems.map(renderBookmarkItem).join('');
  }

  bookmarksContainerEl.innerHTML = html;

  // Wire delete buttons
  bookmarksContainerEl.querySelectorAll<HTMLButtonElement>('.bm-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['id'] ?? '';
      void deleteBookmark(id).then(async () => {
        allBookmarks = allBookmarks.filter((b) => b.id !== id);
        renderBookmarksView();
      });
    });
  });

  // Wire edit buttons
  bookmarksContainerEl.querySelectorAll<HTMLInputElement>('.bm-note').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.dataset['id'] ?? '';
      const bm = allBookmarks.find((b) => b.id === id);
      if (bm) {
        void updateBookmark({ ...bm, description: input.value });
        bm.description = input.value;
      }
    });
  });
}

function renderBookmarkItem(bm: Bookmark): string {
  const urlTrunc = (bm.url ?? '').length > 50 ? (bm.url ?? '').substring(0, 50) + '…' : (bm.url ?? '');
  return `
    <div class="bookmark-item">
      <div class="bookmark-title">
        <a href="${escHtml(bm.url ?? '#')}" target="_blank" rel="noopener">${escHtml(bm.title)}</a>
      </div>
      <div class="bookmark-url" title="${escHtml(bm.url ?? '')}">${escHtml(urlTrunc)}</div>
      <input class="bm-note" data-id="${escHtml(bm.id)}" value="${escHtml(bm.description)}" placeholder="Description…">
      <button class="bm-del btn-del" data-id="${escHtml(bm.id)}">Del</button>
    </div>
  `;
}

function filterBookmarks(query: string): void {
  const q = query.toLowerCase();
  if (!q) {
    renderBookmarksView(allBookmarks);
    return;
  }
  renderBookmarksView(
    allBookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.url ?? '').toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    )
  );
}

async function handleAddBookmark(): Promise<void> {
  if (!currentLibrary) return;

  const title = prompt('Bookmark title:');
  if (!title) return;
  const url = prompt('Bookmark URL:');
  if (!url) return;

  const bm = await createBookmark({
    libraryId: currentLibrary.id,
    parentId: null,
    type: 'bookmark',
    title,
    url,
    description: '',
    tags: [],
    visitCount: 0,
    isFavorite: false,
    sortOrder: Date.now(),
  });

  allBookmarks.push(bm);
  renderBookmarksView();
}

// ---- Export helpers (delegated to services/export.ts) ------

function downloadFile(dataUri: string, filename: string): void {
  const a = document.createElement('a');
  a.setAttribute('href', dataUri);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---- Utility -----------------------------------------------

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Expose downloadFile for export service
(window as unknown as { downloadFile: typeof downloadFile }).downloadFile = downloadFile;

// ---- History view ------------------------------------------

const ONE_DAY_MS = 86_400_000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

function renderHistoryView(entries: HistoryEntry[] = filteredHistory): void {
  if (entries.length === 0) {
    historyTableBody.innerHTML = '';
    historyEmptyEl.style.display = 'block';
    historyCountEl.textContent = '';
    return;
  }
  historyEmptyEl.style.display = 'none';
  historyTableBody.innerHTML = entries.map(renderHistoryRow).join('');
  historyCountEl.textContent = `${entries.length} item${entries.length !== 1 ? 's' : ''}`;

  // Wire star toggles
  historyTableBody.querySelectorAll<HTMLButtonElement>('.flag-star').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['id'] ?? '';
      const entry = allHistory.find((h) => h.id === id);
      if (!entry) return;
      const newVal = !entry.isStarred;
      void markHistoryStarred(id, newVal).then(() => {
        entry.isStarred = newVal;
        applyHistoryFilter();
      });
    });
  });

  // Wire important toggles
  historyTableBody.querySelectorAll<HTMLButtonElement>('.flag-important').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['id'] ?? '';
      const entry = allHistory.find((h) => h.id === id);
      if (!entry) return;
      const newVal = !entry.isImportant;
      void markHistoryImportant(id, newVal).then(() => {
        entry.isImportant = newVal;
        applyHistoryFilter();
      });
    });
  });

  // Wire delete buttons
  historyTableBody.querySelectorAll<HTMLButtonElement>('.btn-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['id'] ?? '';
      void deleteHistoryEntry(id).then(() => {
        allHistory = allHistory.filter((h) => h.id !== id);
        filteredHistory = filteredHistory.filter((h) => h.id !== id);
        renderHistoryView(filteredHistory);
      });
    });
  });
}

function renderHistoryRow(entry: HistoryEntry): string {
  const titleTrunc = entry.title.length > 60 ? entry.title.substring(0, 60) + '…' : entry.title;
  const urlTrunc   = entry.url.length   > 55 ? entry.url.substring(0, 55) + '…'   : entry.url;
  const lastVisit  = formatDisplayDate(entry.visitTime);
  return `
    <tr>
      <td class="col-flag">
        <button class="flag-star${entry.isStarred ? '' : ' off'}" data-id="${escHtml(entry.id)}" title="Star">★</button>
        <button class="flag-important${entry.isImportant ? '' : ' off'}" data-id="${escHtml(entry.id)}" title="Important">!</button>
      </td>
      <td class="col-title" title="${escHtml(entry.title)}">${escHtml(titleTrunc)}</td>
      <td class="col-url">
        <a class="url-cell" href="${escHtml(entry.url)}" target="_blank" rel="noopener"
           title="${escHtml(entry.url)}">${escHtml(urlTrunc)}</a>
      </td>
      <td class="col-count">${entry.visitCount}</td>
      <td class="col-date">${lastVisit}</td>
      <td class="col-actions">
        <button class="btn-del" data-id="${escHtml(entry.id)}">Del</button>
      </td>
    </tr>
  `;
}

function applyHistoryFilter(): void {
  const q    = historySearchEl.value.toLowerCase();
  const now  = Date.now();
  let result = allHistory;

  // Date/flag filter
  switch (historyFilter) {
    case 'today':
      result = result.filter((h) => now - h.visitTime <= ONE_DAY_MS);
      break;
    case 'week':
      result = result.filter((h) => now - h.visitTime <= ONE_WEEK_MS);
      break;
    case 'starred':
      result = result.filter((h) => h.isStarred);
      break;
    case 'important':
      result = result.filter((h) => h.isImportant);
      break;
  }

  // Text search
  if (q) {
    result = result.filter(
      (h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
    );
  }

  filteredHistory = result;
  renderHistoryView(filteredHistory);
}

// ---- Downloads view ----------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function renderDownloadsView(downloads: Download[] = filteredDownloads): void {
  if (downloads.length === 0) {
    downloadsTableBody.innerHTML = '';
    downloadsEmptyEl.style.display = 'block';
    downloadsCountEl.textContent = '';
    return;
  }
  downloadsEmptyEl.style.display = 'none';
  downloadsTableBody.innerHTML = downloads.map(renderDownloadRow).join('');
  downloadsCountEl.textContent = `${downloads.length} item${downloads.length !== 1 ? 's' : ''}`;

  // Wire delete buttons
  downloadsTableBody.querySelectorAll<HTMLButtonElement>('.btn-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['id'] ?? '';
      void deleteDownload(id).then(() => {
        allDownloads = allDownloads.filter((d) => d.id !== id);
        filteredDownloads = filteredDownloads.filter((d) => d.id !== id);
        renderDownloadsView(filteredDownloads);
      });
    });
  });
}

function renderDownloadRow(dl: Download): string {
  const filename = dl.filename.split(/[\\/]/).pop() ?? dl.filename;
  const nameTrunc = filename.length > 45 ? filename.substring(0, 45) + '…' : filename;
  const urlTrunc  = dl.url.length > 50 ? dl.url.substring(0, 50) + '…' : dl.url;
  const stateClass = `state-${dl.state}`;
  return `
    <tr>
      <td class="col-title" title="${escHtml(filename)}">${escHtml(nameTrunc)}</td>
      <td class="col-url">
        <a class="url-cell" href="${escHtml(dl.url)}" target="_blank" rel="noopener"
           title="${escHtml(dl.url)}">${escHtml(urlTrunc)}</a>
      </td>
      <td class="col-size">${formatFileSize(dl.fileSize)}</td>
      <td class="col-mime">${escHtml(dl.mimeType.split('/')[1] ?? dl.mimeType)}</td>
      <td class="col-date">${formatDisplayDate(dl.downloadedAt)}</td>
      <td class="col-state"><span class="${stateClass}">${dl.state}</span></td>
      <td class="col-actions">
        <button class="btn-del" data-id="${escHtml(dl.id)}">Del</button>
      </td>
    </tr>
  `;
}

function applyDownloadsFilter(): void {
  const q = downloadsSearchEl.value.toLowerCase();
  let result = allDownloads;

  if (downloadsFilter !== 'all') {
    result = result.filter((d) => d.state === downloadsFilter);
  }

  if (q) {
    result = result.filter(
      (d) => d.filename.toLowerCase().includes(q) || d.url.toLowerCase().includes(q)
    );
  }

  filteredDownloads = result;
  renderDownloadsView(filteredDownloads);
}
