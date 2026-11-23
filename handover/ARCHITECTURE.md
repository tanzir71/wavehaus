# Architecture

```
┌──────────────── Browser (PWA) ─────────────────┐        ┌──── Backend A: shared hosting ────┐
│ UI (Preact)  ─ engine (<audio>, MediaSession)  │  HTTPS │ PHP 8.1+ front controller          │
│ IndexedDB library cache ─ search worker        │◀──────▶│ SQLite (PDO) · files on disk       │
│ recommendations worker ─ upload pipeline       │  JSON  │ .htaccess routing, Range streaming │
│ (tags, covers, peaks, organise, chunking)      │  +     └────────────────────────────────────┘
│ service worker (shell, offline audio, share)   │  bytes ┌──── Backend B: Cloudflare ─────────┐
└────────────────────────────────────────────────┘        │ Worker (TS) · D1 · R2 · static     │
                                                           └────────────────────────────────────┘
```

Both backends implement the same `API.md` contract and the same `/migrations/*.sql` schema. A third, **in-browser demo backend** implements the same contract too, so the app can be previewed on GitHub Pages with no server. The PWA never knows which one it talks to.

## Demo backend (GitHub Pages preview, `app/src/demo/`)

Purpose: every milestone is reviewable at `https://tanzir71.github.io/wavehaus/app/`, which is static hosting only.

- **Selection.** The build flag `VITE_BACKEND=demo` swaps `src/api/http.ts` for `src/demo/index.ts`. Both export the same typed `Api` interface; the `ui`, `engine` and `library` code import only that interface.
- **Storage:**
  - Rows live in IndexedDB, in the same shape as `schema.sql`, with a local `rev` counter.
  - Audio and art blobs live in OPFS (`navigator.storage.getDirectory()`), falling back to IndexedDB.
- **Media.** The service worker answers `…/app/demo-media/:trackId` from OPFS with full **Range / 206** support. This is the same code path as offline downloads, so background playback is exercised exactly as in production.
- **Seed** (first run):
  - 3 albums × 4–6 tracks, generated on device: an OfflineAudioContext pad/arpeggio rendered to WAV, 30–60 s each.
  - Waveform peaks and generated covers.
  - A couple of moments and likes.
  - Takes about 2 s on a mid phone, with a "Preparing demo library…" skeleton.
- **Auth.** Auto signed in as the owner "demo". Setup, recovery codes, invites and requests are all simulated locally, so the screens are reviewable. A persistent banner reads "Demo mode: everything stays in this browser."
- **Uploads** run the real pipeline (tags, covers, peaks, organise) and store the blobs locally. Nothing leaves the device.
- **Contract tests** run against the demo through a `fetch` shim (`tests/api/demo-shim.ts`), so the demo cannot drift from `API.md`.
- **Base path.** Pages serves under `/wavehaus/`:
  - Vite `base: '/wavehaus/app/'`
  - `manifest.webmanifest` `start_url: "./?source=homescreen"`, `scope: "./"` (relative)
  - service worker registered with `scope: './'`
  - every internal link relative to `import.meta.env.BASE_URL`

  A production build uses base **`/app/`**, because `/` is the instance homepage (`HOMEPAGE.md`).

## Routes on a deployed server (one origin)

| Path | Served by |
|---|---|
| `/` | Instance homepage: server-rendered template + `home.js` (reuses `app/src/engine`) |
| `/app/*` | The PWA (`app/dist`). SPA fallback to `/app/index.html`; manifest scope and service worker scope `/app/` |
| `/join/:code`, `/pair`, `/setup` | Redirect into `/app/…` routes |
| `/api/*`, `/media/*`, `/art/*` | API (`API.md`). Anonymous access only for showcased items |
| `/share-target` | The app's service worker (`/app/` scope) handles it; the manifest `action` is `/app/share-target` |

The session cookie is `Path=/`, so the homepage knows whether to show Sign in or Open the app.

## Frontend

- Vite + Preact + TypeScript + `@preact/signals`. Plain CSS with `tokens.css`. Fonts: Geist, Geist Mono (OFL, self-hosted woff2, `font-display: swap`).
- Routing: tiny hash-free router over `history` (paths in `SPEC.md`). Server serves `index.html` for unknown non-API paths.
- State: signals for UI; **IndexedDB** (`idb-keyval` stores) is the source of truth for the library on device.
- Workers: `search.worker.ts` (MiniSearch index), `recs.worker.ts` (mixes/radio), `pow.worker.ts` (proof-of-work for sign-up).
- Layout breakpoints: `< 720px` mobile (bottom nav + mini player), `720–1099px` tablet (icon rail + mini player), `≥ 1100px` desktop (264px sidebar + 88px player bar).
- Browser targets: Android Chrome/Brave (current − 2), desktop Chrome/Edge/Firefox/Safari (current − 2), iOS Safari/Brave 17+ (best effort).

## Library sync

- Initial: `GET /api/library?since=0` streams pages of rows (tracks, albums, artists, playlists, playlist_items, likes, moments) the user can see.
- Incremental: client stores `cursor` (monotonic `rev` integer from the server). `GET /api/library?since=<rev>` returns changed rows + tombstones (`deleted=1`). Poll on focus and every 60 s while visible; also after any mutation.
- The server enforces the visibility rule: rows where `owner_id = me OR visibility = 'public'`.
- Rows that became invisible since `since` come back in `hidden`. The client deletes them locally and purges any offline copies (`VISIBILITY.md`).
- 20k tracks ≈ 8 MB JSON (≈1.5 MB gzip) once, then deltas only.

## Media

- Files are stored by content key: `media/<k0k1>/<sha256>.<ext>` (shared hosting) or R2 key `m/<sha256>.<ext>`. Original filenames are metadata only.
- `GET /media/:trackId` → authorises (session or signed short URL), then serves with `Accept-Ranges: bytes`, `206` for ranges, correct `Content-Type`, `Cache-Control: private, max-age=31536000, immutable` (content-addressed).
  - PHP: if LiteSpeed is detected, respond with `X-LiteSpeed-Location` (internal redirect to the protected path); if Apache has `mod_xsendfile`, `X-Sendfile`; otherwise stream with `fopen/fseek/fread` in 256 KB chunks honouring `Range`. Media dir is outside web root or denied via `.htaccess`.
  - Worker: `env.MEDIA.get(key, { range })` → stream body; set `Content-Range`.
- Artwork: `GET /art/:albumId/:size.webp` (`96`, `600`) and `GET /art/:albumId/generated-512.png` (rendered client-side at upload, used for Media Session when no real art).
- Audio URLs used by `<audio>` must be same-origin and cookie-authorised (no tokens in query strings; see `AUTH.md`).

## Uploads

Chunked, resumable, identical on both backends (details in `ORGANISE.md`, contract in `API.md`). Default chunk 8 MB; server returns its max chunk size computed from `upload_max_filesize`/`post_max_size` (PHP) or a 90 MB cap (Workers 100 MB body limit). Parts land in `data/tmp/<uploadId>/<n>.part` (PHP) or an R2 multipart upload (Worker). `complete` verifies size + SHA-256, moves to the content key, inserts the track.

## Data & redeploy safety

```
shared hosting:  ~/public_html/music/            ← app (replaced on every update)
                 ~/wavehaus-data/                ← data (never touched by updates)
                     wavehaus.sqlite  media/  art/  tmp/  config.php
```

- If the host can't place data outside `public_html`, use `public_html/music/data/` with a deny-all `.htaccess` and a random directory suffix.
- `config.php` is generated by `/setup` and holds only `DATA_DIR` + secrets (cookie key). Everything else is in the `settings` table.
- Cloudflare: D1 database + R2 bucket persist across `wrangler deploy`.
- **Migrations:** `/migrations/NNNN_name.sql`, forward-only, each wrapped in a transaction, recorded in `schema_migrations(version, applied_at)`. PHP applies pending migrations on the first request after an update (file lock to avoid races); Worker applies via `wrangler d1 migrations apply` in the deploy script and checks `schema_migrations` at runtime (returns 503 with a clear message if behind). Never edit an applied migration.
- Before migrating, PHP copies `wavehaus.sqlite` to `backups/wavehaus-<version>-<ts>.sqlite` (keep last 5).

## Service worker (`/sw.js`, hand-written)

- Precache app shell (versioned). Network-first for `/api/*`. Never cache `/api/*` responses.
- Offline audio: when a track is downloaded, store the full response in `cache: wh-audio-v1` keyed by `/media/:id`. On fetch with `Range`, slice the cached blob and synthesise `206` with `Content-Range` (required for seeking; see `PLAYBACK.md`).
- Share target: intercept `POST /share-target` (multipart), stash files in IndexedDB (`pendingShares`), `303` → `/upload?shared=1`.
- Call `navigator.storage.persist()` after the first download.

## Security baseline

- Cookies: `__Host-wh_session` (HttpOnly, Secure, SameSite=Lax, Path=/).
- CSRF: all mutating requests must send header `X-Wavehaus: 1` (forms are JS-driven); reject if missing. SameSite=Lax blocks cross-site POST cookies anyway.
- Headers: `Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(self)` (QR scan).
- Upload validation: extension allow-list + magic-byte sniff (ID3/`fLaC`/`OggS`/`ftyp`/`RIFF…WAVE`), size cap, per-user quota.
- All IDs are ULIDs. All SQL is parameterised.

## Why no server-side processing

Shared hosting forbids long-running processes and often `exec()`. Workers have 10 ms CPU on the free plan. So everything CPU-heavy (decode for peaks, tag parsing, image resizing, hashing, recommendation maths) happens in the browser that already has the file in memory. The server is a dumb, safe store.
