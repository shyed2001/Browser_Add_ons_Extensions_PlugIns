-- Migration 002: Session extras
-- Adds source_browser (which browser saved this session) and
-- archived (soft-delete flag: 0=active, 1=archived) to the sessions table.
--
-- Both columns are backward-compatible: existing rows get safe DEFAULT values.
-- tab_count is NOT stored — computed via COUNT(saved_tabs) subquery at query time
-- so it stays accurate without requiring update triggers.
--
-- source_browser values: 'Chrome', 'Firefox', 'Edge', 'Brave', 'Opera', 'Vivaldi', ''
-- archived values: 0 = active (show normally), 1 = archived (hidden by default)

ALTER TABLE sessions ADD COLUMN source_browser TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN archived        INTEGER NOT NULL DEFAULT 0;

-- Index to speed up "show only active sessions" queries
CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(library_id, archived);
