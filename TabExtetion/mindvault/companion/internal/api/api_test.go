package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mindvault/companion/internal/api"
	"github.com/mindvault/companion/internal/db"
)

const testToken = "test-secret-token-for-e2e"

// newTestServer creates a httptest.Server backed by an in-memory DB.
// It seeds one library, one session, and two tabs, then returns the server
// and the seeded library/session IDs.
func newTestServer(t *testing.T) (*httptest.Server, *db.DB, string, string) {
	t.Helper()

	database, err := db.OpenInMemory()
	if err != nil {
		t.Fatalf("OpenInMemory: %v", err)
	}
	if err := database.Migrate(); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	now := time.Now().UnixMilli()
	libID := "lib-e2e-001"
	sessID := "sess-e2e-001"
	sid := sessID

	if err := database.CreateLibrary(db.Library{
		ID: libID, Name: "E2E Library",
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatalf("seed library: %v", err)
	}
	if err := database.CreateSession(db.Session{
		ID: sessID, LibraryID: libID, Name: "E2E Session",
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatalf("seed session: %v", err)
	}
	for _, row := range []struct{ id, url, title string }{
		{"tab-e2e-001", "https://go.dev", "The Go Programming Language"},
		{"tab-e2e-002", "https://sqlite.org", "SQLite Home Page"},
	} {
		if err := database.CreateTab(db.Tab{
			ID:        row.id,
			LibraryID: libID,
			SessionID: &sid,
			URL:       row.url,
			Title:     row.title,
			SavedAt:   now,
		}); err != nil {
			t.Fatalf("seed tab %s: %v", row.id, err)
		}
	}

	router := api.NewRouter(database, testToken)
	srv := httptest.NewServer(router)
	t.Cleanup(func() {
		srv.Close()
		database.Close()
	})
	return srv, database, libID, sessID
}

func post(t *testing.T, srv *httptest.Server, path, token string, body any) *http.Response {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, srv.URL+path, bytes.NewReader(b))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("X-MindVault-Token", token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	return resp
}

func get(t *testing.T, srv *httptest.Server, path, token string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if token != "" {
		req.Header.Set("X-MindVault-Token", token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	return resp
}

// ---- Tests ------------------------------------------------------------------

func TestHealthNoAuth(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := get(t, srv, "/health", "") // no token needed
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	resp.Body.Close()

	if body["status"] != "ok" {
		t.Errorf("want status=ok, got %v", body["status"])
	}
}

func TestAuthRequired(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := get(t, srv, "/libraries", "") // no token
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestWrongToken(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := get(t, srv, "/libraries", "wrong-token")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestListLibraries(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := get(t, srv, "/libraries", testToken)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var libs []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&libs); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if len(libs) != 1 {
		t.Fatalf("want 1 library, got %d", len(libs))
	}
	if libs[0]["id"] != libID {
		t.Errorf("want id=%q, got %v", libID, libs[0]["id"])
	}
	if libs[0]["name"] != "E2E Library" {
		t.Errorf("want name=E2E Library, got %v", libs[0]["name"])
	}
}

func TestGetLibrary(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := get(t, srv, "/libraries/"+libID, testToken)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var lib map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&lib); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if lib["id"] != libID {
		t.Errorf("want id=%q, got %v", libID, lib["id"])
	}
}

func TestGetLibraryNotFound(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := get(t, srv, "/libraries/does-not-exist", testToken)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("want 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestListSessions(t *testing.T) {
	srv, _, libID, sessID := newTestServer(t)

	resp := get(t, srv, "/libraries/"+libID+"/sessions", testToken)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var sessions []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if len(sessions) != 1 {
		t.Fatalf("want 1 session, got %d", len(sessions))
	}
	if sessions[0]["id"] != sessID {
		t.Errorf("want id=%q, got %v", sessID, sessions[0]["id"])
	}
}

func TestListTabs(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := get(t, srv, "/libraries/"+libID+"/tabs", testToken)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var tabs []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tabs); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if len(tabs) != 2 {
		t.Fatalf("want 2 tabs, got %d", len(tabs))
	}
}

func TestSearchTabs(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := get(t, srv, "/search?libId="+libID+"&q=sqlite", testToken)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var results []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if len(results) != 1 {
		t.Fatalf("want 1 search result for 'sqlite', got %d", len(results))
	}
	if results[0]["url"] != "https://sqlite.org" {
		t.Errorf("want sqlite.org, got %v", results[0]["url"])
	}
}

func TestVersionEndpoint(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := get(t, srv, "/version", "") // no auth needed
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

// ---- POST /libraries --------------------------------------------------------

func TestCreateLibrary(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := post(t, srv, "/libraries", testToken, map[string]any{
		"name":        "New Library",
		"description": "Created via API",
		"isEncrypted": false,
	})
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var lib map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&lib); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if lib["name"] != "New Library" {
		t.Errorf("want name=New Library, got %v", lib["name"])
	}
	if lib["id"] == "" || lib["id"] == nil {
		t.Error("want non-empty id")
	}
	if lib["createdAt"] == nil {
		t.Error("want createdAt set")
	}
}

func TestCreateLibraryMissingName(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := post(t, srv, "/libraries", testToken, map[string]any{
		"isEncrypted": false,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("want 400, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestCreateLibraryNoAuth(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := post(t, srv, "/libraries", "", map[string]any{"name": "Lib"})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

// ---- POST /libraries/{libId}/sessions ---------------------------------------

func TestCreateSession(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := post(t, srv, "/libraries/"+libID+"/sessions", testToken, map[string]any{
		"name":  "New Session",
		"notes": "test notes",
	})
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var sess map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&sess); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if sess["name"] != "New Session" {
		t.Errorf("want name=New Session, got %v", sess["name"])
	}
	if sess["libraryId"] != libID {
		t.Errorf("want libraryId=%q, got %v", libID, sess["libraryId"])
	}
	if sess["id"] == "" || sess["id"] == nil {
		t.Error("want non-empty id")
	}
}

func TestCreateSessionMissingName(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := post(t, srv, "/libraries/"+libID+"/sessions", testToken, map[string]any{
		"notes": "no name",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("want 400, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestCreateSessionLibraryNotFound(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := post(t, srv, "/libraries/no-such-lib/sessions", testToken, map[string]any{
		"name": "Orphan",
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("want 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

// ---- POST /libraries/{libId}/tabs -------------------------------------------

func TestCreateTab(t *testing.T) {
	srv, _, libID, sessID := newTestServer(t)

	resp := post(t, srv, "/libraries/"+libID+"/tabs", testToken, map[string]any{
		"sessionId": sessID,
		"url":       "https://example.com",
		"title":     "Example",
		"notes":     "",
	})
	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var tab map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tab); err != nil {
		t.Fatalf("decode: %v", err)
	}
	resp.Body.Close()

	if tab["url"] != "https://example.com" {
		t.Errorf("want url=https://example.com, got %v", tab["url"])
	}
	if tab["libraryId"] != libID {
		t.Errorf("want libraryId=%q, got %v", libID, tab["libraryId"])
	}
	if tab["id"] == "" || tab["id"] == nil {
		t.Error("want non-empty id")
	}
}

func TestCreateTabMissingURL(t *testing.T) {
	srv, _, libID, _ := newTestServer(t)

	resp := post(t, srv, "/libraries/"+libID+"/tabs", testToken, map[string]any{
		"title": "No URL",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("want 400, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestCreateTabLibraryNotFound(t *testing.T) {
	srv, _, _, _ := newTestServer(t)

	resp := post(t, srv, "/libraries/no-such-lib/tabs", testToken, map[string]any{
		"url":   "https://example.com",
		"title": "Orphan",
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("want 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}
