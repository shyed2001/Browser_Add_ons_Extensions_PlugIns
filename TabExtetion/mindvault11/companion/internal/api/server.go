// Package api provides the HTTP router and middleware for the REST API.
package api

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"

	"github.com/mindvault/companion/internal/api/handlers"
	"github.com/mindvault/companion/internal/db"
)

//go:embed ui
var uiFiles embed.FS

// NewRouter creates and returns the main HTTP mux with all routes registered.
func NewRouter(database *db.DB, token string) http.Handler {
	mux := http.NewServeMux()

	h := handlers.New(database, token)

	// Auth middleware wraps every route
	protected := authMiddleware(token)

	// Health + token bootstrap (no auth required)
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("GET /version", h.Version)
	mux.HandleFunc("GET /token", h.GetToken) // extension fetches this on startup to bootstrap auth

	// Libraries
	mux.Handle("GET /libraries", protected(http.HandlerFunc(h.ListLibraries)))
	mux.Handle("POST /libraries", protected(http.HandlerFunc(h.CreateLibrary)))
	mux.Handle("GET /libraries/{id}",    protected(http.HandlerFunc(h.GetLibrary)))
	mux.Handle("PATCH /libraries/{id}",  protected(http.HandlerFunc(h.PatchLibrary)))
	mux.Handle("DELETE /libraries/{id}", protected(http.HandlerFunc(h.DeleteLibrary)))

	// Sessions (per-library)
	mux.Handle("GET /libraries/{libId}/sessions",          protected(http.HandlerFunc(h.ListSessions)))
	mux.Handle("POST /libraries/{libId}/sessions",         protected(http.HandlerFunc(h.CreateSession)))
	mux.Handle("PATCH /libraries/{libId}/sessions/{id}",  protected(http.HandlerFunc(h.PatchSession)))
	mux.Handle("DELETE /libraries/{libId}/sessions/{id}", protected(http.HandlerFunc(h.DeleteSession)))

	// Master views (cross-library — companion UI "All Sessions" / "All Tabs" panels)
	mux.Handle("GET /sessions",    protected(http.HandlerFunc(h.ListAllSessions)))
	mux.Handle("GET /tabs",        protected(http.HandlerFunc(h.ListAllTabs)))
	// Global tab operations — no library context (used by All Tabs master view)
	mux.Handle("PATCH /tabs/{id}",  protected(http.HandlerFunc(h.PatchTab)))
	mux.Handle("DELETE /tabs/{id}", protected(http.HandlerFunc(h.DeleteTabByID)))

	// Tabs (per-library)
	mux.Handle("GET /libraries/{libId}/tabs", protected(http.HandlerFunc(h.ListTabs)))
	mux.Handle("POST /libraries/{libId}/tabs", protected(http.HandlerFunc(h.CreateTab)))
	mux.Handle("DELETE /libraries/{libId}/tabs/{id}", protected(http.HandlerFunc(h.DeleteTab)))

	// Bookmarks
	mux.Handle("GET /libraries/{libId}/bookmarks", protected(http.HandlerFunc(h.ListBookmarks)))
	mux.Handle("POST /libraries/{libId}/bookmarks", protected(http.HandlerFunc(h.CreateBookmark)))
	mux.Handle("DELETE /libraries/{libId}/bookmarks/{id}", protected(http.HandlerFunc(h.DeleteBookmark)))

	// History
	mux.Handle("GET /libraries/{libId}/history", protected(http.HandlerFunc(h.ListHistory)))
	mux.Handle("POST /libraries/{libId}/history", protected(http.HandlerFunc(h.CreateHistoryEntry)))
	mux.Handle("DELETE /libraries/{libId}/history/{id}", protected(http.HandlerFunc(h.DeleteHistoryEntry)))

	// Downloads
	mux.Handle("GET /libraries/{libId}/downloads", protected(http.HandlerFunc(h.ListDownloads)))
	mux.Handle("POST /libraries/{libId}/downloads", protected(http.HandlerFunc(h.CreateDownload)))
	mux.Handle("DELETE /libraries/{libId}/downloads/{id}", protected(http.HandlerFunc(h.DeleteDownload)))

	// Auto-start (Task Scheduler integration — Windows only)
	mux.Handle("GET /autostart",    protected(http.HandlerFunc(h.GetAutostart)))
	mux.Handle("POST /autostart",   protected(http.HandlerFunc(h.EnableAutostart)))
	mux.Handle("DELETE /autostart", protected(http.HandlerFunc(h.DisableAutostart)))

	// Search (libId optional — empty = all libraries)
	mux.Handle("GET /search", protected(http.HandlerFunc(h.Search)))

	// Sync (receive bulk data from extension)
	mux.Handle("POST /sync", protected(http.HandlerFunc(h.Sync)))

	// Companion web dashboard UI (embedded static files)
	// noCacheUI ensures browsers always revalidate UI assets after a binary update.
	// Without this, browsers serve stale app.js / style.css from their local cache
	// even after the daemon binary (and its embedded files) has been replaced.
	uiFS, _ := fs.Sub(uiFiles, "ui")
	mux.Handle("/ui/", noCacheUI(http.StripPrefix("/ui/", http.FileServer(http.FS(uiFS)))))
	// Redirect bare /ui → /ui/  and  / → /ui/
	mux.HandleFunc("/ui", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ui/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/ui/", http.StatusMovedPermanently)
		} else {
			http.NotFound(w, r)
		}
	})

	return corsMiddleware(mux)
}

// noCacheUI wraps a static-file handler to set Cache-Control: no-cache on every
// response. This forces browsers to revalidate UI assets on every request instead
// of serving them from the browser cache indefinitely. Without this, old versions
// of app.js / style.css linger after a daemon binary update.
//
// @why    Prevent stale UI assets being served from browser cache after binary update.
// @what   Sets Cache-Control header before delegating to the wrapped handler.
// @how    Middleware pattern — wraps http.Handler, adds header, calls next.ServeHTTP.
// @where  Applied only to /ui/* static file handler in NewRouter.
func noCacheUI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// no-cache: must revalidate with server; must-revalidate: no stale fallback
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		next.ServeHTTP(w, r)
	})
}

// authMiddleware validates the X-MindVault-Token header.
func authMiddleware(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-MindVault-Token") != token {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// corsMiddleware adds CORS headers to allow requests from browser extensions and
// the local web UI / PWA. Only localhost-bound, so no external CORS risk.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		// Allow Chrome, Firefox, Safari, Edge extension origins + local web origins
		if strings.HasPrefix(origin, "chrome-extension://") ||
			strings.HasPrefix(origin, "moz-extension://") ||
			strings.HasPrefix(origin, "safari-extension://") ||
			strings.HasPrefix(origin, "http://127.0.0.1") ||
			strings.HasPrefix(origin, "http://localhost") ||
			origin == "null" { // PWA installed from local
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-MindVault-Token")
		w.Header().Set("Access-Control-Allow-Credentials", "false")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
