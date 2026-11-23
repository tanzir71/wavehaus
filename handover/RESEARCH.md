# Research summary (Nov 2026)

## Existing self-hosted music servers

| Project | Stack you run | Upload from the web UI | Phone listening | Fit for this brief |
|---|---|---|---|---|
| **Navidrome** | Go binary or Docker; scans a music folder | **No, by design.** The FAQ points to FileBrowser and similar tools | Web UI + Subsonic apps | Great streamer. Needs a VPS/home server and a separate upload path |
| **Koel** | PHP + Laravel + Composer + DB (MySQL/Postgres/SQLite), Node to build | Yes, for admins | Web UI, Koel Player app | Closest in spirit (PHP). Heavier install, admin-only upload, no auto-organise |
| **Funkwhale** | Django, Postgres, Redis, Celery; usually Docker | Yes (libraries per user) | Web + Subsonic apps | Federated and powerful, far from "minimal" |
| **Ampache** | PHP + **MySQL/MariaDB** (PDO_MYSQL, intl) | Yes, when the admin enables "Allow users to upload media" with an upload catalog and access level | Web + Ampache/Subsonic apps | **Closest prior art on shared hosting.** Needs MySQL setup and catalog scans; classic UI; not Android-first; no client-side organise |
| Jellyfin / Plex | .NET / proprietary server, transcoding | Not really (media server) | Native apps | Overkill; needs an always-on machine |
| Subsonic family (Airsonic, gonic) | Java/Go servers | No | Subsonic apps | Same gap as Navidrome |

**Gap Wavehaus fills:** no server runs on a $3 PHP host **or** Cloudflare's free/paid tiers with zero database setup (SQLite or D1), **and** treats phone uploads (share sheet, resumable) plus phone background listening as the core flow, **and** auto-organises messy folders in the browser. The Subsonic-app route gives background play, but only through native apps and with no upload path.

## Platform constraints that shaped the design

- **Shared hosting:** no long-running processes and often no `exec`, so no ffmpeg, no transcoding and no background workers. Request limits come from `upload_max_filesize`, `post_max_size` and `max_execution_time`, hence chunked uploads. LiteSpeed's internal redirect header makes streaming cheap.
- **Cloudflare Workers:** about 10 ms CPU per request on Free, so hashing is expensive. Request bodies are capped (100 MB on Free/Pro), so we use R2 multipart. D1 is SQLite-compatible, so migrations are shared with the PHP backend.
- **Web background audio:**
  - iOS runs every browser on WebKit, and pages and home-screen web apps can be suspended in the background.
  - Android Chrome generally keeps `<audio>` playing, with a media notification via Media Session.
  - Brave adds explicit settings: Android Settings → Media → Background play, and iOS Settings → Media → Enable Background Audio.
  - Hence the Brave route plus a self-test, instead of a native wrapper.
- **Media Session API** gives lock-screen and notification controls and artwork on Android, iOS (Safari 15+) and desktop. **Audio Session API** (`navigator.audioSession.type = 'playback'`) is available in Safari 17+.
- **Web Share Target** (Android Chrome/Brave, installed PWA) lets other apps share audio files straight into Wavehaus.
- **Client-side parsing:** `music-metadata` parses ID3/Vorbis/MP4/FLAC tags and covers in the browser. `decodeAudioData` produces peaks, so no server decoding is needed.

## Sources (re-verify before publishing claims)

- Navidrome FAQ, "How can I upload music to Navidrome?": https://www.navidrome.org/docs/faq/
- Koel docs (installation requirements, uploading): https://docs.koel.dev/
- Funkwhale docs (architecture, libraries/uploads): https://docs.funkwhale.audio/
- Ampache requirements (PHP 8.1+, PDO_MYSQL, MySQL/MariaDB) and uploads (`upload_access_level`, Allow users to upload media): https://github.com/ampache/ampache and its wiki
- Brave: Settings → Media (Background play / Enable Background Audio), as provided by the product owner and the Brave help centre: https://brave.com/
- MDN Media Session API: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- MDN Web Share Target: https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target
- W3C Audio Session: https://w3c.github.io/audio-session/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- R2 multipart uploads: https://developers.cloudflare.com/r2/objects/multipart-objects/
- music-metadata: https://github.com/Borewit/music-metadata · MiniSearch: https://github.com/lucaong/minisearch
- Cover Art Archive (artwork lookups by assistants): https://coverartarchive.org/
- Self-hosted proof-of-work pattern (inspiration, not a dependency): https://altcha.org/
