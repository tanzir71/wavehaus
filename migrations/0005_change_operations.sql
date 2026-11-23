-- A single user action can edit hundreds of rows. Keep its operation snapshots
-- in child rows so the audit entry stays below D1's 2 MB row/string limit.
-- Existing changes.ops JSON remains readable for released upload/artwork logs.
CREATE TABLE change_ops (
  change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  table_name TEXT NOT NULL CHECK (table_name IN ('tracks','albums','artists','playlists','playlist_items','likes','moments')),
  row_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  PRIMARY KEY (change_id, position)
) WITHOUT ROWID;
CREATE INDEX change_ops_row ON change_ops(table_name, row_id);
ALTER TABLE changes ADD COLUMN undoable INTEGER NOT NULL DEFAULT 1;
-- A conditional marker gates every statement in a D1 batch. It is removed
-- inside that same atomic batch; no pending work is stored here.
CREATE TABLE mutation_guards (id TEXT PRIMARY KEY);
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(5,'0005_change_operations.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
