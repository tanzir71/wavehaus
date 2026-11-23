CREATE INDEX moments_user_track ON moments(user_id,track_id,deleted,id);
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(10,'0010_moments_index.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
