ALTER TABLE changes ADD COLUMN undo_note TEXT;
ALTER TABLE api_tokens ADD COLUMN expires_at INTEGER;
ALTER TABLE albums ADD COLUMN last_actor TEXT;
ALTER TABLE albums ADD COLUMN last_actor_name TEXT;
CREATE INDEX api_tokens_user ON api_tokens(user_id,revoked_at);
CREATE INDEX changes_expiry ON changes(created_at);
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(9,'0009_assistant_tokens.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
