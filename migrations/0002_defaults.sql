-- Settings live in the database. An update never resets an existing value.
ALTER TABLE recovery_codes ADD COLUMN claim_id TEXT;
ALTER TABLE pairing_codes ADD COLUMN claim_id TEXT;
CREATE UNIQUE INDEX users_one_owner ON users(role) WHERE role='owner';
INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
 ('server_name','"Wavehaus"',0),
 ('registration_mode','"closed"',0),
 ('default_role','"listener"',0),
 ('members_can_upload','true',0),
 ('default_visibility','"private"',0),
 ('member_quota_bytes','10737418240',0),
 ('invites_per_member','3',0),
 ('referrals_need_approval','false',0),
 ('pow_difficulty','18',0),
 ('max_file_bytes','2147483648',0),
 ('trusted_proxy','""',0),
 ('library_rules','{"tags":true,"folders":true,"filenames":true,"stripJunk":true,"titleCase":true}',0);

-- D1's CLI has its own migrations table. These markers also populate the
-- cross-backend schema table, in the same successful migration transaction.
INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES
 (1,'0001_init.sql',CAST(strftime('%s','now') AS INTEGER)*1000),
 (2,'0002_defaults.sql',CAST(strftime('%s','now') AS INTEGER)*1000);
