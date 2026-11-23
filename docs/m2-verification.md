# M2 verification

The automated checks use original generated tones. They do not establish physical-phone OS behavior.

- Demo, PHP and actual local Worker/D1/R2: upload init, immutable part retries, changed-part rejection, resume from a second session, early completion rejection, full SHA/size/magic verification, repeated completion, duplicate lookup and private library sync.
- Authenticated media: exact prefix/suffix ranges, HEAD, invalid range 416, ETag 304 and If-Range fallback. Signed-out media and artwork return 401.
- Artwork: invalid image signatures rejected, generated PNG and 600/96 WebP stored, source and revision synced. No server image decoder is required.
- PHP and Worker browser flows: real tag parsing, folder artwork and LRC attachment, immediate local insertion and a second session seeing the private album within 60 seconds.
- Large-file acceptance: a valid 300 MiB FLAC, throttled to 2 MiB/s with 40 ms latency, survives reload on Android 412×915 emulation. Confirmed chunks are not resent; exactly one private track appears on the second session with the correct SHA. PHP completed in about 3.3 minutes; local Worker/R2 in about 3.7 minutes. The generated artifact stays in ignored `.work/`.
- The large FLAC's decoded PCM independently matches the tiny source. The ALAC/M4A fixture's packets were independently decoded with libsndfile and exactly match their generated PCM. The installed Chromium cannot decode ALAC; upload/tag support preserves original formats and does not promise codec playback on every browser.
- Pages browser flows: the six-format folder import, duplicate override, wake-switch state, Public confirmation and a simulated service-worker share-target POST. OS-level Android share-sheet delivery remains unverified.
- Migration 0004: fresh and M1-upgraded PHP/D1 schemas match; removed visitor tables/column remain absent. Native DROP COLUMN and the old-PHP-SQLite table rebuild preserve album/track/settings data and foreign keys. Repeated application is idempotent; released migrations 0001/0002 are untouched.
- Release archives: independent ZIP validation and two code overwrites preserve users, settings, sessions, secret, media and player state. Owner reset, password rehash, private routing and protected fallback-data discovery pass.
- Lighthouse 13.6.0: Home, Now Playing, Upload, sign-in and Settings accessibility 100, with no zero-score audits. Chromium reports no installability errors. See `m2-lighthouse.json`.

The Worker uses native streaming WebCrypto, immutable R2 staging and multipart assembly. Staging costs temporary storage and extra R2 operations. Completion heartbeats are limited to one per 30 seconds so large files do not consume one D1 query per chunk. SQL JSON snapshots are built in groups within D1's 32-argument function limit, preserving null values. These constraints are based on the [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [WebCrypto documentation](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/); local emulation does not certify a live account's CPU allowance.

Physical Android Brave/Chrome sharing and screen-lock tests, plus iOS best-effort checks, remain for the owner's device matrix. Playback hardening is M3; the dedicated Brave route is M5.
