// MindVault Companion Web Dashboard — Vanilla JS SPA
// Talks to the companion REST API (same origin: http://127.0.0.1:47821)
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let token            = '';
let activeLibId      = '';
let activeLibName    = '';
let activeSessionId  = '';
let activeMasterView = ''; // 'all-sessions' | 'all-tabs' | ''
let allTabs          = []; // current session tabs (per-session search)
let allMasterTabs    = []; // all tabs for master view search
let masterTabSortCol = 'savedAt'; // column key for All Tabs sort
let masterTabSortDir = 'desc';    // 'asc' | 'desc'
let cachedLibs       = [];
let cachedSessions   = []; // currently rendered sessions (for re-sort)
let cachedLibsMap    = {}; // id → lib object
let sessionSortCol   = 'createdAt';
let sessionSortDir   = 'desc';
let showArchivedSessions = false;
// Context menu state
let ctxSession    = null;
let ctxLibId      = null;
let ctxContainerEl = null;
let ctxShowLibCol = false;
let ctxLib        = null; // library under right-click (lib context menu)
let searchTimer   = null;

// ── Column visibility + widths (All Tabs master table) ────────────────────────
// Persisted in localStorage; restored on boot via applyColWidthsToCSS().
const DEFAULT_VIS = new Set(['num','title','domain','session','library','browser','saved','notes','actions']);
const visibleCols = (() => {
  try { const r = localStorage.getItem('mv-col-vis'); if (r) return new Set(JSON.parse(r)); } catch {}
  return new Set(DEFAULT_VIS);
})();
const colWidths = (() => {
  try { const r = localStorage.getItem('mv-col-widths'); if (r) return JSON.parse(r); } catch {}
  return {};
})();

// ── DOM refs ──────────────────────────────────────────────────────────────────
const libList             = document.getElementById('libList');
const sessionsPanel       = document.getElementById('sessionsPanel');
const tabsPanel           = document.getElementById('tabsPanel');
const welcomePanel        = document.getElementById('welcomePanel');
const masterSessionsPanel = document.getElementById('masterSessionsPanel');
const masterTabsPanel     = document.getElementById('masterTabsPanel');
const libTitle            = document.getElementById('libTitle');
const sessionTitle        = document.getElementById('sessionTitle');
const entityCount         = document.getElementById('entityCount');
const tabCount            = document.getElementById('tabCount');
const masterSessionCount  = document.getElementById('masterSessionCount');
const masterTabCount      = document.getElementById('masterTabCount');
const sessionList         = document.getElementById('sessionList');
const masterSessionList   = document.getElementById('masterSessionList');
const masterTabList       = document.getElementById('masterTabList');
const bookmarkList        = document.getElementById('bookmarkList');
const historyList         = document.getElementById('historyList');
const downloadList        = document.getElementById('downloadList');
const tabListEl           = document.getElementById('tabList');
const lnavBtns            = document.querySelectorAll('.lnav-btn');
const tabSearch           = document.getElementById('tabSearch');
const masterTabSearch     = document.getElementById('masterTabSearch');
const backBtn             = document.getElementById('backBtn');
const newLibBtn           = document.getElementById('newLibBtn');
const newLibModal         = document.getElementById('newLibModal');
const newLibName          = document.getElementById('newLibName');
const newLibCreate        = document.getElementById('newLibCreate');
const newLibCancel        = document.getElementById('newLibCancel');
const statusDot           = document.getElementById('companionStatus');
const searchPanel         = document.getElementById('searchPanel');
const settingsPanel       = document.getElementById('settingsPanel');
const globalSearch        = document.getElementById('globalSearch');
const searchLibSel        = document.getElementById('searchLibSel');
const searchResults       = document.getElementById('searchResults');
const settingsContent     = document.getElementById('settingsContent');
const snavBtns            = document.querySelectorAll('.snav-btn');
const sessionsToolbar     = document.getElementById('sessionsToolbar');
const showArchivedBtn     = document.getElementById('showArchivedBtn');
const masterShowArchivedBtn = document.getElementById('masterShowArchivedBtn');
const ctxMenu             = document.getElementById('ctxMenu');
const libCtxMenu          = document.getElementById('libCtxMenu');
const colVisMenu          = document.getElementById('colVisMenu');
const issue011Notice      = document.getElementById('issue011Notice');

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(path, { headers: { 'X-MindVault-Token': token } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'X-MindVault-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : null;
}

async function apiPatch(path, body) {
  const r = await fetch(path, {
    method: 'PATCH',
    headers: { 'X-MindVault-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
}

async function apiDel(path) {
  const r = await fetch(path, { method: 'DELETE', headers: { 'X-MindVault-Token': token } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  // Restore persisted theme before anything renders
  const savedTheme = localStorage.getItem('mv-theme') || '';
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  else delete document.documentElement.dataset.theme;
  try {
    const td = await (await fetch('/token')).json();
    token = td.token;
    statusDot.className   = 'status-dot status-ok';
    statusDot.textContent = '● Connected';
  } catch {
    statusDot.className   = 'status-dot status-err';
    statusDot.textContent = '● Offline';
    libList.innerHTML = '<div class="loading-msg">Companion not running.<br/>Start it and refresh.</div>';
    return;
  }
  applyColWidthsToCSS();
  wireTabsToolbar();
  wireLibContextMenu();
  await loadLibraries();
}

// ── Libraries ─────────────────────────────────────────────────────────────────
async function loadLibraries() {
  libList.innerHTML = '<div class="loading-msg">Loading…</div>';
  try {
    const libs = await apiGet('/libraries');
    cachedLibs    = libs || [];
    cachedLibsMap = Object.fromEntries(cachedLibs.map(l => [l.id, l]));
    renderLibraries(cachedLibs);
  } catch (e) {
    libList.innerHTML = `<div class="loading-msg">Error: ${e.message}</div>`;
  }
}

function renderLibraries(libs) {
  if (!libs.length) {
    libList.innerHTML = '<div class="loading-msg">No libraries yet.<br/>Use the + button to create one.</div>';
    return;
  }
  libList.innerHTML = '';
  libs.forEach(lib => {
    const el = document.createElement('div');
    el.className  = 'lib-item' + (lib.id === activeLibId ? ' active' : '');
    el.dataset.id = lib.id;
    el.innerHTML  = `<span class="lib-name" title="${esc(lib.name)}">${esc(lib.name)}</span>
      ${lib.isEncrypted ? '<span title="Encrypted">🔒</span>' : ''}`;
    el.addEventListener('click', () => selectLibrary(lib));
    // Dblclick on the name span to rename inline
    el.querySelector('.lib-name').addEventListener('dblclick', e => {
      e.stopPropagation();
      startLibRename(el, lib);
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); showLibCtxMenu(lib, e.clientX, e.clientY); });
    libList.appendChild(el);
  });
}

// startLibRename — replace lib-name span with inline input; PATCH on commit.
function startLibRename(el, lib) {
  const nameEl = el.querySelector('.lib-name');
  if (!nameEl) return;
  const old = lib.name;
  const inp = document.createElement('input');
  inp.className = 'lib-rename-input';
  inp.value = old;
  nameEl.replaceWith(inp);
  inp.focus(); inp.select();
  let committed = false;
  async function commit() {
    if (committed) return; committed = true;
    const val = inp.value.trim();
    if (val && val !== old) {
      try { await apiPatch(`/libraries/${lib.id}`, { name: val }); }
      catch (e) { alert('Rename failed: ' + e.message); }
    }
    await loadLibraries();
  }
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') void commit();
    if (e.key === 'Escape') { committed = true; void loadLibraries(); }
  });
  inp.addEventListener('blur', () => void commit());
}

// ── Sessions ──────────────────────────────────────────────────────────────────
async function selectLibrary(lib) {
  activeMasterView = '';
  activeLibId   = lib.id;
  activeLibName = lib.name;
  document.querySelectorAll('.lib-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === lib.id));
  snavBtns.forEach(b => b.classList.toggle('active', b.dataset.view === 'libraries'));
  libList.style.display = '';
  showLibContent('sessions');
  showPanel('sessions');
  libTitle.textContent = lib.name;
  await loadSessions(lib.id);
}

async function loadSessions(libId) {
  sessionList.innerHTML = '<div class="loading-msg">Loading sessions…</div>';
  try {
    const url      = `/libraries/${libId}/sessions${showArchivedSessions ? '?archived=true' : ''}`;
    const sessions = await apiGet(url);
    cachedSessions = sessions || [];
    updateEntityCount();
    renderSessionsTable(cachedSessions, cachedLibsMap, sessionList, false);
  } catch (e) {
    sessionList.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`;
  }
}

function updateEntityCount() {
  const n = cachedSessions.length;
  entityCount.textContent = `${n} session${n !== 1 ? 's' : ''}`;
}

// ── Session table rendering ───────────────────────────────────────────────────
function renderSessionsTable(sessions, libsMap, containerEl, showLibCol) {
  containerEl.innerHTML = '';
  const gridCols = showLibCol
    ? '1fr 125px 46px 95px 80px 30px'
    : '1fr 140px 46px 90px 30px';

  // ── Header row ──
  const header = document.createElement('div');
  header.className = 'session-table-header' + (showLibCol ? ' has-lib' : '');
  header.style.gridTemplateColumns = gridCols;

  function thCol(col, label) {
    const isActive = sessionSortCol === col;
    const arrow    = isActive ? (sessionSortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<div class="sth-col${isActive ? ' sort-active' : ''}" data-col="${col}">`
         + `${label}<span class="sort-arrow">${arrow}</span></div>`;
  }
  header.innerHTML =
    thCol('name',          'Name')    +
    thCol('createdAt',     'Date')    +
    thCol('tabCount',      'Tabs')    +
    (showLibCol ? thCol('libraryId', 'Library') : '') +
    thCol('sourceBrowser', 'Browser') +
    '<div></div>';

  header.querySelectorAll('.sth-col[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sessionSortCol === col) {
        sessionSortDir = sessionSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sessionSortCol = col;
        sessionSortDir = (col === 'createdAt' || col === 'tabCount') ? 'desc' : 'asc';
      }
      renderSessionsTable(cachedSessions, libsMap, containerEl, showLibCol);
    });
  });
  containerEl.appendChild(header);

  // ── Data rows ──
  const sorted = sortSessions(sessions, sessionSortCol, sessionSortDir);
  if (!sorted.length) {
    const msg = document.createElement('div');
    msg.className   = 'empty-msg';
    msg.textContent = 'No sessions yet. Save some tabs from the browser extension.';
    containerEl.appendChild(msg);
    return;
  }

  sorted.forEach(s => {
    const libName  = (libsMap[s.libraryId] && libsMap[s.libraryId].name) || '';
    const row      = document.createElement('div');
    row.className  = 'session-row' + (showLibCol ? ' has-lib' : '') + (s.archived ? ' archived' : '');
    row.style.gridTemplateColumns = gridCols;
    row.dataset.id = s.id;

    const dateStr   = fmtDate(s.createdAt);
    const browser   = s.sourceBrowser || '';
    const archBadge = s.archived ? '<span class="archived-badge">archived</span>' : '';

    row.innerHTML =
      `<div class="sr-name"><span class="sr-name-text" title="${esc(s.name)}">${esc(s.name)}</span>${archBadge}</div>` +
      `<div class="sr-date">${esc(dateStr)}</div>` +
      `<div class="sr-tabs">${s.tabCount || 0}</div>` +
      (showLibCol ? `<div class="sr-lib" title="${esc(libName)}">${esc(libName)}</div>` : '') +
      `<div class="sr-browser">${esc(browser)}</div>` +
      `<button class="sr-menu-btn" title="Options" tabindex="-1">⋯</button>`;

    // Click → open session tabs
    row.addEventListener('click', e => {
      if (e.target.classList.contains('sr-menu-btn')) return;
      if (row.classList.contains('renaming')) return;
      const libId = showLibCol ? s.libraryId : activeLibId;
      activeLibId = libId;
      selectSession(s, libId);
    });

    // Double-click name → inline rename
    row.querySelector('.sr-name').addEventListener('dblclick', e => {
      e.stopPropagation();
      const libId = showLibCol ? s.libraryId : activeLibId;
      doRenameSession(row, s, libId, containerEl, libsMap, showLibCol);
    });

    // ⋯ button → context menu
    row.querySelector('.sr-menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      const rect  = e.currentTarget.getBoundingClientRect();
      const libId = showLibCol ? s.libraryId : activeLibId;
      showContextMenu(s, libId, rect.right, rect.bottom, containerEl, libsMap, showLibCol);
    });

    // Right-click → context menu
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      const libId = showLibCol ? s.libraryId : activeLibId;
      showContextMenu(s, libId, e.clientX, e.clientY, containerEl, libsMap, showLibCol);
    });

    containerEl.appendChild(row);
  });
}

function sortSessions(sessions, col, dir) {
  return [...sessions].sort((a, b) => {
    let av = a[col] ?? '', bv = b[col] ?? '';
    if (col === 'tabCount' || col === 'createdAt') { av = +av; bv = +bv; }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}

// ── Show-archived toggle ──────────────────────────────────────────────────────
function updateArchivedButtons() {
  [showArchivedBtn, masterShowArchivedBtn].forEach(btn => {
    if (!btn) return;
    btn.textContent = showArchivedSessions ? '☑ Showing archived' : '☐ Archived';
    btn.classList.toggle('active', showArchivedSessions);
  });
}

showArchivedBtn.addEventListener('click', async () => {
  showArchivedSessions = !showArchivedSessions;
  updateArchivedButtons();
  if (activeLibId && !activeMasterView) await loadSessions(activeLibId);
});

masterShowArchivedBtn.addEventListener('click', async () => {
  showArchivedSessions = !showArchivedSessions;
  updateArchivedButtons();
  await loadMasterSessions();
});

// ── Context menu ──────────────────────────────────────────────────────────────
function showContextMenu(session, libId, x, y, containerEl, libsMap, showLibCol) {
  ctxSession     = session;
  ctxLibId       = libId;
  ctxContainerEl = containerEl;
  ctxShowLibCol  = showLibCol;
  // Archive vs Restore visibility
  ctxMenu.querySelector('.ctx-archive-btn').style.display = session.archived ? 'none' : '';
  ctxMenu.querySelector('.ctx-restore-btn').style.display = session.archived ? ''     : 'none';
  // Keep menu inside viewport
  const mw = 200, mh = 210;
  ctxMenu.style.left = `${Math.min(x, window.innerWidth  - mw - 8)}px`;
  ctxMenu.style.top  = `${Math.min(y, window.innerHeight - mh - 8)}px`;
  ctxMenu.classList.remove('hidden');
}

function hideContextMenu() {
  ctxMenu.classList.add('hidden');
  ctxSession = null;
}

document.addEventListener('click', e => {
  if (!ctxMenu.classList.contains('hidden') && !ctxMenu.contains(e.target)) hideContextMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideContextMenu(); });

ctxMenu.querySelectorAll('.ctx-item').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const s      = ctxSession, lid = ctxLibId;
    const cel    = ctxContainerEl, slc = ctxShowLibCol;
    hideContextMenu();
    if (s) await handleSessionAction(action, s, lid, cel, cachedLibsMap, slc);
  });
});

async function handleSessionAction(action, session, libId, containerEl, libsMap, showLibCol) {
  if (action === 'open') {
    activeLibId = libId;
    selectSession(session, libId);
    return;
  }
  if (action === 'rename') {
    const rowEl = containerEl.querySelector(`.session-row[data-id="${session.id}"]`);
    if (rowEl) doRenameSession(rowEl, session, libId, containerEl, libsMap, showLibCol);
    return;
  }
  if (action === 'archive') {
    try {
      await apiPatch(`/libraries/${libId}/sessions/${session.id}`, { archived: true });
      session.archived = true;
      const row = containerEl.querySelector(`.session-row[data-id="${session.id}"]`);
      if (!showArchivedSessions) {
        cachedSessions = cachedSessions.filter(s => s.id !== session.id);
        row?.remove();
        updateEntityCount();
        if (activeMasterView === 'all-sessions')
          masterSessionCount.textContent = `${cachedSessions.length} session${cachedSessions.length !== 1 ? 's' : ''}`;
      } else if (row) {
        row.classList.add('archived');
        if (!row.querySelector('.archived-badge'))
          row.querySelector('.sr-name').insertAdjacentHTML('beforeend', '<span class="archived-badge">archived</span>');
      }
    } catch (e) { alert('Archive failed: ' + e.message); }
    return;
  }
  if (action === 'restore') {
    try {
      await apiPatch(`/libraries/${libId}/sessions/${session.id}`, { archived: false });
      session.archived = false;
      const row = containerEl.querySelector(`.session-row[data-id="${session.id}"]`);
      if (row) { row.classList.remove('archived'); row.querySelector('.archived-badge')?.remove(); }
    } catch (e) { alert('Restore failed: ' + e.message); }
    return;
  }
  if (action === 'delete') {
    if (!confirm(`Remove session "${session.name}" from history?\nSaved tabs are kept.`)) return;
    try {
      await apiDel(`/libraries/${libId}/sessions/${session.id}`);
      cachedSessions = cachedSessions.filter(s => s.id !== session.id);
      containerEl.querySelector(`.session-row[data-id="${session.id}"]`)?.remove();
      updateEntityCount();
      if (activeMasterView === 'all-sessions')
        masterSessionCount.textContent = `${cachedSessions.length} session${cachedSessions.length !== 1 ? 's' : ''}`;
    } catch (e) { alert('Delete failed: ' + e.message); }
    return;
  }
  if (action === 'delete-tabs') {
    if (!confirm(`Permanently delete session "${session.name}" AND all its saved tabs?\nThis cannot be undone.`)) return;
    try {
      await apiDel(`/libraries/${libId}/sessions/${session.id}?deleteTabs=true`);
      cachedSessions = cachedSessions.filter(s => s.id !== session.id);
      containerEl.querySelector(`.session-row[data-id="${session.id}"]`)?.remove();
      updateEntityCount();
      if (activeMasterView === 'all-sessions')
        masterSessionCount.textContent = `${cachedSessions.length} session${cachedSessions.length !== 1 ? 's' : ''}`;
    } catch (e) { alert('Delete failed: ' + e.message); }
  }
}

// ── Inline rename ─────────────────────────────────────────────────────────────
function doRenameSession(rowEl, session, libId, containerEl, libsMap, showLibCol) {
  if (rowEl.classList.contains('renaming')) return;
  rowEl.classList.add('renaming');

  const nameCell  = rowEl.querySelector('.sr-name');
  const origName  = session.name;
  const input     = document.createElement('input');
  input.className = 'sr-name-input';
  input.value     = origName;
  nameCell.innerHTML = '';
  nameCell.appendChild(input);
  input.focus();
  input.select();

  let committed = false;
  async function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim() || origName;
    if (newName !== origName) {
      try {
        await apiPatch(`/libraries/${libId}/sessions/${session.id}`, { name: newName });
        session.name = newName;
      } catch (e) { alert('Rename failed: ' + e.message); session.name = origName; }
    }
    rowEl.classList.remove('renaming');
    restoreNameCell(nameCell, session);
    rewireNameDblClick(nameCell, rowEl, session, libId, containerEl, libsMap, showLibCol);
  }

  input.addEventListener('keydown', async e => {
    if (e.key === 'Enter')  { e.preventDefault(); await commit(); }
    else if (e.key === 'Escape') {
      committed = true;
      rowEl.classList.remove('renaming');
      restoreNameCell(nameCell, session);
      rewireNameDblClick(nameCell, rowEl, session, libId, containerEl, libsMap, showLibCol);
    }
  });
  input.addEventListener('blur', commit);
}

function restoreNameCell(nameCell, session) {
  const badge = session.archived ? '<span class="archived-badge">archived</span>' : '';
  nameCell.innerHTML = `<span class="sr-name-text" title="${esc(session.name)}">${esc(session.name)}</span>${badge}`;
}

function rewireNameDblClick(nameCell, rowEl, session, libId, containerEl, libsMap, showLibCol) {
  nameCell.addEventListener('dblclick', e => {
    e.stopPropagation();
    doRenameSession(rowEl, session, libId, containerEl, libsMap, showLibCol);
  }, { once: true });
}

// ── Master views (All Sessions / All Tabs) ────────────────────────────────────
async function loadMasterSessions() {
  masterSessionList.innerHTML = '<div class="loading-msg">Loading…</div>';
  try {
    const [libs, sessions] = await Promise.all([
      apiGet('/libraries'),
      apiGet(`/sessions${showArchivedSessions ? '?archived=true' : ''}`),
    ]);
    cachedLibs     = libs || [];
    cachedLibsMap  = Object.fromEntries(cachedLibs.map(l => [l.id, l]));
    cachedSessions = sessions || [];
    const n = cachedSessions.length;
    masterSessionCount.textContent = `${n} session${n !== 1 ? 's' : ''}`;
    renderSessionsTable(cachedSessions, cachedLibsMap, masterSessionList, true);
  } catch (e) {
    masterSessionList.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`;
  }
}

async function loadMasterTabs() {
  masterTabList.innerHTML = '<div class="loading-msg">Loading…</div>';
  masterTabSearch.value   = '';
  try {
    const tabs    = await apiGet('/tabs');
    allMasterTabs = tabs || [];
    const n = allMasterTabs.length;
    masterTabCount.textContent = `${n} tab${n !== 1 ? 's' : ''}`;
    renderMasterTabsTable(allMasterTabs);
  } catch (e) {
    masterTabList.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`;
  }
}

masterTabSearch.addEventListener('input', () => {
  const q = masterTabSearch.value.trim().toLowerCase();
  const filtered = q ? allMasterTabs.filter(t =>
    (t.title        || '').toLowerCase().includes(q) ||
    (t.url          || '').toLowerCase().includes(q) ||
    (t.sessionName  || '').toLowerCase().includes(q) ||
    (t.libraryName  || '').toLowerCase().includes(q) ||
    (t.sourceBrowser|| '').toLowerCase().includes(q)
  ) : allMasterTabs;
  renderMasterTabsTable(filtered);
});

// ── All Tabs helpers ──────────────────────────────────────────────────────────

/** Default CSS custom property values for each column. */
const COL_DEFAULTS = {
  num: '32px', colour: '16px', title: '1fr', domain: '110px',
  session: '120px', library: '100px', browser: '80px', saved: '76px',
  repeats: '64px', notes: '140px', actions: '76px',
};

/**
 * applyColWidthsToCSS — restore column widths + visibility to CSS custom properties.
 * Hidden columns get 0px so their grid track collapses; visible ones get their
 * persisted width or the default. Called in boot() before first render.
 */
function applyColWidthsToCSS() {
  const s = document.documentElement.style;
  Object.keys(COL_DEFAULTS).forEach(c => {
    if (!visibleCols.has(c)) s.setProperty(`--col-${c}`, '0px');
    else s.setProperty(`--col-${c}`, colWidths[c] || COL_DEFAULTS[c]);
  });
}

/**
 * wireResizeHandles — attach pointer-event column drag-resize to .col-resize-handle elements.
 * Updates --col-{name} on :root and persists widths to localStorage('mv-col-widths').
 * @param {HTMLElement} hdrEl - the header row element containing the resize handles
 */
function wireResizeHandles(hdrEl) {
  hdrEl.querySelectorAll('.col-resize-handle').forEach(handle => {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      handle.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      const col    = handle.dataset.resizeCol;
      const startX = e.clientX;
      const startW = handle.parentElement.getBoundingClientRect().width;
      const onMove = ev => {
        const w = Math.max(40, startW + ev.clientX - startX);
        document.documentElement.style.setProperty(`--col-${col}`, w + 'px');
        colWidths[col] = w + 'px';
      };
      const onUp = () => {
        handle.classList.remove('dragging');
        handle.releasePointerCapture(e.pointerId);
        localStorage.setItem('mv-col-widths', JSON.stringify(colWidths));
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  });
}

// Export utilities — used by masterTabsExport
const csvQ = v => '"' + String(v || '').replace(/"/g, '""') + '"';
const escX = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * dlBlob — trigger a file download for the given text content.
 * @param {string} content - file body
 * @param {string} filename - suggested download name
 * @param {string} mime - MIME type
 */
function dlBlob(content, filename, mime) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: filename,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * masterTabsExport — export allMasterTabs (full unfiltered set) in the requested format.
 * @param {'csv'|'json'|'html'|'text'} fmt
 */
function masterTabsExport(fmt) {
  const ts   = new Date().toISOString().slice(0, 10);
  const data = allMasterTabs;
  if (!data.length) { alert('No tabs to export.'); return; }
  if (fmt === 'json') {
    dlBlob(JSON.stringify(data, null, 2), `mv-tabs-${ts}.json`, 'application/json'); return;
  }
  if (fmt === 'csv') {
    const h    = '#,Title,URL,Domain,Session,Library,Browser,Saved,Notes';
    const rows = data.map((t, i) => [
      i + 1, csvQ(t.title), csvQ(t.url), csvQ(domainOf(t.url)),
      csvQ(t.sessionName || ''), csvQ(t.libraryName || ''), csvQ(t.sourceBrowser || ''),
      csvQ(fmtDate(t.savedAt)), csvQ(t.notes || ''),
    ].join(','));
    dlBlob([h, ...rows].join('\n'), `mv-tabs-${ts}.csv`, 'text/csv'); return;
  }
  if (fmt === 'html') {
    const rows = data.map((t, i) =>
      `<tr><td>${i + 1}</td><td>${escX(t.title)}</td>` +
      `<td><a href="${escX(t.url)}">${escX(t.url)}</a></td><td>${escX(domainOf(t.url))}</td>` +
      `<td>${escX(t.sessionName || '')}</td><td>${escX(t.libraryName || '')}</td>` +
      `<td>${escX(t.sourceBrowser || '')}</td><td>${fmtDate(t.savedAt)}</td>` +
      `<td>${escX(t.notes || '')}</td></tr>`).join('');
    dlBlob(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MindVault Tabs</title>` +
      `<style>body{font-family:system-ui;margin:20px}table{border-collapse:collapse;width:100%}` +
      `th,td{border:1px solid #ccc;padding:6px;font-size:12px;word-break:break-word}` +
      `th{background:#f0f0f0}a{color:#5290e0}</style></head><body>` +
      `<h2>MindVault All Tabs (${data.length})</h2>` +
      `<table><thead><tr><th>#</th><th>Title</th><th>URL</th><th>Domain</th>` +
      `<th>Session</th><th>Library</th><th>Browser</th><th>Saved</th><th>Notes</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></body></html>`,
      `mv-tabs-${ts}.html`, 'text/html'); return;
  }
  if (fmt === 'text') {
    dlBlob(data.map(t => `${t.title || '(No Title)'}\t${t.url}`).join('\n'),
      `mv-tabs-${ts}.txt`, 'text/plain');
  }
}

/**
 * wireTabsToolbar — wire export buttons and column-visibility toggle in the All Tabs toolbar.
 * Called once in boot(); uses event delegation on stable DOM elements.
 */
function wireTabsToolbar() {
  document.getElementById('mtbCopyJson')?.addEventListener('click', () =>
    navigator.clipboard.writeText(JSON.stringify(allMasterTabs, null, 2))
      .then(() => alert(`Copied ${allMasterTabs.length} tabs as JSON`))
      .catch(e => alert('Copy failed: ' + e.message)));
  ['Csv', 'Json', 'Html', 'Text'].forEach(f =>
    document.getElementById(`mtbExport${f}`)?.addEventListener('click',
      () => masterTabsExport(f.toLowerCase())));
  const colsBtn = document.getElementById('mtbColsBtn');
  colsBtn?.addEventListener('click', e => {
    e.stopPropagation();
    colVisMenu?.classList.toggle('hidden');
    if (!colVisMenu?.classList.contains('hidden')) {
      const r = colsBtn.getBoundingClientRect();
      Object.assign(colVisMenu.style, {
        position: 'fixed',
        right:    `${window.innerWidth - r.right}px`,
        left:     'auto',
        top:      `${r.bottom + 4}px`,
      });
    }
  });
  document.addEventListener('click', e => {
    if (colVisMenu && !colVisMenu.classList.contains('hidden') &&
        !colVisMenu.contains(e.target) && e.target !== colsBtn)
      colVisMenu.classList.add('hidden');
  });
  // Wire column visibility checkboxes
  colVisMenu?.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = visibleCols.has(cb.dataset.col);
    cb.addEventListener('change', () => {
      if (cb.checked) visibleCols.add(cb.dataset.col); else visibleCols.delete(cb.dataset.col);
      localStorage.setItem('mv-col-vis', JSON.stringify([...visibleCols]));
      applyColWidthsToCSS();
      renderMasterTabsTable(allMasterTabs);
    });
  });
}

/**
 * wireLibContextMenu — wire library right-click context menu (Rename / Delete Library).
 * Called once in boot().
 */
function wireLibContextMenu() {
  libCtxMenu?.querySelectorAll('[data-lib-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lib = ctxLib; hideLibCtxMenu();
      if (!lib) return;
      if (btn.dataset.libAction === 'rename') {
        const el = libList?.querySelector(`.lib-item[data-id="${lib.id}"]`);
        if (el) startLibRename(el, lib);
      } else if (btn.dataset.libAction === 'delete') {
        if (!confirm(`Delete library "${lib.name}" and ALL its data?\n\nThis cannot be undone.`)) return;
        try {
          await apiDel(`/libraries/${lib.id}`);
          if (activeLibId === lib.id) { activeLibId = ''; showPanel('welcome'); }
          await loadLibraries();
        } catch (e) { alert('Delete failed: ' + e.message); }
      }
    });
  });
  document.addEventListener('click', e => {
    if (libCtxMenu && !libCtxMenu.classList.contains('hidden') &&
        !libCtxMenu.contains(e.target))
      hideLibCtxMenu();
  });
}

/**
 * showLibCtxMenu — position and reveal the library right-click context menu.
 * @param {object} lib - library object with id and name
 * @param {number} x - viewport X coordinate
 * @param {number} y - viewport Y coordinate
 */
function showLibCtxMenu(lib, x, y) {
  ctxLib = lib;
  libCtxMenu.style.cssText =
    `position:fixed;left:${Math.min(x, window.innerWidth - 190)}px;` +
    `top:${Math.min(y, window.innerHeight - 80)}px`;
  libCtxMenu.classList.remove('hidden');
}

/** hideLibCtxMenu — close the library context menu and clear ctxLib. */
function hideLibCtxMenu() {
  libCtxMenu?.classList.add('hidden');
  ctxLib = null;
}

/**
 * renderMasterTabsTable — 11-column CSS-grid table for the All Tabs master panel.
 *
 * @why   Provide a rich all-tabs view with column resize, visibility toggle, repeat
 *        count, editable notes, clickable URLs, and per-tab open/delete actions.
 * @what  Renders sticky .tab-table-hdr (sortable, resizable) + .tab-table-row per tab.
 *        Syncs CSS custom properties from visibleCols/colWidths before rendering.
 * @how   CSS custom properties on :root control track widths (0px = hidden).
 *        Pointer-event drag resize wired via wireResizeHandles(hdr).
 *        Notes saved via PATCH /tabs/{id}; delete via DELETE /tabs/{id}.
 * @param {Tab[]} tabs — filtered tab array (for display); allMasterTabs holds full set
 */
function renderMasterTabsTable(tabs) {
  // Sync CSS column variables with current visibility + persisted widths
  const s = document.documentElement.style;
  Object.keys(COL_DEFAULTS).forEach(c => {
    if (!visibleCols.has(c)) s.setProperty(`--col-${c}`, '0px');
    else s.setProperty(`--col-${c}`, colWidths[c] || COL_DEFAULTS[c]);
  });

  if (!tabs.length) {
    masterTabList.innerHTML = '<div class="empty-msg">No tabs found.</div>';
    return;
  }

  // Sort
  const sorted = [...tabs].sort((a, b) => {
    let av, bv;
    switch (masterTabSortCol) {
      case 'title':   av = (a.title || '').toLowerCase();         bv = (b.title || '').toLowerCase();         break;
      case 'domain':  av = domainOf(a.url);                       bv = domainOf(b.url);                       break;
      case 'session': av = (a.sessionName || '').toLowerCase();   bv = (b.sessionName || '').toLowerCase();   break;
      case 'library': av = (a.libraryName || '').toLowerCase();   bv = (b.libraryName || '').toLowerCase();   break;
      case 'browser': av = (a.sourceBrowser || '').toLowerCase(); bv = (b.sourceBrowser || '').toLowerCase(); break;
      default:        av = a.savedAt || 0;                        bv = b.savedAt || 0;                        break;
    }
    if (av < bv) return masterTabSortDir === 'asc' ? -1 : 1;
    if (av > bv) return masterTabSortDir === 'asc' ?  1 : -1;
    return 0;
  });

  // Repeat count per URL across the full (unfiltered) dataset
  const repeatMap = {};
  allMasterTabs.forEach(t => { repeatMap[t.url] = (repeatMap[t.url] || 0) + 1; });

  const vis   = col => visibleCols.has(col);
  const hs    = ' style="display:none"'; // hidden cell style shorthand
  const arrow = col => masterTabSortCol === col ? (masterTabSortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const sa    = col => masterTabSortCol === col ? ' sorted' : '';

  // ── Header ──
  const hdr = document.createElement('div');
  hdr.className = 'tab-table-hdr';
  hdr.innerHTML =
    `<span class="tth"${vis('num') ? '' : hs}>#<span class="col-resize-handle" data-resize-col="num"></span></span>` +
    `<span class="tth"${vis('colour') ? '' : hs}>Colour<span class="col-resize-handle" data-resize-col="colour"></span></span>` +
    `<span class="tth${sa('title')}" data-col="title"${vis('title') ? '' : hs}>Title${arrow('title')}<span class="col-resize-handle" data-resize-col="title"></span></span>` +
    `<span class="tth${sa('domain')}" data-col="domain"${vis('domain') ? '' : hs}>Domain${arrow('domain')}<span class="col-resize-handle" data-resize-col="domain"></span></span>` +
    `<span class="tth${sa('session')}" data-col="session"${vis('session') ? '' : hs}>Session${arrow('session')}<span class="col-resize-handle" data-resize-col="session"></span></span>` +
    `<span class="tth${sa('library')}" data-col="library"${vis('library') ? '' : hs}>Library${arrow('library')}<span class="col-resize-handle" data-resize-col="library"></span></span>` +
    `<span class="tth${sa('browser')}" data-col="browser"${vis('browser') ? '' : hs}>Browser${arrow('browser')}<span class="col-resize-handle" data-resize-col="browser"></span></span>` +
    `<span class="tth${sa('savedAt')}" data-col="savedAt"${vis('saved') ? '' : hs}>Saved${arrow('savedAt')}<span class="col-resize-handle" data-resize-col="saved"></span></span>` +
    `<span class="tth"${vis('repeats') ? '' : hs}>Rpts<span class="col-resize-handle" data-resize-col="repeats"></span></span>` +
    `<span class="tth"${vis('notes') ? '' : hs}>Notes<span class="col-resize-handle" data-resize-col="notes"></span></span>` +
    `<span class="tth"${vis('actions') ? '' : hs}>Actions<span class="col-resize-handle" data-resize-col="actions"></span></span>`;

  hdr.querySelectorAll('.tth[data-col]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', e => {
      if (e.target.classList.contains('col-resize-handle')) return;
      const col = th.dataset.col;
      if (masterTabSortCol === col) masterTabSortDir = masterTabSortDir === 'asc' ? 'desc' : 'asc';
      else { masterTabSortCol = col; masterTabSortDir = col === 'savedAt' ? 'desc' : 'asc'; }
      renderMasterTabsTable(tabs);
    });
  });
  wireResizeHandles(hdr);

  masterTabList.innerHTML = '';
  masterTabList.appendChild(hdr);

  // ── Rows ──
  const frag = document.createDocumentFragment();
  sorted.forEach((tab, idx) => {
    const colour  = tab.colour || 'none';
    const domain  = domainOf(tab.url);
    const repeats = repeatMap[tab.url] || 1;
    const favicon = domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=14`
      : '';
    const row = document.createElement('div');
    row.className  = 'tab-table-row';
    row.dataset.id = tab.id;
    row.innerHTML =
      `<span class="tt-num"${vis('num') ? '' : hs}>${idx + 1}</span>` +
      `<span class="tt-colour colour-${esc(colour)}"${vis('colour') ? '' : hs} title="${esc(colour)}"></span>` +
      `<div class="tt-title-cell"${vis('title') ? '' : hs}>` +
        (favicon ? `<img class="tt-favicon" src="${esc(favicon)}" alt="" loading="lazy"/>` : '<span class="tt-favicon"></span>') +
        `<div class="tt-title-info">` +
          `<div class="tt-title-text" title="${esc(tab.title || tab.url)}">${esc(tab.title || '(No Title)')}</div>` +
          `<div class="tt-url-text"><a href="${esc(tab.url)}" target="_blank" rel="noopener noreferrer">${esc(tab.url)}</a></div>` +
        `</div>` +
      `</div>` +
      `<span class="tt-domain"${vis('domain') ? '' : hs} title="${esc(domain)}">${esc(domain)}</span>` +
      `<span class="tt-session"${vis('session') ? '' : hs} title="${esc(tab.sessionName || '—')}">${esc(tab.sessionName || '—')}</span>` +
      `<span class="tt-lib"${vis('library') ? '' : hs} title="${esc(tab.libraryName || '—')}">${esc(tab.libraryName || '—')}</span>` +
      `<span class="tt-browser"${vis('browser') ? '' : hs}>${esc(tab.sourceBrowser || '—')}</span>` +
      `<span class="tt-date"${vis('saved') ? '' : hs} title="${new Date(tab.savedAt).toLocaleString()}">${fmtDate(tab.savedAt)}</span>` +
      `<span class="tt-repeats"${vis('repeats') ? '' : hs}>${repeats > 1 ? `×${repeats}` : ''}</span>` +
      `<div class="tt-notes-cell"${vis('notes') ? '' : hs}>` +
        `<textarea class="tt-notes-input" placeholder="Add notes…" rows="1">${esc(tab.notes || '')}</textarea>` +
      `</div>` +
      `<div class="tt-actions"${vis('actions') ? '' : hs}>` +
        `<button class="btn-tt-open" title="Open tab in new window">Open</button>` +
        `<button class="btn-tt-del" title="Delete this tab permanently">Del</button>` +
      `</div>`;

    // Session click → navigate to that library
    if (tab.libraryId) {
      const sessEl = row.querySelector('.tt-session');
      if (sessEl) {
        sessEl.style.cursor = 'pointer';
        sessEl.style.color  = 'var(--accent)';
        sessEl.addEventListener('click', () => {
          const lib = cachedLibsMap[tab.libraryId];
          if (lib) void selectLibrary(lib);
        });
      }
    }

    // Notes — auto-grow textarea + save on change
    const notesTA = row.querySelector('.tt-notes-input');
    if (notesTA) {
      notesTA.addEventListener('input', () => {
        notesTA.style.height = 'auto';
        notesTA.style.height = notesTA.scrollHeight + 'px';
      });
      notesTA.addEventListener('change', async () => {
        try {
          await apiPatch(`/tabs/${tab.id}`, { notes: notesTA.value });
          tab.notes = notesTA.value;
        } catch (e) { alert('Failed to save notes: ' + e.message); }
      });
    }

    // Open button
    row.querySelector('.btn-tt-open')?.addEventListener('click', () =>
      window.open(tab.url, '_blank', 'noopener,noreferrer'));

    // Delete button
    row.querySelector('.btn-tt-del')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${tab.title || tab.url}"?\nThis cannot be undone.`)) return;
      try {
        await apiDel(`/tabs/${tab.id}`);
        allMasterTabs = allMasterTabs.filter(t => t.id !== tab.id);
        row.remove();
        const n = allMasterTabs.length;
        masterTabCount.textContent = `${n} tab${n !== 1 ? 's' : ''}`;
      } catch (e) { alert('Delete failed: ' + e.message); }
    });

    frag.appendChild(row);
  });
  masterTabList.appendChild(frag);
}

/** domainOf — extract hostname from URL, fallback to raw URL on parse error. */
function domainOf(url) {
  try { return new URL(url).hostname; } catch { return url || ''; }
}

// ── Tabs panel ────────────────────────────────────────────────────────────────
async function selectSession(session, libId) {
  activeSessionId = session.id;
  showPanel('tabs');
  sessionTitle.textContent = session.name;
  tabListEl.innerHTML      = '<div class="loading-msg">Loading tabs…</div>';
  tabSearch.value          = '';
  try {
    const tabs = await apiGet(`/libraries/${libId}/tabs`);
    allTabs    = (tabs || []).filter(t => t.sessionId === session.id);
    tabCount.textContent = `${allTabs.length} tab${allTabs.length !== 1 ? 's' : ''}`;
    renderTabs(allTabs, tabListEl);
  } catch (e) {
    tabListEl.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`;
  }
}

function renderTabs(tabs, containerEl) {
  if (!tabs.length) {
    containerEl.innerHTML = '<div class="empty-msg">No tabs in this session.</div>';
    return;
  }
  containerEl.innerHTML = '';
  tabs.forEach(tab => {
    const colour    = tab.colour || 'none';
    const domain    = domainOf(tab.url); // shared helper defined near renderMasterTabsTable
    const faviconUrl = tab.favIconUrl
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`
      : '';
    const el = document.createElement('div');
    el.className = 'tab-row';
    el.innerHTML = `
      <span class="tab-colour colour-${esc(colour)}" title="${esc(colour)}"></span>
      ${faviconUrl ? `<img class="tab-favicon" src="${faviconUrl}" alt="" loading="lazy" />` : '<span class="tab-favicon"></span>'}
      <div class="tab-info">
        <div class="tab-title" title="${esc(tab.title || tab.url)}">${esc(tab.title || '(No Title)')}</div>
        <div class="tab-url"><a href="${esc(tab.url)}" target="_blank" rel="noopener">${esc(tab.url)}</a></div>
      </div>`;
    containerEl.appendChild(el);
  });
}

tabSearch.addEventListener('input', () => {
  const q = tabSearch.value.trim().toLowerCase();
  renderTabs(
    q ? allTabs.filter(t =>
          (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q))
      : allTabs,
    tabListEl
  );
});

// ── New library modal ─────────────────────────────────────────────────────────
newLibBtn.addEventListener('click', () => {
  newLibName.value = '';
  newLibModal.classList.remove('hidden');
  newLibName.focus();
});
newLibCancel.addEventListener('click', () => newLibModal.classList.add('hidden'));
newLibModal.addEventListener('click', e => {
  if (e.target === newLibModal) newLibModal.classList.add('hidden');
});
newLibCreate.addEventListener('click', async () => {
  const name = newLibName.value.trim();
  if (!name) { newLibName.focus(); return; }
  try {
    newLibCreate.disabled = true;
    await apiPost('/libraries', { name, isEncrypted: false });
    newLibModal.classList.add('hidden');
    await loadLibraries();
  } catch (e) {
    alert('Failed to create library: ' + e.message);
  } finally {
    newLibCreate.disabled = false;
  }
});
newLibName.addEventListener('keydown', e => { if (e.key === 'Enter') newLibCreate.click(); });

// ── Navigation ────────────────────────────────────────────────────────────────
backBtn.addEventListener('click', () => {
  tabSearch.value = '';
  // Return to the view the user came from
  if (activeMasterView === 'all-sessions' || activeMasterView === 'all-tabs') {
    showPanel('all-sessions');
    activeMasterView = 'all-sessions';
  } else {
    showPanel('sessions');
  }
});

function showPanel(name) {
  [welcomePanel, sessionsPanel, tabsPanel, searchPanel,
   settingsPanel, masterSessionsPanel, masterTabsPanel].forEach(p => p.classList.add('hidden'));
  if      (name === 'sessions')     sessionsPanel.classList.remove('hidden');
  else if (name === 'tabs')         tabsPanel.classList.remove('hidden');
  else if (name === 'search')       searchPanel.classList.remove('hidden');
  else if (name === 'settings')     settingsPanel.classList.remove('hidden');
  else if (name === 'all-sessions') masterSessionsPanel.classList.remove('hidden');
  else if (name === 'all-tabs')     masterTabsPanel.classList.remove('hidden');
  else                              welcomePanel.classList.remove('hidden');
}

// ── Sidebar nav tabs ──────────────────────────────────────────────────────────
snavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    snavBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    if (view === 'libraries') {
      libList.style.display = '';
      if (activeLibId) { activeMasterView = ''; showPanel('sessions'); }
      else showPanel('welcome');
    } else if (view === 'all-sessions') {
      libList.style.display = 'none';
      activeMasterView = 'all-sessions';
      showPanel('all-sessions');
      loadMasterSessions();
    } else if (view === 'all-tabs') {
      libList.style.display = 'none';
      activeMasterView = 'all-tabs';
      showPanel('all-tabs');
      if (issue011Notice) issue011Notice.style.display = '';
      loadMasterTabs();
    } else if (view === 'search') {
      libList.style.display = 'none';
      showPanel('search');
      populateSearchLibPicker();
      globalSearch.focus();
    } else if (view === 'settings') {
      libList.style.display = 'none';
      showPanel('settings');
      renderSettings();
    }
  });
});

// ── Global Search ─────────────────────────────────────────────────────────────
function populateSearchLibPicker() {
  searchLibSel.innerHTML = '<option value="">All libraries</option>';
  cachedLibs.forEach(lib => {
    const o = document.createElement('option');
    o.value = lib.id; o.textContent = lib.name;
    searchLibSel.appendChild(o);
  });
}

globalSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 320);
});
searchLibSel.addEventListener('change', doSearch);

async function doSearch() {
  const q = globalSearch.value.trim();
  if (q.length < 2) {
    searchResults.innerHTML = '<div class="empty-msg">Type at least 2 characters…</div>';
    return;
  }
  const libId = searchLibSel.value;
  searchResults.innerHTML = '<div class="loading-msg">Searching…</div>';
  try {
    const url = libId
      ? `/search?libId=${encodeURIComponent(libId)}&q=${encodeURIComponent(q)}`
      : `/search?q=${encodeURIComponent(q)}`;
    const results = await apiGet(url);
    renderSearchResults(results || [], q);
  } catch (e) {
    searchResults.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`;
  }
}

function renderSearchResults(results, q) {
  if (!results.length) { searchResults.innerHTML = '<div class="empty-msg">No results.</div>'; return; }
  searchResults.innerHTML = '';
  results.forEach(r => {
    const el = document.createElement('div');
    el.className = 'tab-row';
    el.innerHTML = `
      <div class="tab-info">
        <div class="tab-title">${highlight(esc(r.title || r.entityId), q)}</div>
        <div class="tab-url"><a href="${esc(r.url || '')}" target="_blank" rel="noopener">${esc(r.url || r.entityType)}</a></div>
        ${r.snippet ? `<div class="tab-url" style="color:var(--muted)">${highlight(esc(r.snippet), q)}</div>` : ''}
      </div>`;
    searchResults.appendChild(el);
  });
}

function highlight(html, q) {
  if (!q) return html;
  return html.replace(
    new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    m => `<mark style="background:var(--yellow);color:#000;border-radius:2px">${m}</mark>`
  );
}

// ── Browser detection (Settings smart-installer) ──────────────────────────────
const BROWSERS = [
  { id: 'brave',   name: 'Brave',   icon: '🦁', distDir: 'dist/',         loadUrl: 'brave://extensions',   hint: 'Load unpacked → <code>dist/</code>' },
  { id: 'edge',    name: 'Edge',    icon: '🔷', distDir: 'dist/',         loadUrl: 'edge://extensions',    hint: 'Load unpacked → <code>dist/</code>' },
  { id: 'opera',   name: 'Opera',   icon: '🅾️', distDir: 'dist/',         loadUrl: 'opera://extensions',   hint: 'Load unpacked → <code>dist/</code>' },
  { id: 'vivaldi', name: 'Vivaldi', icon: '🎵', distDir: 'dist/',         loadUrl: 'vivaldi://extensions', hint: 'Load unpacked → <code>dist/</code>' },
  { id: 'chrome',  name: 'Chrome',  icon: '🌐', distDir: 'dist/',         loadUrl: 'chrome://extensions',  hint: 'Load unpacked → <code>dist/</code>' },
  { id: 'firefox', name: 'Firefox', icon: '🦊', distDir: 'dist-firefox/', loadUrl: 'about:debugging',      hint: 'Load Temporary Add-on → <code>dist-firefox/manifest.json</code>' },
];

function detectBrowser() {
  const ua = navigator.userAgent;
  if (navigator.brave && typeof navigator.brave.isBrave === 'function') return 'brave';
  if (ua.includes('Edg/'))    return 'edge';
  if (ua.includes('OPR/'))    return 'opera';
  if (ua.includes('Vivaldi')) return 'vivaldi';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Chrome'))  return 'chrome';
  return 'unknown';
}

function renderBrowserInstallCard() {
  const current = detectBrowser();
  const sorted  = [...BROWSERS.filter(b => b.id === current), ...BROWSERS.filter(b => b.id !== current)];
  const rows = sorted.map(b => {
    const isCurrent = b.id === current;
    const badge     = isCurrent ? ' <span style="color:var(--green);font-size:11px">← you</span>' : '';
    return `<div class="install-step" style="${isCurrent ? '' : 'opacity:0.55'}">
      ${b.icon} <strong>${b.name}</strong>${badge}<br>
      <span class="muted">${b.hint}</span>
      <a href="${b.loadUrl}" target="_blank" rel="noopener"
         style="font-size:11px;color:var(--accent);margin-left:6px">Open extensions page ↗</a>
    </div>`;
  }).join('');
  return `<div class="settings-card"><h3>Install Browser Extension</h3>${rows}</div>`;
}

// ── Bookmark importer ─────────────────────────────────────────────────────────
function parseNetscapeHTML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const items = [];
  doc.querySelectorAll('a, h3').forEach(el => {
    if (el.tagName === 'A' && el.href)
      items.push({ title: el.textContent.trim() || el.href, url: el.href, isFolder: false });
    else if (el.tagName === 'H3')
      items.push({ title: el.textContent.trim() || 'Folder', url: '', isFolder: true });
  });
  return items;
}

function parseChromiumJSON(text) {
  const items = [];
  try {
    const roots = (JSON.parse(text).roots) || {};
    function walkNode(node) {
      if (!node) return;
      if (node.type === 'url')    items.push({ title: node.name || node.url, url: node.url || '', isFolder: false });
      else if (node.type === 'folder') {
        items.push({ title: node.name || 'Folder', url: '', isFolder: true });
        (node.children || []).forEach(walkNode);
      }
    }
    ['bookmark_bar', 'other', 'synced'].forEach(k => { if (roots[k]) (roots[k].children || []).forEach(walkNode); });
  } catch (e) { console.warn('[MV] parseChromiumJSON error:', e); }
  return items;
}

async function importBookmarks(libId, items, onProgress) {
  const links = items.filter(b => !b.isFolder && b.url);
  let ok = 0, fail = 0;
  for (let i = 0; i < links.length; i++) {
    try {
      await apiPost(`/libraries/${libId}/bookmarks`, { title: links[i].title, url: links[i].url, notes: '', isFolder: false });
      ok++;
    } catch { fail++; }
    onProgress(i + 1, links.length);
  }
  return { ok, skip: items.length - links.length, fail };
}

function renderImportCard() {
  const libOptions = (cachedLibs || []).map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
  if (!libOptions) return '';
  return `
  <div class="settings-card" id="importCard">
    <h3>Import Bookmarks</h3>
    <div class="muted" style="font-size:12px;margin-bottom:8px">
      Supports Chrome/Edge/Brave <strong>Netscape HTML</strong> export and Chromium <strong>JSON</strong> backup.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <select id="importLibSel" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:13px">
        ${libOptions}
      </select>
      <label class="btn-secondary" style="cursor:pointer;text-align:center;padding:6px 12px;border-radius:6px;font-size:13px">
        📂 Choose file (.html or .json)
        <input type="file" id="importFile" accept=".html,.json,.htm" style="display:none" />
      </label>
      <div id="importStatus" style="font-size:12px;color:var(--muted);min-height:16px"></div>
    </div>
  </div>`;
}

function wireImportCard() {
  const fileInput = document.getElementById('importFile');
  const statusEl  = document.getElementById('importStatus');
  const libSel    = document.getElementById('importLibSel');
  if (!fileInput || !statusEl || !libSel) return;
  fileInput.addEventListener('change', () => {
    const file  = fileInput.files[0];
    if (!file) return;
    const libId = libSel.value;
    if (!libId) { statusEl.textContent = 'Select a library first.'; return; }
    statusEl.textContent = `Reading ${file.name}…`;
    const reader = new FileReader();
    reader.onload = async ev => {
      const text  = ev.target.result;
      const items = file.name.endsWith('.json') ? parseChromiumJSON(text) : parseNetscapeHTML(text);
      if (!items.length) { statusEl.textContent = 'No bookmarks found in file.'; return; }
      statusEl.textContent = `Importing ${items.filter(b => !b.isFolder).length} bookmarks…`;
      const summary = await importBookmarks(libId, items,
        (done, total) => { statusEl.textContent = `Importing… ${done}/${total}`; });
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = `✅ Done — ${summary.ok} imported, ${summary.skip} folders skipped` +
        (summary.fail ? `, ${summary.fail} failed` : '');
      fileInput.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function renderSettings() {
  settingsContent.innerHTML = '<div class="loading-msg">Loading…</div>';
  let version = '?', libCount = 0, autoStartEnabled = false, onWindows = false;
  try {
    const h   = await (await fetch('/health')).json();
    version   = h.version || '?';
    const libs = await apiGet('/libraries');
    libCount  = (libs || []).length;
    cachedLibs    = libs || [];
    cachedLibsMap = Object.fromEntries(cachedLibs.map(l => [l.id, l]));
    const as  = await apiGet('/autostart');
    autoStartEnabled = as.enabled;
    onWindows = as.platform === 'windows';
  } catch { /* offline */ }

  settingsContent.innerHTML = `
    <div class="settings-card">
      <h3>Companion Status</h3>
      <div class="settings-row"><span>Status</span><span class="val ok">● Running</span></div>
      <div class="settings-row"><span>Version</span><span class="val">${esc(version)}</span></div>
      <div class="settings-row"><span>Port</span><span class="val">47821</span></div>
      <div class="settings-row"><span>Libraries</span><span class="val">${libCount}</span></div>
      <div class="settings-row"><span>Dashboard</span><span class="val">
        <a href="/ui/" style="color:var(--accent)">http://127.0.0.1:47821/ui/</a></span></div>
    </div>
    ${onWindows ? `
    <div class="settings-card">
      <h3>Auto-Start</h3>
      <div class="settings-row">
        <span>Start at login</span>
        <button id="autostartBtn" class="${autoStartEnabled ? 'btn-secondary' : 'btn-primary'}"
                style="padding:4px 14px;font-size:12px">
          ${autoStartEnabled ? '⏹ Disable' : '▶ Enable'}
        </button>
      </div>
      <div class="settings-row" style="font-size:12px">
        <span class="muted">Task Scheduler: <strong style="color:${autoStartEnabled ? 'var(--green)' : 'var(--muted)'}">
          ${autoStartEnabled ? '● Active' : '○ Inactive'}
        </strong></span>
      </div>
    </div>` : ''}
    ${renderBrowserInstallCard()}
    ${renderImportCard()}
    <div class="settings-card">
      <h3>Appearance</h3>
      <div class="settings-row">
        <span>Theme</span>
        <div class="theme-switcher" id="themeSwitcher">
          <button class="theme-btn" data-theme="">Dark</button>
          <button class="theme-btn" data-theme="mid-dark">Mid Dark</button>
          <button class="theme-btn" data-theme="mid-light">Mid Light</button>
          <button class="theme-btn" data-theme="light">Light</button>
        </div>
      </div>
    </div>
    <div class="settings-card">
      <h3>Companion Install Path</h3>
      <div class="settings-row"><span>Binary</span><span class="val">%LOCALAPPDATA%\\MindVault\\bin\\mvaultd.exe</span></div>
      <div class="settings-row"><span>Database</span><span class="val">%APPDATA%\\MindVault\\db.sqlite</span></div>
    </div>
  `;
  wireImportCard();
  // Wire theme switcher buttons
  const themeSwitcher = document.getElementById('themeSwitcher');
  if (themeSwitcher) {
    const cur = localStorage.getItem('mv-theme') || '';
    themeSwitcher.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === cur);
      btn.addEventListener('click', () => {
        const t = btn.dataset.theme;
        if (t) document.documentElement.dataset.theme = t;
        else delete document.documentElement.dataset.theme;
        localStorage.setItem('mv-theme', t);
        themeSwitcher.querySelectorAll('.theme-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === t));
      });
    });
  }
  const autostartBtn = document.getElementById('autostartBtn');
  if (autostartBtn) {
    autostartBtn.addEventListener('click', async () => {
      autostartBtn.disabled = true;
      try {
        if (autoStartEnabled) await apiDel('/autostart');
        else await apiPost('/autostart', {});
        await renderSettings();
      } catch (e) {
        autostartBtn.disabled = false;
        alert('Auto-start error: ' + e.message);
      }
    });
  }
}

// ── Library entity nav (Sessions | Bookmarks | History | Downloads) ───────────
function showLibContent(type) {
  lnavBtns.forEach(b => b.classList.toggle('active', b.dataset.ltype === type));
  sessionsToolbar.classList.toggle('hidden', type !== 'sessions');
  sessionList.classList.toggle('hidden',   type !== 'sessions');
  bookmarkList.classList.toggle('hidden',  type !== 'bookmarks');
  historyList.classList.toggle('hidden',   type !== 'history');
  downloadList.classList.toggle('hidden',  type !== 'downloads');
}

lnavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!activeLibId) return;
    const type = btn.dataset.ltype;
    showLibContent(type);
    if      (type === 'bookmarks') loadBookmarks(activeLibId);
    else if (type === 'history')   loadHistory(activeLibId);
    else if (type === 'downloads') loadDownloads(activeLibId);
  });
});

// ── Bookmarks ─────────────────────────────────────────────────────────────────
async function loadBookmarks(libId) {
  bookmarkList.innerHTML = '<div class="loading-msg">Loading bookmarks…</div>';
  try {
    renderBookmarks(await apiGet(`/libraries/${libId}/bookmarks`) || []);
  } catch (e) { bookmarkList.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`; }
}

function renderBookmarks(items) {
  const leaves = items.filter(b => !b.isFolder);
  entityCount.textContent = `${leaves.length} bookmark${leaves.length !== 1 ? 's' : ''}`;
  if (!leaves.length) {
    bookmarkList.innerHTML = '<div class="empty-msg">No bookmarks synced yet.<br/>Bookmarks are pushed live as you add them in the browser.</div>';
    return;
  }
  bookmarkList.innerHTML = '';
  leaves.forEach(b => {
    const el  = document.createElement('div');
    el.className = 'tab-row';
    const dom = (() => { try { return new URL(b.url || '').hostname; } catch { return ''; } })();
    const fav = dom ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=16` : '';
    el.innerHTML = `
      ${fav ? `<img class="tab-favicon" src="${fav}" alt="" loading="lazy" />` : '<span class="tab-favicon">🔖</span>'}
      <div class="tab-info">
        <div class="tab-title">${esc(b.title || b.url || '(No title)')}</div>
        <div class="tab-url"><a href="${esc(b.url || '')}" target="_blank" rel="noopener">${esc(b.url || '')}</a></div>
      </div>`;
    bookmarkList.appendChild(el);
  });
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory(libId) {
  historyList.innerHTML = '<div class="loading-msg">Loading history…</div>';
  try {
    renderHistory(await apiGet(`/libraries/${libId}/history`) || []);
  } catch (e) { historyList.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`; }
}

function renderHistory(items) {
  entityCount.textContent = `${items.length} entr${items.length !== 1 ? 'ies' : 'y'}`;
  if (!items.length) {
    historyList.innerHTML = '<div class="empty-msg">No history synced yet.<br/>New visits are pushed live as you browse.</div>';
    return;
  }
  historyList.innerHTML = '';
  items.forEach(h => {
    const el  = document.createElement('div');
    el.className = 'tab-row';
    const date = h.visitTime ? new Date(h.visitTime).toLocaleString() : '';
    const fav  = h.domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h.domain)}&sz=16` : '';
    el.innerHTML = `
      ${fav ? `<img class="tab-favicon" src="${fav}" alt="" loading="lazy" />` : '<span class="tab-favicon">🕐</span>'}
      <div class="tab-info">
        <div class="tab-title">${esc(h.title || h.url)}</div>
        <div class="tab-url"><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.url)}</a></div>
        ${date ? `<div class="tab-url" style="color:var(--muted)">${esc(date)}${h.isImportant ? ' ⭐' : ''}</div>` : ''}
      </div>`;
    historyList.appendChild(el);
  });
}

// ── Downloads ─────────────────────────────────────────────────────────────────
async function loadDownloads(libId) {
  downloadList.innerHTML = '<div class="loading-msg">Loading downloads…</div>';
  try {
    renderDownloads(await apiGet(`/libraries/${libId}/downloads`) || []);
  } catch (e) { downloadList.innerHTML = `<div class="empty-msg">Error: ${e.message}</div>`; }
}

function renderDownloads(items) {
  entityCount.textContent = `${items.length} download${items.length !== 1 ? 's' : ''}`;
  if (!items.length) {
    downloadList.innerHTML = '<div class="empty-msg">No downloads synced yet.<br/>New downloads are pushed live as they start.</div>';
    return;
  }
  downloadList.innerHTML = '';
  items.forEach(dl => {
    const el   = document.createElement('div');
    el.className = 'tab-row';
    const date  = dl.downloadedAt ? new Date(dl.downloadedAt).toLocaleString() : '';
    const icon  = dl.state === 'complete' ? '✅' : dl.state === 'error' ? '❌' : '⏳';
    const size  = dl.fileSize ? `${(dl.fileSize / 1024).toFixed(0)} KB` : '';
    el.innerHTML = `
      <span class="tab-favicon" title="${esc(dl.state)}">${icon}</span>
      <div class="tab-info">
        <div class="tab-title">${esc(dl.filename || dl.url)}</div>
        <div class="tab-url"><a href="${esc(dl.url)}" target="_blank" rel="noopener">${esc(dl.url)}</a></div>
        <div class="tab-url" style="color:var(--muted)">${[date, size, esc(dl.mimeType || '')].filter(Boolean).join(' · ')}</div>
      </div>`;
    downloadList.appendChild(el);
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Format a unix-millisecond timestamp into a compact human-readable string.
 * Same day    → "3:42 PM"
 * Same year   → "Feb 5, 3:42 PM"
 * Other year  → "Feb 5, 2023"
 */
function fmtDate(ts) {
  if (!ts) return '';
  const d   = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
         + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── PWA Install Prompt ────────────────────────────────────────────────────────
let _installPrompt = null;
const installBtn   = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  if (installBtn) installBtn.classList.remove('hidden');
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    console.info('[MV] PWA install outcome:', outcome);
    _installPrompt = null;
    installBtn.classList.add('hidden');
  });
}

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  if (installBtn) installBtn.classList.add('hidden');
  console.info('[MV] PWA installed successfully');
});

// ── Start ─────────────────────────────────────────────────────────────────────
boot();
