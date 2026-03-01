// ============================================================
// MindVault — Export Service
// Preserves all v1.1 export formats + adds new ones.
// ============================================================

import type { SavedTab } from '@mindvault/shared';
import { getRepeatIndicatorLabel } from '@mindvault/shared';
import { formatDisplayDate } from '@mindvault/shared';

// ---- CSV Export (v1.1 compatible + enhanced) ---------------

export function exportCSV(data: unknown[], filename = 'mindvault-tabs.csv'): void {
  const tabs = data as SavedTab[];

  const header = 'Serial,Title,URL,RepeatCount,LastSaved,Notes';
  const rows = tabs.map((tab, i) =>
    [
      i + 1,
      `"${tab.title.replace(/"/g, '""')}"`,
      `"${tab.url}"`,
      tab.repeatCount,
      `"${formatDisplayDate(tab.lastSeenAt)}"`,
      `"${(tab.notes ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  const csv = [header, ...rows].join('\n');
  downloadFile('data:text/csv;charset=utf-8,' + encodeURIComponent(csv), filename);
}

// ---- JSON Export (v1.1 compatible + full schema) -----------

export function exportJSON(data: unknown, filename = 'mindvault-export.json'): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile('data:text/json;charset=utf-8,' + encodeURIComponent(json), filename);
}

// ---- HTML Export (v1.1 compatible + enhanced) --------------

export function exportHTML(data: unknown[], filename = 'mindvault-tabs.html'): void {
  const tabs = data as SavedTab[];

  const rows = tabs
    .map(
      (tab) =>
        `<tr>
          <td>${escHtml(tab.title)}</td>
          <td><a href="${escHtml(tab.url)}" target="_blank">${escHtml(tab.url)}</a></td>
          <td>${tab.repeatCount} ${getRepeatIndicatorLabel(tab.repeatCount)}</td>
          <td>${formatDisplayDate(tab.lastSeenAt)}</td>
          <td>${escHtml(tab.notes ?? '')}</td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MindVault Export</title>
  <style>
    body { font-family: Segoe UI, sans-serif; margin: 20px; }
    h1   { color: #333; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #f8f9fa; }
    tr:hover { background: #fafafa; }
    a { color: #007bff; }
  </style>
</head>
<body>
  <h1>MindVault Export</h1>
  <p>Exported: ${new Date().toLocaleString()} — ${tabs.length} records</p>
  <table>
    <thead>
      <tr>
        <th>Title</th><th>URL</th><th>Repeats</th><th>Last Saved</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  downloadFile('data:text/html;charset=utf-8,' + encodeURIComponent(html), filename);
}

// ---- Netscape HTML (Bookmarks import/export standard) ------

export interface BookmarkExportItem {
  title: string;
  url: string;
  addDate?: number;
}

export function exportNetscapeBookmarks(
  items: BookmarkExportItem[],
  filename = 'mindvault-bookmarks.html'
): void {
  const rows = items
    .map(
      (item) =>
        `    <DT><A HREF="${escHtml(item.url)}" ADD_DATE="${item.addDate ?? Date.now()}">${escHtml(item.title)}</A>`
    )
    .join('\n');

  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3>MindVault Export</H3>
  <DL><p>
${rows}
  </DL><p>
</DL><p>`;

  downloadFile('data:text/html;charset=utf-8,' + encodeURIComponent(html), filename);
}

// ---- Plain Text Export -------------------------------------

/**
 * exportText — exports tabs as plain text: one line per tab, Title TAB URL.
 * @param data - Array of SavedTab objects
 * @param filename - Output filename (default: mindvault-tabs.txt)
 */
export function exportText(data: unknown[], filename = 'mindvault-tabs.txt'): void {
  const tabs  = data as SavedTab[];
  const lines = tabs.map(t => `${t.title}\t${t.url}`);
  downloadFile(
    'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n')),
    filename
  );
}

// ---- Helpers -----------------------------------------------

function downloadFile(dataUri: string, filename: string): void {
  const a = document.createElement('a');
  a.setAttribute('href', dataUri);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
