-- Wavehaus schema — migrations/0001_init.sql (SQLite / Cloudflare D1 compatible)
-- IDs are ULID text. Timestamps are integer milliseconds since epoch (UTC).
-- `rev` is a global monotonically increasing integer (see table `revs`) used for delta sync.

PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);

-- Global revision counter: UPDATE revs SET n = n + 1 RETURNING n; stamp every changed row with it.
CREATE TABLE revs (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL);
INSERT INTO revs (id, n) VALUES (1, 0);

-- Key/value settings (owner-editable, survive redeploys). Values are JSON.
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
-- Seeded keys (INSERT OR IGNORE in migrations so updates never reset them):
-- registration_mode ('closed'|'invite'|'request'|'open'), default_role ('listener'|'uploader'), members_can_upload (bool),
-- default_visibility ('private'), member_quota_bytes, invites_per_member, referrals_need_approval,
-- pow_difficulty (18), rate_limit (json), max_file_bytes, library_rules (json), server_name, trusted_proxy (''|'cloudflare').

------------------------------------------------------------------ accounts
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  email TEXT,                                   -- optional, never required
  password_hash TEXT NOT NULL,                  -- PHP password_hash(ARGON2ID|BCRYPT) or "pbkdf2$sha256$<iter>$<salt>$<hash>"
  role TEXT NOT NULL CHECK (role IN ('owner','admin','uploader','listener')),
  quota_bytes INTEGER,                          -- NULL = unlimited (owner)
  used_bytes INTEGER NOT NULL DEFAULT 0,
  invites_left INTEGER NOT NULL DEFAULT 0,
  invited_by TEXT REFERENCES users(id),         -- referral attribution
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL, last_seen_at INTEGER
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,              -- sha256(raw token); raw token only in cookie
  device_label TEXT NOT NULL,                   -- "Pixel 9 · Brave", "Claude's browser"
  user_agent TEXT, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, used_at INTEGER
);

CREATE TABLE pairing_codes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,                      -- 6-digit code + 128-bit secret (QR) both hashed into this row
  secret_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,  -- "WH-7Q4K-2M9P"
  created_by TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL DEFAULT 'uploader',
  uses_left INTEGER NOT NULL DEFAULT 1, expires_at INTEGER, created_at INTEGER NOT NULL
);

CREATE TABLE access_requests (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, note TEXT,
  referral_code TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  ip_hash TEXT, created_at INTEGER NOT NULL, decided_by TEXT REFERENCES users(id), decided_at INTEGER
);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL,  -- "wh_live_3f9a"
  scopes TEXT NOT NULL,                          -- JSON array: read, upload, organise, admin
  created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
);

CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL, locked_until INTEGER);

------------------------------------------------------------------ library
CREATE TABLE artists (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_name TEXT NOT NULL, tint INTEGER NOT NULL, -- 0..5 cover tint index
  rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX artists_name ON artists(name COLLATE NOCASE) WHERE deleted = 0;

CREATE TABLE albums (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, artist_id TEXT REFERENCES artists(id), year INTEGER,
  art_source TEXT NOT NULL DEFAULT 'generated' CHECK (art_source IN ('embedded','folder','uploaded','generated')),
  art_key TEXT,                                 -- base key for /art/:albumId/{96,600}.webp, NULL if generated
  tint INTEGER NOT NULL,                        -- hash(albumArtist + album) % 6
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')), -- default for tracks added later
  sync_visibility INTEGER NOT NULL DEFAULT 1,   -- 1 = new/moved-in tracks take the album's visibility (VISIBILITY.md)
  allow_homepage INTEGER NOT NULL DEFAULT 0,    -- member opt-in: the owner/admin may showcase this album on the homepage
  folder_path TEXT,                             -- original relative folder, if any
  created_at INTEGER NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),  -- uploader
  album_id TEXT REFERENCES albums(id), artist_id TEXT REFERENCES artists(id),
  title TEXT NOT NULL, artist_name TEXT NOT NULL, album_artist TEXT, album_title TEXT,
  track_no INTEGER, disc_no INTEGER, year INTEGER, genre TEXT, bpm REAL,
  duration_ms INTEGER NOT NULL, codec TEXT, container TEXT, bitrate INTEGER, sample_rate INTEGER, bit_depth INTEGER, channels INTEGER,
  replaygain_track_db REAL, replaygain_album_db REAL,
  has_lyrics INTEGER NOT NULL DEFAULT 0, lyrics TEXT, lyrics_synced INTEGER NOT NULL DEFAULT 0,
  peaks TEXT,                                   -- base64 of 1000 uint8 peaks (0–255); NULL = not computed yet
  storage_key TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
  quick_hash TEXT NOT NULL,                     -- sha256(first 1 MB + last 1 MB + size) for duplicate pre-check
  original_name TEXT NOT NULL, original_path TEXT,
  mime TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  organise_source TEXT CHECK (organise_source IN ('tags','folder','filename','manual','assistant')),
  added_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX tracks_owner ON tracks(owner_id);
CREATE INDEX tracks_album ON tracks(album_id);
CREATE INDEX tracks_rev ON tracks(rev);
CREATE UNIQUE INDEX tracks_owner_sha ON tracks(owner_id, sha256) WHERE deleted = 0;
CREATE INDEX tracks_quick ON tracks(owner_id, quick_hash);

CREATE TABLE playlists (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','smart')), rules TEXT,  -- JSON for smart playlists (evaluated client-side)
  cover_key TEXT, visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')), -- who can see the playlist itself
  sync_visibility INTEGER NOT NULL DEFAULT 0,   -- 1 = my tracks added later become Public while the playlist is Public
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE playlist_items (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, track_id TEXT NOT NULL REFERENCES tracks(id),
  position REAL NOT NULL,                       -- fractional ordering for cheap reorders
  added_at INTEGER NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, track_id)
);

------------------------------------------------------------------ per-user listening data
CREATE TABLE likes (user_id TEXT NOT NULL, track_id TEXT NOT NULL, liked_at INTEGER NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, track_id));
CREATE TABLE plays (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, track_id TEXT NOT NULL,
  started_at INTEGER NOT NULL, ms_played INTEGER NOT NULL, completed INTEGER NOT NULL, skipped INTEGER NOT NULL,
  context TEXT,                                 -- 'album:<id>' | 'playlist:<id>' | 'autoplay' | 'radio:<seed>' | 'search'
  device_label TEXT
);
CREATE INDEX plays_user_time ON plays(user_id, started_at);
CREATE TABLE moments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, track_id TEXT NOT NULL, at_ms INTEGER NOT NULL, label TEXT, created_at INTEGER NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE player_state (user_id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL); -- queue + position JSON for "continue on this device"

------------------------------------------------------------------ uploads & change log
CREATE TABLE uploads (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, filename TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
  chunk_bytes INTEGER NOT NULL, parts_received TEXT NOT NULL DEFAULT '[]', backend_ref TEXT, -- R2 uploadId on Workers
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','complete','aborted')),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

-- Every mutation that users may want to undo writes one row per batch.
CREATE TABLE changes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  actor TEXT NOT NULL,                          -- 'web' | 'api'
  session_label TEXT, token_name TEXT,          -- "Claude's browser" / "claude-code · laptop"
  summary TEXT NOT NULL,                        -- "Organised 48 files into 4 albums"
  ops TEXT NOT NULL,                            -- JSON [{table,id,before,after}] — enough to revert
  created_at INTEGER NOT NULL, undone_at INTEGER
);
CREATE INDEX changes_user_time ON changes(user_id, created_at);

------------------------------------------------------------------ instance homepage (HOMEPAGE.md)
-- settings key `homepage` (JSON): { enabled, title, eyebrow, intro, owner, allowAnonymousPlay, showOss, githubUrl, links[] }
CREATE TABLE showcase (
  item_type TEXT NOT NULL CHECK (item_type IN ('album','playlist','track')),
  item_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0,          -- exactly one row may be featured (hero)
  added_by TEXT NOT NULL REFERENCES users(id), added_at INTEGER NOT NULL,
  PRIMARY KEY (item_type, item_id)
);
CREATE TABLE showcase_stats (item_type TEXT NOT NULL, item_id TEXT NOT NULL, day TEXT NOT NULL, plays INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (item_type, item_id, day));
