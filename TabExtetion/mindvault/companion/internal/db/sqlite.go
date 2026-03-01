// Package db provides SQLite database access for the companion daemon.
// Uses modernc.org/sqlite (pure Go, no CGo required).
package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	_ "modernc.org/sqlite" // register "sqlite" driver
)

// DB wraps a sql.DB with MindVault-specific methods.
type DB struct {
	sql *sql.DB
}

// Library mirrors the IndexedDB library shape.
type Library struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Description  *string `json:"description,omitempty"`
	CreatedAt    int64   `json:"createdAt"`
	UpdatedAt    int64   `json:"updatedAt"`
	IsEncrypted  bool    `json:"isEncrypted"`
	PasswordSalt *string `json:"passwordSalt,omitempty"`
}

// Session mirrors the IndexedDB session shape.
// TabCount is computed via COUNT(saved_tabs WHERE session_id=s.id) — not stored.
// SourceBrowser: originating browser e.g. "Chrome","Firefox","Edge","" (unknown).
// Archived: soft-delete flag — false=active (normal), true=hidden unless requested.
type Session struct {
	ID            string `json:"id"`
	LibraryID     string `json:"libraryId"`
	Name          string `json:"name"`
	Notes         string `json:"notes"`
	CreatedAt     int64  `json:"createdAt"`
	UpdatedAt     int64  `json:"updatedAt"`
	SourceBrowser string `json:"sourceBrowser"` // migration 002
	Archived      bool   `json:"archived"`      // migration 002; stored as 0/1
	TabCount      int    `json:"tabCount"`      // computed at query time, not stored
}

// SessionPatch carries optional PATCH fields for UpdateSession.
// Only non-nil pointer fields are applied (partial update).
type SessionPatch struct {
	Name     *string `json:"name"`
	Archived *bool   `json:"archived"`
}

// TabPatch carries optional PATCH fields for UpdateTab.
// Only non-nil pointer fields are applied (partial update).
type TabPatch struct {
	Notes *string `json:"notes"` // new notes value; nil = no-op
}

// Tab mirrors the IndexedDB savedTab shape.
// Fields SessionName, LibraryName, SourceBrowser are populated ONLY by ListAllTabs
// (cross-library master view) via JOIN — they are omitted in per-library responses.
type Tab struct {
	ID         string  `json:"id"`
	LibraryID  string  `json:"libraryId"`
	SessionID  *string `json:"sessionId,omitempty"`
	URL        string  `json:"url"`
	Title      string  `json:"title"`
	FavIconURL *string `json:"favIconUrl,omitempty"`
	SavedAt    int64   `json:"savedAt"`
	Notes      string  `json:"notes"`
	Colour     *string `json:"colour,omitempty"`
	// Extra fields for master All-Tabs view (JOIN populated, nil in per-lib responses)
	SessionName   *string `json:"sessionName,omitempty"`
	LibraryName   *string `json:"libraryName,omitempty"`
	SourceBrowser *string `json:"sourceBrowser,omitempty"`
}

// SearchResult is a single full-text search hit.
type SearchResult struct {
	EntityType string `json:"entityType"` // "tab" | "session" | "bookmark"
	EntityID   string `json:"entityId"`
	Title      string `json:"title"`
	URL        string `json:"url,omitempty"`
	Snippet    string `json:"snippet"`
}

// DefaultDBPath returns the platform-appropriate default database path.
//   Windows: %APPDATA%\MindVault\db.sqlite
//   macOS:   ~/Library/Application Support/MindVault/db.sqlite
//   Linux:   ~/.local/share/MindVault/db.sqlite
func DefaultDBPath() string {
	var base string
	switch runtime.GOOS {
	case "windows":
		base = os.Getenv("APPDATA")
	case "darwin":
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, "Library", "Application Support")
	default:
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, ".local", "share")
	}
	return filepath.Join(base, "MindVault", "db.sqlite")
}

// Open opens (or creates) the SQLite database at the given path.
func Open(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}
	sqlDB, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	sqlDB.SetMaxOpenConns(1) // SQLite WAL supports one writer
	return &DB{sql: sqlDB}, nil
}

// OpenInMemory opens a transient in-memory database for testing.
func OpenInMemory() (*DB, error) {
	sqlDB, err := sql.Open("sqlite", "file::memory:?_foreign_keys=on&cache=shared")
	if err != nil {
		return nil, fmt.Errorf("open in-memory sqlite: %w", err)
	}
	sqlDB.SetMaxOpenConns(1)
	return &DB{sql: sqlDB}, nil
}

// Close closes the underlying database connection.
func (d *DB) Close() error {
	return d.sql.Close()
}

// CreateLibrary inserts a new library record.
func (d *DB) CreateLibrary(l Library) error {
	_, err := d.sql.Exec(
		`INSERT INTO libraries (id, name, description, created_at, updated_at, is_encrypted, password_salt)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		l.ID, l.Name, l.Description, l.CreatedAt, l.UpdatedAt, l.IsEncrypted, l.PasswordSalt,
	)
	return err
}

// CreateSession inserts a new session record.
// SourceBrowser and Archived are stored from migration 002 columns.
func (d *DB) CreateSession(s Session) error {
	archivedInt := 0
	if s.Archived {
		archivedInt = 1
	}
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO sessions
		   (id, library_id, name, notes, created_at, updated_at, source_browser, archived)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.LibraryID, s.Name, s.Notes, s.CreatedAt, s.UpdatedAt,
		s.SourceBrowser, archivedInt,
	)
	return err
}

// CreateTab inserts a new saved_tab record.
func (d *DB) CreateTab(t Tab) error {
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO saved_tabs (id, library_id, session_id, url, title, fav_icon_url, saved_at, notes, colour)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.LibraryID, t.SessionID, t.URL, t.Title, t.FavIconURL, t.SavedAt, t.Notes, t.Colour,
	)
	return err
}

// Migrate runs all pending migrations.
func (d *DB) Migrate() error {
	return migrate(d.sql)
}

// ListLibraries returns all libraries.
func (d *DB) ListLibraries() ([]Library, error) {
	rows, err := d.sql.Query(`SELECT id, name, description, created_at, updated_at, is_encrypted, password_salt FROM libraries ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var libs []Library
	for rows.Next() {
		var l Library
		if err := rows.Scan(&l.ID, &l.Name, &l.Description, &l.CreatedAt, &l.UpdatedAt, &l.IsEncrypted, &l.PasswordSalt); err != nil {
			return nil, err
		}
		libs = append(libs, l)
	}
	return libs, rows.Err()
}

// GetLibrary returns a library by ID.
func (d *DB) GetLibrary(id string) (*Library, error) {
	row := d.sql.QueryRow(`SELECT id, name, description, created_at, updated_at, is_encrypted, password_salt FROM libraries WHERE id = ?`, id)
	var l Library
	if err := row.Scan(&l.ID, &l.Name, &l.Description, &l.CreatedAt, &l.UpdatedAt, &l.IsEncrypted, &l.PasswordSalt); err != nil {
		return nil, err
	}
	return &l, nil
}

// sessionScanCols is the SELECT column list shared by ListSessions and ListAllSessions.
// tab_count is computed via a correlated subquery (always accurate, no denorm drift).
// archived is returned as an integer and converted to bool after scan.
const sessionScanCols = `
	s.id, s.library_id, s.name, s.notes, s.created_at, s.updated_at,
	s.source_browser, s.archived,
	(SELECT COUNT(*) FROM saved_tabs t WHERE t.session_id = s.id) AS tab_count`

// scanSession reads one session row from a *sql.Rows. archivedInt is converted to bool.
func scanSession(rows *sql.Rows) (Session, error) {
	var s Session
	var archivedInt int
	err := rows.Scan(
		&s.ID, &s.LibraryID, &s.Name, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
		&s.SourceBrowser, &archivedInt, &s.TabCount,
	)
	s.Archived = archivedInt != 0
	return s, err
}

// ListSessions returns sessions for a library, newest first.
// includeArchived=false omits rows where archived=1 (default view).
// includeArchived=true returns all sessions including archived (for "Show archived" toggle).
func (d *DB) ListSessions(libraryID string, includeArchived bool) ([]Session, error) {
	q := `SELECT` + sessionScanCols + `
	      FROM sessions s WHERE s.library_id = ?`
	if !includeArchived {
		q += ` AND s.archived = 0`
	}
	q += ` ORDER BY s.created_at DESC`
	rows, err := d.sql.Query(q, libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []Session
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// ListAllSessions returns all sessions across all libraries (master view), newest first.
// Includes library name via JOIN for display in the master sessions list.
// includeArchived controls whether archived sessions are included.
func (d *DB) ListAllSessions(includeArchived bool) ([]Session, error) {
	q := `SELECT` + sessionScanCols + `
	      FROM sessions s`
	if !includeArchived {
		q += ` WHERE s.archived = 0`
	}
	q += ` ORDER BY s.created_at DESC`
	rows, err := d.sql.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []Session
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// UpdateSession applies a partial patch to a session.
// Nil pointer fields in SessionPatch are not updated (partial update semantics).
// Always updates updated_at to the current time.
func (d *DB) UpdateSession(id string, p SessionPatch) error {
	now := time.Now().UnixMilli()
	switch {
	case p.Name != nil && p.Archived != nil:
		archivedInt := 0
		if *p.Archived {
			archivedInt = 1
		}
		_, err := d.sql.Exec(
			`UPDATE sessions SET name=?, archived=?, updated_at=? WHERE id=?`,
			*p.Name, archivedInt, now, id,
		)
		return err
	case p.Name != nil:
		_, err := d.sql.Exec(
			`UPDATE sessions SET name=?, updated_at=? WHERE id=?`,
			*p.Name, now, id,
		)
		return err
	case p.Archived != nil:
		archivedInt := 0
		if *p.Archived {
			archivedInt = 1
		}
		_, err := d.sql.Exec(
			`UPDATE sessions SET archived=?, updated_at=? WHERE id=?`,
			archivedInt, now, id,
		)
		return err
	}
	return nil // nothing to update
}

// UpdateTab applies a TabPatch to a saved_tab row.
// Currently supports notes only; add more fields to TabPatch as needed.
// Returns nil immediately if no fields are set (no-op). Returns SQL error on failure.
//
// @param id  UUID of the tab row to update.
// @param p   TabPatch with optional Notes pointer.
func (d *DB) UpdateTab(id string, p TabPatch) error {
	if p.Notes == nil {
		return nil // nothing to update
	}
	_, err := d.sql.Exec(`UPDATE saved_tabs SET notes=? WHERE id=?`, *p.Notes, id)
	return err
}

// DeleteSessionWithTabs removes a session AND all its saved_tabs in a single transaction.
// Use this for "Delete all data" — more destructive than DeleteSession which keeps tabs.
// Tabs are deleted first to avoid FK constraint issues.
func (d *DB) DeleteSessionWithTabs(id string) error {
	tx, err := d.sql.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.Exec(`DELETE FROM saved_tabs WHERE session_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM sessions WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

// ListAllTabs returns all saved_tabs across all libraries (master view), newest first.
// JOINs with sessions and libraries to populate SessionName, LibraryName, SourceBrowser.
// Used by the companion UI "All Tabs" master page for the full-column table view.
//
// @why  Master All-Tabs page needs session name, library name, and browser column.
// @how  LEFT JOIN sessions + libraries; NULL-safe scan into *string pointers.
func (d *DB) ListAllTabs() ([]Tab, error) {
	rows, err := d.sql.Query(`
		SELECT
			st.id, st.library_id, st.session_id, st.url, st.title,
			st.fav_icon_url, st.saved_at, st.notes, st.colour,
			s.name         AS session_name,
			l.name         AS library_name,
			s.source_browser
		FROM saved_tabs st
		LEFT JOIN sessions  s ON s.id = st.session_id
		LEFT JOIN libraries l ON l.id = st.library_id
		ORDER BY st.saved_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tabs []Tab
	for rows.Next() {
		var t Tab
		if err := rows.Scan(
			&t.ID, &t.LibraryID, &t.SessionID, &t.URL, &t.Title,
			&t.FavIconURL, &t.SavedAt, &t.Notes, &t.Colour,
			&t.SessionName, &t.LibraryName, &t.SourceBrowser,
		); err != nil {
			return nil, err
		}
		tabs = append(tabs, t)
	}
	return tabs, rows.Err()
}

// CountSessionsInLibrary returns the number of sessions in a library.
// Used by CreateSession handler to detect the first-ever session (for auto-rename).
func (d *DB) CountSessionsInLibrary(libraryID string) (int, error) {
	var n int
	err := d.sql.QueryRow(`SELECT COUNT(*) FROM sessions WHERE library_id = ?`, libraryID).Scan(&n)
	return n, err
}

// RenameLibrary updates the name of a library by ID.
// Used for auto-renaming "Default Library" → "Default (Chrome)" on first push.
func (d *DB) RenameLibrary(id, name string) error {
	_, err := d.sql.Exec(
		`UPDATE libraries SET name=?, updated_at=? WHERE id=?`,
		name, time.Now().UnixMilli(), id,
	)
	return err
}

// OsUsername returns the current OS login name for use in library naming.
// Tries USERNAME (Windows) → USER (Unix/macOS) → hostname → "User" as fallback.
// Used by MigrateDefaultLibraryNames and the PushSession auto-rename handler.
func OsUsername() string {
	if u := os.Getenv("USERNAME"); u != "" {
		return u
	}
	if u := os.Getenv("USER"); u != "" {
		return u
	}
	if h, err := os.Hostname(); err == nil && h != "" {
		return h
	}
	return "User"
}

// MigrateDefaultLibraryNames is a one-time startup migration.
// Renames libraries still named "Default Library" using the OS username.
// Delegates to MigrateDefaultLibraryNamesAs(OsUsername()) for testability.
//
// @why   Source-browser auto-rename only fires on new session pushes; libraries
//        created before v4.1.0 or when daemon was offline were never renamed.
// @where Called once in main.go immediately after database.Migrate().
// @when  Daemon startup — idempotent; safe to call every start.
func (d *DB) MigrateDefaultLibraryNames() error {
	return d.MigrateDefaultLibraryNamesAs(OsUsername())
}

// MigrateDefaultLibraryNamesAs is the testable core of MigrateDefaultLibraryNames.
// For every library still named "Default Library":
//   - If dominant source_browser found in its sessions → "Default (Chrome — username)"
//   - Otherwise (no sessions or all have empty browser) → "Default (username)"
//
// @param username  OS login name injected by caller (OsUsername() in production).
func (d *DB) MigrateDefaultLibraryNamesAs(username string) error {
	// Step 1: find all libraries still using the generic default name
	rows, err := d.sql.Query(`SELECT id FROM libraries WHERE name = 'Default Library'`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	rows.Close() // close before issuing further queries on same connection

	// Step 2 & 3: for each default-named library, detect dominant browser from sessions
	for _, libID := range ids {
		var browser string
		// Pick the most frequent non-empty source_browser value across all sessions
		_ = d.sql.QueryRow(
			`SELECT source_browser FROM sessions
			  WHERE library_id = ? AND source_browser != ''
			  GROUP BY source_browser ORDER BY COUNT(*) DESC LIMIT 1`,
			libID,
		).Scan(&browser) // err ignored: empty result → browser stays ""

		var newName string
		if browser == "" {
			// No sessions with known browser — use username only
			newName = "Default (" + username + ")"
		} else {
			// Include both browser and username: "Default (Chrome — DellVostro)"
			newName = "Default (" + browser + " \u2014 " + username + ")"
		}
		_ = d.RenameLibrary(libID, newName)
	}
	return nil
}

// ListTabs returns saved tabs for a library.
func (d *DB) ListTabs(libraryID string) ([]Tab, error) {
	rows, err := d.sql.Query(`SELECT id, library_id, session_id, url, title, fav_icon_url, saved_at, notes, colour FROM saved_tabs WHERE library_id = ? ORDER BY saved_at DESC`, libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tabs []Tab
	for rows.Next() {
		var t Tab
		if err := rows.Scan(&t.ID, &t.LibraryID, &t.SessionID, &t.URL, &t.Title, &t.FavIconURL, &t.SavedAt, &t.Notes, &t.Colour); err != nil {
			return nil, err
		}
		tabs = append(tabs, t)
	}
	return tabs, rows.Err()
}

// Search performs a LIKE search across tabs, bookmarks, and history entries.
// If libraryID is empty, searches across all libraries.
func (d *DB) Search(libraryID, query string) ([]SearchResult, error) {
	like := "%" + query + "%"
	var results []SearchResult

	// ── tabs ──────────────────────────────────────────────────────────────────
	rows, err := d.sql.Query(`
		SELECT 'tab', id, IFNULL(title,''), IFNULL(url,''), notes
		FROM saved_tabs
		WHERE (? = '' OR library_id = ?) AND (title LIKE ? OR url LIKE ? OR notes LIKE ?)
		LIMIT 30`,
		libraryID, libraryID, like, like, like)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var r SearchResult
		var notes string
		if err := rows.Scan(&r.EntityType, &r.EntityID, &r.Title, &r.URL, &notes); err != nil {
			rows.Close()
			return nil, err
		}
		r.Snippet = notes
		results = append(results, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// ── bookmarks ─────────────────────────────────────────────────────────────
	brows, err := d.sql.Query(`
		SELECT 'bookmark', id, IFNULL(title,''), IFNULL(url,''), notes
		FROM bookmarks
		WHERE (? = '' OR library_id = ?) AND (title LIKE ? OR url LIKE ? OR notes LIKE ?) AND is_folder = 0
		LIMIT 20`,
		libraryID, libraryID, like, like, like)
	if err != nil {
		return nil, err
	}
	for brows.Next() {
		var r SearchResult
		var notes string
		if err := brows.Scan(&r.EntityType, &r.EntityID, &r.Title, &r.URL, &notes); err != nil {
			brows.Close()
			return nil, err
		}
		r.Snippet = notes
		results = append(results, r)
	}
	brows.Close()
	if err := brows.Err(); err != nil {
		return nil, err
	}

	// ── history ───────────────────────────────────────────────────────────────
	hrows, err := d.sql.Query(`
		SELECT 'history', id, IFNULL(title,''), url, ''
		FROM history_entries
		WHERE (? = '' OR library_id = ?) AND (title LIKE ? OR url LIKE ?)
		LIMIT 20`,
		libraryID, libraryID, like, like)
	if err != nil {
		return nil, err
	}
	for hrows.Next() {
		var r SearchResult
		var snippet string
		if err := hrows.Scan(&r.EntityType, &r.EntityID, &r.Title, &r.URL, &snippet); err != nil {
			hrows.Close()
			return nil, err
		}
		results = append(results, r)
	}
	hrows.Close()
	return results, hrows.Err()
}

// ─── Bookmark ─────────────────────────────────────────────────────────────────

// Bookmark mirrors the IndexedDB bookmark shape.
type Bookmark struct {
	ID        string  `json:"id"`
	LibraryID string  `json:"libraryId"`
	ParentID  *string `json:"parentId,omitempty"`
	Title     string  `json:"title"`
	URL       *string `json:"url,omitempty"`
	Notes     string  `json:"notes"`
	Colour    *string `json:"colour,omitempty"`
	CreatedAt int64   `json:"createdAt"`
	IsFolder  bool    `json:"isFolder"`
}

// CreateBookmark inserts a new bookmark record. Ignores duplicate IDs (INSERT OR IGNORE).
func (d *DB) CreateBookmark(b Bookmark) error {
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO bookmarks (id, library_id, parent_id, title, url, notes, colour, created_at, is_folder)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		b.ID, b.LibraryID, b.ParentID, b.Title, b.URL, b.Notes, b.Colour, b.CreatedAt, b.IsFolder,
	)
	return err
}

// ListBookmarks returns all bookmarks for a library ordered by created_at.
func (d *DB) ListBookmarks(libraryID string) ([]Bookmark, error) {
	rows, err := d.sql.Query(
		`SELECT id, library_id, parent_id, title, url, notes, colour, created_at, is_folder
		 FROM bookmarks WHERE library_id = ? ORDER BY created_at`,
		libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Bookmark
	for rows.Next() {
		var b Bookmark
		var isFolder int
		if err := rows.Scan(&b.ID, &b.LibraryID, &b.ParentID, &b.Title, &b.URL, &b.Notes, &b.Colour, &b.CreatedAt, &isFolder); err != nil {
			return nil, err
		}
		b.IsFolder = isFolder == 1
		items = append(items, b)
	}
	return items, rows.Err()
}

// ─── HistoryEntry ─────────────────────────────────────────────────────────────

// HistoryEntry mirrors the IndexedDB historyEntry shape.
type HistoryEntry struct {
	ID          string `json:"id"`
	LibraryID   string `json:"libraryId"`
	URL         string `json:"url"`
	Title       string `json:"title"`
	VisitTime   int64  `json:"visitTime"`
	Domain      string `json:"domain"`
	IsImportant bool   `json:"isImportant"`
}

// UpsertHistoryEntry inserts a history entry, ignoring duplicates (same ID).
func (d *DB) UpsertHistoryEntry(h HistoryEntry) error {
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO history_entries (id, library_id, url, title, visit_time, domain, is_important)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.LibraryID, h.URL, h.Title, h.VisitTime, h.Domain, h.IsImportant,
	)
	return err
}

// ListHistory returns history entries for a library ordered newest-first. Capped at 500.
func (d *DB) ListHistory(libraryID string) ([]HistoryEntry, error) {
	rows, err := d.sql.Query(
		`SELECT id, library_id, url, IFNULL(title,''), visit_time, domain, is_important
		 FROM history_entries WHERE library_id = ? ORDER BY visit_time DESC LIMIT 500`,
		libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []HistoryEntry
	for rows.Next() {
		var h HistoryEntry
		var isImportant int
		if err := rows.Scan(&h.ID, &h.LibraryID, &h.URL, &h.Title, &h.VisitTime, &h.Domain, &isImportant); err != nil {
			return nil, err
		}
		h.IsImportant = isImportant == 1
		items = append(items, h)
	}
	return items, rows.Err()
}

// ─── Download ─────────────────────────────────────────────────────────────────

// Download mirrors the IndexedDB download shape.
type Download struct {
	ID           string  `json:"id"`
	LibraryID    string  `json:"libraryId"`
	Filename     string  `json:"filename"`
	URL          string  `json:"url"`
	MimeType     *string `json:"mimeType,omitempty"`
	FileSize     *int64  `json:"fileSize,omitempty"`
	DownloadedAt int64   `json:"downloadedAt"`
	State        string  `json:"state"`
	Notes        string  `json:"notes"`
}

// CreateDownload inserts a new download record. Ignores duplicate IDs.
func (d *DB) CreateDownload(dl Download) error {
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO downloads (id, library_id, filename, url, mime_type, file_size, downloaded_at, state, notes)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		dl.ID, dl.LibraryID, dl.Filename, dl.URL, dl.MimeType, dl.FileSize, dl.DownloadedAt, dl.State, dl.Notes,
	)
	return err
}

// ListDownloads returns downloads for a library ordered newest-first.
func (d *DB) ListDownloads(libraryID string) ([]Download, error) {
	rows, err := d.sql.Query(
		`SELECT id, library_id, filename, url, mime_type, file_size, downloaded_at, state, notes
		 FROM downloads WHERE library_id = ? ORDER BY downloaded_at DESC`,
		libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Download
	for rows.Next() {
		var dl Download
		if err := rows.Scan(&dl.ID, &dl.LibraryID, &dl.Filename, &dl.URL, &dl.MimeType, &dl.FileSize, &dl.DownloadedAt, &dl.State, &dl.Notes); err != nil {
			return nil, err
		}
		items = append(items, dl)
	}
	return items, rows.Err()
}

// ─── Delete methods ────────────────────────────────────────────────────────────
// All single-statement deletes. Cascade rules in the schema handle child rows:
//   libraries  → sessions, saved_tabs, bookmarks, history_entries, downloads (CASCADE)
//   sessions   → saved_tabs.session_id (SET NULL, tabs remain)
//   bookmarks  → child bookmarks (CASCADE)

// DeleteLibrary removes a library and all its cascaded child records.
func (d *DB) DeleteLibrary(id string) error {
	_, err := d.sql.Exec(`DELETE FROM libraries WHERE id = ?`, id)
	return err
}

// DeleteSession removes a session; its tabs remain (session_id set to NULL).
func (d *DB) DeleteSession(id string) error {
	_, err := d.sql.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}

// DeleteTab removes a single saved tab.
func (d *DB) DeleteTab(id string) error {
	_, err := d.sql.Exec(`DELETE FROM saved_tabs WHERE id = ?`, id)
	return err
}

// DeleteBookmark removes a bookmark (and child bookmarks via CASCADE).
func (d *DB) DeleteBookmark(id string) error {
	_, err := d.sql.Exec(`DELETE FROM bookmarks WHERE id = ?`, id)
	return err
}

// DeleteHistoryEntry removes a single history entry.
func (d *DB) DeleteHistoryEntry(id string) error {
	_, err := d.sql.Exec(`DELETE FROM history_entries WHERE id = ?`, id)
	return err
}

// DeleteDownload removes a single download record.
func (d *DB) DeleteDownload(id string) error {
	_, err := d.sql.Exec(`DELETE FROM downloads WHERE id = ?`, id)
	return err
}
