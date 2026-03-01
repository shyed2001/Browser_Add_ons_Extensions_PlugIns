-- MindVault companion daemon — initial SQLite schema
-- Mirrors the IndexedDB schema used by the browser extension.
-- All foreign key constraints enforced by SQLite (FK pragma must be ON).

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    applied_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS libraries (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    is_encrypted  INTEGER NOT NULL DEFAULT 0,  -- SQLite uses INTEGER for bool
    password_salt TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_library ON sessions(library_id);

CREATE TABLE IF NOT EXISTS saved_tabs (
    id           TEXT PRIMARY KEY,
    library_id   TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    session_id   TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    url          TEXT NOT NULL,
    title        TEXT NOT NULL,
    fav_icon_url TEXT,
    saved_at     INTEGER NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    colour       TEXT CHECK(colour IN ('R','G','Y','B') OR colour IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_tabs_library   ON saved_tabs(library_id);
CREATE INDEX IF NOT EXISTS idx_tabs_session   ON saved_tabs(session_id);
CREATE INDEX IF NOT EXISTS idx_tabs_colour    ON saved_tabs(colour);

CREATE TABLE IF NOT EXISTS bookmarks (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    parent_id   TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    url         TEXT,
    notes       TEXT NOT NULL DEFAULT '',
    colour      TEXT CHECK(colour IN ('R','G','Y','B') OR colour IS NULL),
    created_at  INTEGER NOT NULL,
    is_folder   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_library ON bookmarks(library_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_parent  ON bookmarks(parent_id);

CREATE TABLE IF NOT EXISTS history_entries (
    id           TEXT PRIMARY KEY,
    library_id   TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    url          TEXT NOT NULL,
    title        TEXT,
    visit_time   INTEGER NOT NULL,
    domain       TEXT NOT NULL,
    is_important INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_history_library ON history_entries(library_id);
CREATE INDEX IF NOT EXISTS idx_history_domain  ON history_entries(domain);

CREATE TABLE IF NOT EXISTS downloads (
    id            TEXT PRIMARY KEY,
    library_id    TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    url           TEXT NOT NULL,
    mime_type     TEXT,
    file_size     INTEGER,
    downloaded_at INTEGER NOT NULL,
    state         TEXT NOT NULL CHECK(state IN ('in_progress','complete','error')),
    notes         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_downloads_library   ON downloads(library_id);
CREATE INDEX IF NOT EXISTS idx_downloads_mime_type ON downloads(mime_type);

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    colour      TEXT,
    created_at  INTEGER NOT NULL,
    UNIQUE(library_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_library ON tags(library_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    action      TEXT NOT NULL CHECK(action IN ('CREATE','UPDATE','DELETE')),
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    timestamp   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_library ON audit_log(library_id);

-- Full-text search virtual table (FTS5) over tabs and bookmarks
CREATE VIRTUAL TABLE IF NOT EXISTS tabs_fts USING fts5 (
    title,
    url,
    notes,
    content='saved_tabs',
    content_rowid='rowid'
);
