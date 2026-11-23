-- Resumable parts are independent rows so simultaneous PUTs cannot lose a part.
ALTER TABLE uploads ADD COLUMN completed_track_id TEXT;
ALTER TABLE uploads ADD COLUMN completed_change_id TEXT;
CREATE TABLE upload_parts (
  upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  part_no INTEGER NOT NULL CHECK(part_no>=1),
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0),
  sha256 TEXT NOT NULL,
  etag TEXT,
  PRIMARY KEY(upload_id,part_no)
);
CREATE UNIQUE INDEX uploads_owner_hash_open ON uploads(user_id,sha256) WHERE status='open';
-- A short lease coordinates R2 completion without holding an HTTP transaction.
CREATE TABLE upload_claims (
  upload_id TEXT PRIMARY KEY REFERENCES uploads(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  quota_reserved INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE artists ADD COLUMN name_key TEXT;
UPDATE artists SET name_key=lower(trim(name));
CREATE UNIQUE INDEX artists_name_key ON artists(name_key) WHERE deleted=0;
ALTER TABLE albums ADD COLUMN merge_key TEXT;
CREATE UNIQUE INDEX albums_owner_merge ON albums(owner_id,merge_key) WHERE deleted=0;
INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES('upload_visibility_locked','false',0);
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(3,'0003_uploads.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
