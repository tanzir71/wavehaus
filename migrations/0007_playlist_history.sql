ALTER TABLE playlist_items ADD COLUMN id TEXT;
ALTER TABLE playlist_items ADD COLUMN owner_id TEXT REFERENCES users(id);
UPDATE playlist_items SET id=playlist_id||':'||track_id,owner_id=(SELECT owner_id FROM playlists WHERE playlists.id=playlist_items.playlist_id);
CREATE UNIQUE INDEX playlist_items_id ON playlist_items(id);
CREATE INDEX playlist_items_owner ON playlist_items(owner_id,rev);
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(7,'0007_playlist_history.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
