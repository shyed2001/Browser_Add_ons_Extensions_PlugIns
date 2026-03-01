// Package handlers contains the HTTP request handlers for the REST API.
package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/mindvault/companion/internal/db"
)

// generateID returns a 16-byte (32 hex char) random ID string.
// Uses crypto/rand — no external UUID dependency needed.
func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

const daemonVersion = "0.1.0"

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	db    *db.DB
	token string
}

// New creates a Handler with the given database and auth token.
func New(database *db.DB, token string) *Handler {
	return &Handler{db: database, token: token}
}

// GetToken godoc — GET /token (no auth — localhost only, used by extension to bootstrap)
// Returns the current auth token so the extension can authenticate subsequent requests.
// Security: companion only binds to 127.0.0.1 so only local processes can reach this.
func (h *Handler) GetToken(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{"token": h.token})
}

// jsonOK writes a JSON 200 response.
func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(v)
}

// jsonErr writes a JSON error response.
func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// Health godoc — GET /health (no auth)
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{
		"status":  "ok",
		"version": daemonVersion,
	})
}

// Version godoc — GET /version (no auth)
func (h *Handler) Version(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{"version": daemonVersion})
}

// ListLibraries godoc — GET /libraries
func (h *Handler) ListLibraries(w http.ResponseWriter, r *http.Request) {
	libs, err := h.db.ListLibraries()
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, libs)
}

// createLibraryReq is the JSON body for POST /libraries.
type createLibraryReq struct {
	ID           string  `json:"id,omitempty"`           // optional — use IDB ID for sync
	Name         string  `json:"name"`
	Description  *string `json:"description,omitempty"`
	IsEncrypted  bool    `json:"isEncrypted"`
	PasswordSalt *string `json:"passwordSalt,omitempty"`
}

// idOrNew returns req.ID if non-empty, otherwise generates a new random ID.
func idOrNew(id string) string {
	if id != "" {
		return id
	}
	return generateID()
}

// CreateLibrary godoc — POST /libraries
func (h *Handler) CreateLibrary(w http.ResponseWriter, r *http.Request) {
	var req createLibraryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		jsonErr(w, "name is required", http.StatusBadRequest)
		return
	}
	now := time.Now().UnixMilli()
	lib := db.Library{
		ID:           idOrNew(req.ID),
		Name:         req.Name,
		Description:  req.Description,
		CreatedAt:    now,
		UpdatedAt:    now,
		IsEncrypted:  req.IsEncrypted,
		PasswordSalt: req.PasswordSalt,
	}
	if err := h.db.CreateLibrary(lib); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, lib)
}

// GetLibrary godoc — GET /libraries/{id}
func (h *Handler) GetLibrary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	lib, err := h.db.GetLibrary(id)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonOK(w, lib)
}

// patchLibraryReq is the JSON body for PATCH /libraries/{id}.
// { "name": "New Name" } → rename only
type patchLibraryReq struct {
	Name *string `json:"name"`
}

// PatchLibrary godoc — PATCH /libraries/{id}
// Partial update: currently supports rename. Returns 204 No Content.
func (h *Handler) PatchLibrary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req patchLibraryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Name != nil {
		if err := h.db.RenameLibrary(id, *req.Name); err != nil {
			jsonErr(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteLibrary godoc — DELETE /libraries/{id}
// Cascades: removes all sessions, tabs, bookmarks, history, downloads for this library.
func (h *Handler) DeleteLibrary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.db.DeleteLibrary(id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListSessions godoc — GET /libraries/{libId}/sessions
// Query params: ?archived=true — include archived sessions (default: omit archived).
func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	includeArchived := r.URL.Query().Get("archived") == "true"
	sessions, err := h.db.ListSessions(libID, includeArchived)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, sessions)
}

// ListAllSessions godoc — GET /sessions
// Returns sessions across ALL libraries merged (master view). Newest first.
// Query params: ?archived=true to include archived sessions.
func (h *Handler) ListAllSessions(w http.ResponseWriter, r *http.Request) {
	includeArchived := r.URL.Query().Get("archived") == "true"
	sessions, err := h.db.ListAllSessions(includeArchived)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, sessions)
}

// ListAllTabs godoc — GET /tabs
// Returns saved_tabs across ALL libraries merged (master "All Tabs" view). Newest first.
func (h *Handler) ListAllTabs(w http.ResponseWriter, r *http.Request) {
	tabs, err := h.db.ListAllTabs()
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, tabs)
}

// createSessionReq is the JSON body for POST /libraries/{libId}/sessions.
// sourceBrowser: the browser that saved this session ("Chrome", "Firefox", etc.).
//   Used to auto-rename "Default Library" → "Default (Chrome)" on first push.
type createSessionReq struct {
	ID            string `json:"id,omitempty"` // optional — use IDB ID for sync
	Name          string `json:"name"`
	Notes         string `json:"notes"`
	TabCount      int    `json:"tabCount"`
	SourceBrowser string `json:"sourceBrowser"` // browser attribution (migration 002)
}

// CreateSession godoc — POST /libraries/{libId}/sessions
// Side effect: if library is still "Default Library" and this is the first session,
// renames the library to "Default ({sourceBrowser})" automatically.
func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	lib, err := h.db.GetLibrary(libID)
	if err != nil {
		jsonErr(w, "library not found", http.StatusNotFound)
		return
	}
	var req createSessionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		jsonErr(w, "name is required", http.StatusBadRequest)
		return
	}
	now := time.Now().UnixMilli()
	session := db.Session{
		ID:            idOrNew(req.ID),
		LibraryID:     libID,
		Name:          req.Name,
		Notes:         req.Notes,
		CreatedAt:     now,
		UpdatedAt:     now,
		SourceBrowser: req.SourceBrowser,
	}
	if err := h.db.CreateSession(session); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Auto-rename "Default Library" → "Default (Chrome — DellVostro)" on push from known browser.
	// Includes OS username so users with multiple machines can distinguish their libraries.
	if req.SourceBrowser != "" && lib.Name == "Default Library" {
		_ = h.db.RenameLibrary(libID, "Default ("+req.SourceBrowser+" \u2014 "+db.OsUsername()+")")
	}
	jsonOK(w, session)
}

// patchSessionReq is the JSON body for PATCH /libraries/{libId}/sessions/{id}.
// All fields optional (partial update). nil = unchanged.
// { "name": "New Name" }             → rename only
// { "archived": true }               → archive only
// { "name": "X", "archived": false } → rename + unarchive
type patchSessionReq struct {
	Name     *string `json:"name"`
	Archived *bool   `json:"archived"`
}

// PatchSession godoc — PATCH /libraries/{libId}/sessions/{id}
// Partial update: rename and/or archive/unarchive. Returns 204 No Content.
func (h *Handler) PatchSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req patchSessionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	patch := db.SessionPatch{Name: req.Name, Archived: req.Archived}
	if err := h.db.UpdateSession(id, patch); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteSession godoc — DELETE /libraries/{libId}/sessions/{id}
// Default: session row deleted; its saved_tabs remain with session_id=NULL.
// ?deleteTabs=true: hard-deletes session AND all its saved_tabs in one transaction.
//   Use ?deleteTabs=true for the "Delete all data" context menu action in the UI.
func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if r.URL.Query().Get("deleteTabs") == "true" {
		if err := h.db.DeleteSessionWithTabs(id); err != nil {
			jsonErr(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.db.DeleteSession(id); err != nil {
			jsonErr(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListTabs godoc — GET /libraries/{libId}/tabs
func (h *Handler) ListTabs(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	tabs, err := h.db.ListTabs(libID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, tabs)
}

// createTabReq is the JSON body for POST /libraries/{libId}/tabs.
type createTabReq struct {
	ID         string  `json:"id,omitempty"` // optional — use IDB ID for sync
	SessionID  *string `json:"sessionId,omitempty"`
	URL        string  `json:"url"`
	Title      string  `json:"title"`
	FavIconURL *string `json:"favIconUrl,omitempty"`
	Notes      string  `json:"notes"`
	Colour     *string `json:"colour,omitempty"`
}

// CreateTab godoc — POST /libraries/{libId}/tabs
func (h *Handler) CreateTab(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	// Verify library exists
	if _, err := h.db.GetLibrary(libID); err != nil {
		jsonErr(w, "library not found", http.StatusNotFound)
		return
	}
	var req createTabReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.URL == "" {
		jsonErr(w, "url is required", http.StatusBadRequest)
		return
	}
	tab := db.Tab{
		ID:         idOrNew(req.ID),
		LibraryID:  libID,
		SessionID:  req.SessionID,
		URL:        req.URL,
		Title:      req.Title,
		FavIconURL: req.FavIconURL,
		SavedAt:    time.Now().UnixMilli(),
		Notes:      req.Notes,
		Colour:     req.Colour,
	}
	if err := h.db.CreateTab(tab); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, tab)
}

// DeleteTab godoc — DELETE /libraries/{libId}/tabs/{id}
func (h *Handler) DeleteTab(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.db.DeleteTab(id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// patchTabReq is the JSON body for PATCH /tabs/{id}.
// All fields optional; nil = no change.
type patchTabReq struct {
	Notes *string `json:"notes"` // updated notes text
}

// PatchTab godoc — PATCH /tabs/{id}
// Updates notes on a saved tab (no library context required).
// Body: { "notes": "..." }. Returns 204 No Content on success.
func (h *Handler) PatchTab(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req patchTabReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.db.UpdateTab(id, db.TabPatch{Notes: req.Notes}); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteTabByID godoc — DELETE /tabs/{id}
// Deletes a saved tab by ID with no library context required.
// Used by the companion All Tabs master view action button. Returns 204 No Content.
func (h *Handler) DeleteTabByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.db.DeleteTab(id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Search godoc — GET /search?q=&libId= (libId optional — empty = all libraries)
func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		jsonErr(w, "q is required", http.StatusBadRequest)
		return
	}
	libID := r.URL.Query().Get("libId") // empty = search all libraries
	results, err := h.db.Search(libID, q)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, results)
}

// Sync godoc — POST /sync
func (h *Handler) Sync(w http.ResponseWriter, r *http.Request) {
	jsonErr(w, "not yet implemented", http.StatusNotImplemented)
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

// ListBookmarks godoc — GET /libraries/{libId}/bookmarks
func (h *Handler) ListBookmarks(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	items, err := h.db.ListBookmarks(libID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, items)
}

type createBookmarkReq struct {
	ID       string  `json:"id,omitempty"`
	ParentID *string `json:"parentId,omitempty"`
	Title    string  `json:"title"`
	URL      *string `json:"url,omitempty"`
	Notes    string  `json:"notes"`
	Colour   *string `json:"colour,omitempty"`
	IsFolder bool    `json:"isFolder"`
}

// CreateBookmark godoc — POST /libraries/{libId}/bookmarks
func (h *Handler) CreateBookmark(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	if _, err := h.db.GetLibrary(libID); err != nil {
		jsonErr(w, "library not found", http.StatusNotFound)
		return
	}
	var req createBookmarkReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Title == "" && (req.URL == nil || *req.URL == "") {
		jsonErr(w, "title or url is required", http.StatusBadRequest)
		return
	}
	b := db.Bookmark{
		ID:        idOrNew(req.ID),
		LibraryID: libID,
		ParentID:  req.ParentID,
		Title:     req.Title,
		URL:       req.URL,
		Notes:     req.Notes,
		Colour:    req.Colour,
		CreatedAt: time.Now().UnixMilli(),
		IsFolder:  req.IsFolder,
	}
	if err := h.db.CreateBookmark(b); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, b)
}

// ─── History ──────────────────────────────────────────────────────────────────

// ListHistory godoc — GET /libraries/{libId}/history
func (h *Handler) ListHistory(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	items, err := h.db.ListHistory(libID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, items)
}

type createHistoryReq struct {
	ID          string `json:"id,omitempty"`
	URL         string `json:"url"`
	Title       string `json:"title"`
	VisitTime   int64  `json:"visitTime"`
	Domain      string `json:"domain"`
	IsImportant bool   `json:"isImportant"`
}

// CreateHistoryEntry godoc — POST /libraries/{libId}/history
func (h *Handler) CreateHistoryEntry(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	if _, err := h.db.GetLibrary(libID); err != nil {
		jsonErr(w, "library not found", http.StatusNotFound)
		return
	}
	var req createHistoryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.URL == "" {
		jsonErr(w, "url is required", http.StatusBadRequest)
		return
	}
	visitTime := req.VisitTime
	if visitTime == 0 {
		visitTime = time.Now().UnixMilli()
	}
	domain := req.Domain
	if domain == "" {
		domain = req.URL
	}
	entry := db.HistoryEntry{
		ID:          idOrNew(req.ID),
		LibraryID:   libID,
		URL:         req.URL,
		Title:       req.Title,
		VisitTime:   visitTime,
		Domain:      domain,
		IsImportant: req.IsImportant,
	}
	if err := h.db.UpsertHistoryEntry(entry); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, entry)
}

// ─── Downloads ────────────────────────────────────────────────────────────────

// ListDownloads godoc — GET /libraries/{libId}/downloads
func (h *Handler) ListDownloads(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	items, err := h.db.ListDownloads(libID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, items)
}

type createDownloadReq struct {
	ID           string  `json:"id,omitempty"`
	Filename     string  `json:"filename"`
	URL          string  `json:"url"`
	MimeType     *string `json:"mimeType,omitempty"`
	FileSize     *int64  `json:"fileSize,omitempty"`
	DownloadedAt int64   `json:"downloadedAt"`
	State        string  `json:"state"`
	Notes        string  `json:"notes"`
}

// CreateDownload godoc — POST /libraries/{libId}/downloads
func (h *Handler) CreateDownload(w http.ResponseWriter, r *http.Request) {
	libID := r.PathValue("libId")
	if _, err := h.db.GetLibrary(libID); err != nil {
		jsonErr(w, "library not found", http.StatusNotFound)
		return
	}
	var req createDownloadReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.URL == "" {
		jsonErr(w, "url is required", http.StatusBadRequest)
		return
	}
	downloadedAt := req.DownloadedAt
	if downloadedAt == 0 {
		downloadedAt = time.Now().UnixMilli()
	}
	state := req.State
	if state == "" {
		state = "complete"
	}
	dl := db.Download{
		ID:           idOrNew(req.ID),
		LibraryID:    libID,
		Filename:     req.Filename,
		URL:          req.URL,
		MimeType:     req.MimeType,
		FileSize:     req.FileSize,
		DownloadedAt: downloadedAt,
		State:        state,
		Notes:        req.Notes,
	}
	if err := h.db.CreateDownload(dl); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, dl)
}

// ─── Delete handlers ───────────────────────────────────────────────────────────

// DeleteBookmark godoc — DELETE /libraries/{libId}/bookmarks/{id}
// Also removes child bookmarks via ON DELETE CASCADE in the schema.
func (h *Handler) DeleteBookmark(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.db.DeleteBookmark(id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteHistoryEntry godoc — DELETE /libraries/{libId}/history/{id}
func (h *Handler) DeleteHistoryEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.db.DeleteHistoryEntry(id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteDownload godoc — DELETE /libraries/{libId}/downloads/{id}
func (h *Handler) DeleteDownload(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.db.DeleteDownload(id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
