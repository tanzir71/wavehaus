-- Scope correction: visitor websites are outside Wavehaus. M1 already shipped
-- 0002_defaults.sql, so this must be a new version, not another 0002 migration.
DROP TABLE IF EXISTS showcase_stats;
DROP TABLE IF EXISTS showcase;
ALTER TABLE albums DROP COLUMN allow_homepage;
DELETE FROM settings WHERE key='homepage';
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(4,'0004_drop_showcase.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
