# Milestones (build in order, preview every one)

Every milestone ends the same way:
1. Merged to `main`.
2. Tagged `v0.N.0`.
3. **Deployed to GitHub Pages.** The landing is at `https://tanzir71.github.io/wavehaus/`. The app in demo mode is at `…/wavehaus/app/`.
4. `CHANGELOG.md` entry, mirroring the L5 Changelog page design.
5. A GitHub Release. From M1 on it carries the shared-hosting and Worker zips.
6. The PR description gives the preview URLs and "what to try" in three lines.

Acceptance criteria also include:
- Contract tests green on every backend built so far, including the demo adapter.
- E2E green at 412×915 (Android emulation) and 1440×900.
- Screens match the listed Figma frames.

## Scope change, 23 Nov 2026: do this before continuing M2

The page the owner's own server shows to visitors is **out of Wavehaus scope**. The owner designs and builds it as part of their own website, not this repo. Undo the pieces that M0–M2 already added:
1. Remove the `/` visitor-page route and every `/api/public/*` endpoint from `server-php/lib/router.php` and `server-worker/src/router.ts`. Signed-out requests to `/media` and `/art` must return 401 again (`AUTH.md`: no anonymous access in P0).
2. Add `migrations/0002_drop_showcase.sql`. It drops the `showcase` and `showcase_stats` tables and the `albums.allow_homepage` column (rebuild the table if the SQLite/D1 version needs it). **Never edit `0001_init.sql`**, because it has already shipped in the M1 release zips.
3. Make the production base path a build setting (`APP_BASE`, default `/`), not hard-coded `/app/` (`ARCHITECTURE.md`). The GitHub Pages preview keeps `/wavehaus/app/`.
4. Remove the related mentions from the repo `README.md`, `docs/PROGRESS.md` and the demo backend. Record the change in `CHANGELOG.md`.

**Accept:** `tests/api` is green on both backends; no route answers without a session except `/api/health`, `/api/config`, the auth endpoints and `/setup`; and a fresh install and an M1 → M2 upgrade both end with the same schema.

## M0 — Repo, landing, PWA shell, demo mode (preview on day one)

**Repo and CI**
- Create `tanzir71/wavehaus` (public, MIT). Copy the handover into `/handover`.
- Set up the monorepo layout from `AGENTS.md`. Wire `tokens.css`, self-host the Geist fonts, and add the no-italics reset.
- Workflows (`DEPLOY.md` § A):
  - `ci.yml`: lint, unit, contract, e2e.
  - `pages.yml`: `build:pages` → `actions/deploy-pages`.
  - `release.yml`: zips on tag.

**Landing**
- Static landing **and its subpages**, per `LANDING.md`:
  - L1 landing `28:171`
  - L2 docs template: shared-hosting guide `57:649`, plus the Cloudflare, Overview, Updating safely, Backups and API & assistants pages built from that template
  - L3 Background play `57:817`
  - L4 Self-hosted Spotify alternative `57:1012`
  - L5 Changelog `57:1187`
- SEO metadata, sitemap and OG image.

**PWA shell**
- Manifest with the Wave W icons from `assets/brand/`.
- Hand-written service worker. Installable from Brave on Android.
- App routes rendering the M1 Home layout with empty states.

**Demo backend** (`app/src/demo`)
- Implements `API.md` in the browser: IndexedDB for rows, OPFS (or IndexedDB) for audio blobs. The service worker serves `/media/:id` from there with Range support.
- Seeds 3 albums of **generated** music (OfflineAudioContext → WAV, 30–60 s tracks) with peaks and generated covers.
- Auto signs in as the demo owner.
- Shows a banner: "Demo mode: everything stays in this browser."
- Uploads work and stay on the device.

**Migrations runner skeleton** (PHP lock + backup; Worker deploy step).

**Accept**
- The Pages URL shows the landing and all subpages.
- `/app/` installs from Brave on Android and plays a seeded track. The 30-second background test runs (UI may be basic).
- Lighthouse on the landing scores 100 across the board.

## M1 — Setup, auth, devices, settings entry (M11 `21:1095`, D6 security, Sidebar Settings)

- Port Tack's login, register and recovery-code code (`REFERENCES.md`). Fill in its port table.
- `/setup` with recovery codes. Login/logout. Per-device sessions, device list and revoke.
- Recovery-code reset. Pairing (QR and 6-digit code). Rate limits and lockout. CSRF header. Owner reset procedure.
- **Settings entry points:**
  - desktop sidebar "Settings" item
  - mobile gear on Home and Library headers
  - avatar menu (Settings, Devices, Background play, Sign out)
- `/settings` routes render with the D5/D6 layout.
- First release zips: shared hosting and Worker.

**Accept**
- A 6th wrong password within 15 min gets 429.
- A recovery code works exactly once.
- Pairing signs in a second browser.
- The cookie is HttpOnly, Secure and `__Host-`.
- Settings is reachable in one tap from Home on mobile and one click on desktop.

## M2 — Upload pipeline + instant library (M7 `11:700`, D3 `26:664`)

- Pickers, folder drop and share target.
- Chunked resumable uploads, duplicate check, magic bytes, quota.
- Client tags, covers, generated covers (including `generated-512.png`), peaks gating.
- Library sync (`since=rev` plus `hidden`), IndexedDB store.
- Upload default visibility control ("New uploads: Private · Public").

**Accept**
- A 300 MB FLAC album over a throttled connection survives a reload and resumes.
- Duplicates are skipped.
- Share-to-Wavehaus works on an Android device.
- A new track appears on a second device within 60 s.

## M3 — Playback engine & core screens (M1 `9:168`, M4 `10:599`, M5 `17:806`, M6 `11:557`, D1 `22:171`, D2 `22:453`)

**Engine** per `PLAYBACK.md`:
- Single audio element and synchronous track advance.
- Media Session and position state.
- Recovery, persistence and plays.

**Waveforms**
- All 7 variants, drawn on canvas.
- Mini player with a scrubbable waveform.
- Desktop **single-row player bar** (`7:401`).
- Whole-album waveform.

**Screens**
- Now Playing and Queue with Autoplay.
- Repeat, shuffle and sleep timer.

**Server**
- `/media` Range support on both backends.
- LiteSpeed / X-Sendfile in PHP.

**Accept**
- Track advance under 300 ms across 20 tracks with the screen locked on Android Brave (Background play on).
- Lock-screen controls and artwork show.
- The waveform slider is accessible.

## M4 — Organise & bulk edit (M9 `21:864`, M10 `21:982`, D4 `26:1007`)

- Rules engine (`organise.ts`, pure, with ≥ 60 fixture cases).
- Review import screen.
- Bulk edit, including rename by `{token}` pattern with preview.
- Quick fixes, artwork apply.
- Change log and undo.

**Accept**
- The fixture library comes out ≥ 90% correct.
- Undo restores the exact previous state.
- A 500-track rename is one request.

## M5 — Background play route (M8 `19:857`, M8b `19:936`, L3 page)

- Brave detection, banner logic and Open-in-Brave intents.
- Per-platform guides.
- Copy shortcut URL and shortcut icon download.
- 30-second self-test, with its status shown in Settings.

**Accept**
- Device matrix recorded in `docs/bg-test.md`: Android Brave (install and shortcut), Android Chrome, iOS Brave via option A and option B, iOS Safari standalone.
- The preview on Pages passes on Android Brave.

## M6 — Search, library & recommendations (M2 `10:314`, M3 `10:459`)

- MiniSearch worker, grouped results, filters.
- Library tabs and sorts. Playlists CRUD and reorder.
- Recs worker: Daily Mixes, On Repeat, Rediscover, Fresh uploads, radio/autoplay, smart shuffle.

**Accept**
- Searching 20k tracks takes under 30 ms per keystroke.
- Mixes are deterministic per day.
- Autoplay avoids tracks played in the last 2 h.

## M7 — Visibility, members, access & spam hardening (D5 `27:1046`, `VISIBILITY.md`)

- Visibility chip, sheet and popover for track, album, folder, playlist and multi-selection.
- `POST /api/visibility` with `dryRun`. `hidden` sync. Purge of offline copies. Admin takedown.
- Registration modes, invites/referrals, request-access approval, roles, quotas.
- Proof-of-work, honeypot, minimum fill time, disposable-domain list.

**Accept**
- All 8 acceptance tests in `VISIBILITY.md` pass.
- A listener cannot fetch a private `/media/:id` (403).
- Open mode rejects a bot that lacks proof-of-work.

## M8 — Assistants (D6 `27:1374`)

- Audit the UI for agent operation: labels, test IDs, no native dialogs, `data-busy`.
- API tokens with scopes. `tools/mcp.mjs`.
- Activity log with undo and an actor filter.

**Accept**
- A scripted Playwright "assistant" can upload, organise, rename, set artwork and keep everything private, using only accessible names.

## M9 — Offline, lyrics, moments, A–B (P1)

- Downloads, with the service worker serving byte ranges from the cache.
- Storage meter and persistence.
- Lyrics: embedded or `.lrc`, with a synced view.
- Moments CRUD and markers.
- A–B loop.

## M10 — Polish & 1.0

- Accessibility pass.
- Performance budgets.
- iOS best-effort fixes.
- Docs pages complete.
- Tag `v1.0.0`.

## Test fixtures

`tests/fixtures/library/` holds tiny generated audio files: sine tones of 1–3 s in MP3, FLAC, M4A, OGG and WAV. Give them assorted tags, missing tags, junk names, nested folders, a `cover.jpg` and `.lrc` files. Never commit copyrighted audio. The demo seed uses the same generator at longer lengths.
