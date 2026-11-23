-- Display metadata belongs to the uploader, even when the artist dictionary
-- has a differently capitalised canonical name.
ALTER TABLE albums ADD COLUMN artist_name TEXT;
UPDATE albums SET artist_name=(SELECT name FROM artists WHERE artists.id=albums.artist_id);
-- A non-unique identity supports deliberately separate imports. merge_key
-- remains the unique storage/group key, optionally salted for a new import.
ALTER TABLE albums ADD COLUMN identity_key TEXT;
UPDATE albums SET identity_key=merge_key;
CREATE INDEX albums_owner_identity ON albums(owner_id,identity_key) WHERE deleted=0;
-- Only public -> private transitions set hidden_rev. Never-public private
-- uploads must not disclose their IDs to another member's delta sync.
ALTER TABLE tracks ADD COLUMN hidden_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE albums ADD COLUMN hidden_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE playlists ADD COLUMN hidden_rev INTEGER NOT NULL DEFAULT 0;
CREATE INDEX tracks_hidden_rev ON tracks(hidden_rev) WHERE visibility='private';
CREATE INDEX albums_hidden_rev ON albums(hidden_rev) WHERE visibility='private';
CREATE INDEX playlists_hidden_rev ON playlists(hidden_rev) WHERE visibility='private';
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(6,'0006_album_identity_and_visibility.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
