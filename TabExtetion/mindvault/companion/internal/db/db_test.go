package db

import (
	"testing"
	"time"
)

// seed inserts a minimal library + session + 2 tabs into db.
func seed(t *testing.T, d *DB) (libID, sessID string) {
	t.Helper()
	now := time.Now().UnixMilli()
	libID = "lib-test-001"
	sessID = "sess-test-001"

	if err := d.CreateLibrary(Library{
		ID:          libID,
		Name:        "Test Library",
		CreatedAt:   now,
		UpdatedAt:   now,
		IsEncrypted: false,
	}); err != nil {
		t.Fatalf("CreateLibrary: %v", err)
	}

	if err := d.CreateSession(Session{
		ID:        sessID,
		LibraryID: libID,
		Name:      "Morning tabs",
		Notes:     "",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	sid := sessID
	for i, row := range []struct{ id, url, title string }{
		{"tab-001", "https://example.com", "Example Domain"},
		{"tab-002", "https://go.dev/doc", "Go Documentation"},
	} {
		_ = i
		if err := d.CreateTab(Tab{
			ID:        row.id,
			LibraryID: libID,
			SessionID: &sid,
			URL:       row.url,
			Title:     row.title,
			SavedAt:   now,
			Notes:     "",
		}); err != nil {
			t.Fatalf("CreateTab %s: %v", row.id, err)
		}
	}
	return libID, sessID
}

func TestOpenInMemory(t *testing.T) {
	d, err := OpenInMemory()
	if err != nil {
		t.Fatalf("OpenInMemory: %v", err)
	}
	defer d.Close()

	if err := d.Migrate(); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
}

func TestCreateAndListLibraries(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()
	_ = d.Migrate()

	libID, _ := seed(t, d)

	libs, err := d.ListLibraries()
	if err != nil {
		t.Fatalf("ListLibraries: %v", err)
	}
	if len(libs) != 1 {
		t.Fatalf("want 1 library, got %d", len(libs))
	}
	if libs[0].ID != libID {
		t.Errorf("want ID %q, got %q", libID, libs[0].ID)
	}
	if libs[0].Name != "Test Library" {
		t.Errorf("want name 'Test Library', got %q", libs[0].Name)
	}
}

func TestGetLibrary(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()
	_ = d.Migrate()

	libID, _ := seed(t, d)

	lib, err := d.GetLibrary(libID)
	if err != nil {
		t.Fatalf("GetLibrary: %v", err)
	}
	if lib.ID != libID {
		t.Errorf("want %q, got %q", libID, lib.ID)
	}
}

func TestGetLibraryNotFound(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()
	_ = d.Migrate()

	_, err := d.GetLibrary("nonexistent")
	if err == nil {
		t.Fatal("expected error for missing library, got nil")
	}
}

func TestListSessions(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()
	_ = d.Migrate()

	libID, sessID := seed(t, d)

	sessions, err := d.ListSessions(libID, false)
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("want 1 session, got %d", len(sessions))
	}
	if sessions[0].ID != sessID {
		t.Errorf("want session ID %q, got %q", sessID, sessions[0].ID)
	}
	if sessions[0].Name != "Morning tabs" {
		t.Errorf("want name 'Morning tabs', got %q", sessions[0].Name)
	}
}

func TestListTabs(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()
	_ = d.Migrate()

	libID, _ := seed(t, d)

	tabs, err := d.ListTabs(libID)
	if err != nil {
		t.Fatalf("ListTabs: %v", err)
	}
	if len(tabs) != 2 {
		t.Fatalf("want 2 tabs, got %d", len(tabs))
	}
}

func TestSearch(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()
	_ = d.Migrate()

	libID, _ := seed(t, d)

	results, err := d.Search(libID, "example")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("want 1 result for 'example', got %d", len(results))
	}
	if results[0].URL != "https://example.com" {
		t.Errorf("want example.com, got %q", results[0].URL)
	}
}

func TestMigrateIdempotent(t *testing.T) {
	d, _ := OpenInMemory()
	defer d.Close()

	for i := 0; i < 3; i++ {
		if err := d.Migrate(); err != nil {
			t.Fatalf("Migrate (run %d): %v", i+1, err)
		}
	}
}
