# AGENTS.md — Wavehaus (Codex handover)

You are implementing **Wavehaus**, a self-hosted music streaming **PWA** (Spotify/SoundCloud-style UX for your own files). The landing page leads with three promises, and the build must keep all three:
1. **It installs from the browser.** No app store.
2. **It keeps playing with the screen off.** Brave route.
3. **It deploys in five minutes** on a $3 PHP host or Cloudflare.

The design is final in Figma, and this folder is the complete spec.

## 0. Start here: new repo, milestone previews on GitHub Pages

- **Create a new public GitHub repo** `tanzir71/wavehaus` (`gh repo create tanzir71/wavehaus --public --license mit`). Use another name only if the owner says so.
  - Copy this whole handover folder into `/handover` in the repo (docs, `design/`, `assets/`). It stays the source of truth.
  - Code goes in the layout below.
- **Ship in milestones** (`TASKS.md`). Each milestone:
  - is merged to `main`,
  - is tagged `v0.N.0`,
  - deploys automatically to **GitHub Pages**,
  - adds a `CHANGELOG.md` entry,
  - gets a GitHub Release with the two server zips (once they exist).
- **The Pages preview** is how the owner reviews each milestone:
  - `https://tanzir71.github.io/wavehaus/` is the landing page and its subpages (static).
  - `https://tanzir71.github.io/wavehaus/app/` is the real PWA running in **demo mode**: an in-browser backend with generated sample music (`ARCHITECTURE.md` § Demo backend). The owner installs it from Brave on Android and runs the background-play test against the preview.
- **M0 already ships** the landing page with its subpages, the installable PWA shell and demo mode, so there's something real to look at on day one.
- Workflow: `.github/workflows/pages.yml` (details in `DEPLOY.md` § A).

## Read in this order

1. `SPEC.md`: what we're building, priorities, non-goals
2. `ARCHITECTURE.md`: stack, folders, the PHP / Worker / demo adapters, sync, redeploy safety
3. `DESIGN.md` + `tokens.css` + `design/**.png`: visual spec, components, Figma node IDs, logo
4. `PLAYBACK.md`: background-playback engine and the Brave route. This is the hardest part, so read it twice.
5. `ORGANISE.md`: upload pipeline, auto-organise, bulk edit, waveforms, generated covers
6. `VISIBILITY.md`: private/public for tracks, albums, folders and playlists
7. `AUTH.md` + `REFERENCES.md`: accounts, invites/referrals, spam hardening, recovery codes. **Port the owner's Tack login/register code** instead of writing it from scratch.
8. `API.md` + `schema.sql`: the contract every backend must satisfy
9. `RECOMMENDATIONS.md`, `ASSISTANTS.md`, `LANDING.md`, `DEPLOY.md`
10. `TASKS.md`: milestones with acceptance criteria. Work milestone by milestone.

`RESEARCH.md` explains the reasoning (competitors, platform constraints, sources). `ASSETS.md` lists the photo, font, icon and brand files.

Figma: https://www.figma.com/design/jpktTO1igsegz2iP68nsRd/PWA-Spotify. Pages:
- 00 Foundations
- 01 App — Mobile
- 02 App — Desktop
- 03 Landing: L1 landing, plus subpages L2–L5 to its right
- 04 Logo options: Option B "Wave W" is the chosen logo

If you have Figma MCP access, use the node IDs in `DESIGN.md`. Otherwise use the PNGs in `design/`.

## Non-negotiables

- **Minimal tech.** It must run on both:
  - (a) Namecheap-class shared hosting: PHP 8.1+, SQLite via PDO, Apache/LiteSpeed `.htaccess`. No shell, no Composer at runtime, no Node on the server.
  - (b) Cloudflare Workers + R2 + D1.

  Not allowed: Docker, Redis, queues, ffmpeg, transcoding, third-party auth, or required external APIs.
- **The browser does the heavy lifting.** Tag parsing, cover extraction and resizing, waveform peaks, auto-organise guesses, search and recommendations all run client-side.
- **It's a PWA, nothing else.** No native apps or wrappers. Background play is solved by the **Brave route** (`PLAYBACK.md`) plus a hardened single-`<audio>` engine.
- **Android first.** The design target is 412×915 dp. Test on Android Brave and Chrome first, then desktop, then iOS (best effort).
- **One frontend, three backends, one API contract.** `server-php/`, `server-worker/` and the in-browser `app/src/demo/` all implement `API.md`. The PHP and Worker backends must pass `tests/api`. The demo adapter passes the same suite through a fetch shim.
- **Redeploys never touch data.** Code and data live in separate folders, settings live in the DB, and migrations are versioned and idempotent. Port Tack's pattern (`REFERENCES.md`).
- **Private by default** at every level: track, album, folder and playlist (`VISIBILITY.md`).
- **Design rules:**
  - Dark only, flat surfaces, no container strokes, no glows.
  - No gradients, except the waveform progress clip.
  - **No italics anywhere.**
  - One accent (`--wh-accent-500`), used only for waveform progress, the primary action and the active state.
  - Geist and Geist Mono, self-hosted.
  - **Cards side by side always share one height.**
- **Agent-operable UI.** Claude or Codex must be able to drive the app in a browser (`ASSISTANTS.md`): real `<input type=file>`, labelled controls, no `alert()` or `confirm()`.

## Repo layout to create

```
/app                 # PWA (Vite + Preact + TypeScript) → builds to /app/dist (static)
  /src/engine        # audio engine, media session, queue, Brave detection (no UI imports)
  /src/library       # IndexedDB store, sync, search worker, recommendations worker
  /src/upload        # picker, share-target intake, tag parsing, peaks, organise, chunk uploader
  /src/api           # typed API client (HTTP) — same TypeScript interface as /src/demo
  /src/demo          # in-browser backend for GitHub Pages: IndexedDB + OPFS, generated sample music
  /src/ui            # components mirroring Figma names (Waveform, TrackRow, MiniPlayer, VisibilitySheet, …)
  /src/routes        # Home, Search, Library, Album, Playlist, Folder, NowPlaying, Queue, Upload, Review, BulkEdit,
                     # Settings (General, Library rules, Access & members, Devices, AI assistants, Storage, Activity, Updates),
                     # Setup, SignIn, Join, BackgroundPlay
  /public            # manifest.webmanifest, sw.js, icons (from /handover/assets/brand), fonts, chime-test.mp3
/server-php          # shared-hosting backend: public/index.php front controller + lib/*.php (no Composer)
/server-worker       # Cloudflare Worker (TypeScript, no framework) + wrangler.toml
/migrations          # 0001_init.sql … shared by both backends (SQLite dialect, D1-compatible)
/landing             # static marketing site + subpages (HTML + CSS, no JS required) → /landing/dist
/tools/mcp.mjs       # zero-dependency MCP stdio server wrapping the API (for CLI agents)
/tests/api           # contract tests (Vitest) against BASE_URL, or the demo adapter via a fetch shim
/tests/e2e           # Playwright (Android emulation 412×915 + desktop 1440×900)
/.github/workflows   # ci.yml (tests on PR), pages.yml (deploy preview), release.yml (zips on tag)
/handover            # this folder, unchanged
/dist                # release zips: wavehaus-shared-hosting-vX.Y.Z.zip, wavehaus-worker-vX.Y.Z.zip
```

## Client dependency budget (keep it)

- Runtime: `preact`, `@preact/signals`, `idb-keyval`, `minisearch`, and `music-metadata` (lazy-loaded on the Upload route only).
- Dev: `vite`, `typescript`, `vitest`, `@playwright/test`, and `sharp` (landing images, build only).
- Anything else needs a written reason in the PR.
- No CSS framework: use plain CSS with the `tokens.css` custom properties.
- Write the service worker by hand (no Workbox).

## Commands (define these)

- `npm run dev`: Vite dev server plus `php -S` for server-php (or `npm run dev:worker` for `wrangler dev`)
- `npm run dev:demo`: the app with the in-browser demo backend (no server at all)
- `npm run build`: builds `/app/dist` and `/landing/dist`
- `npm run build:pages`: builds `site/` with the landing at `/` and the app in demo mode at `/app/` (base path `/wavehaus/`)
- `npm run test` / `npm run test:api` (`BASE_URL=…`) / `npm run e2e`
- `npm run package`: produces both release zips in `/dist`

## Definition of done (per milestone)

- It matches the Figma frame(s) listed in `TASKS.md` at 412×915 and 1440×900 (fonts, spacing and colours from tokens).
- Contract tests are green on every backend that exists so far. E2E is green on Android emulation.
- Missing data degrades gracefully: no peaks yet shows a flat line; no art shows a generated cover.
- No new dependency without a written justification. Bundle budget: initial JS ≤ 90 KB gzip, with the Upload route as a separate lazy chunk.
- Lighthouse: PWA installable; a11y ≥ 95 on Home and Now Playing; landing 100/100/100/100.
- **Deployed to GitHub Pages.** The PR description lists the preview URLs and a 3-line "what to try" for the owner. `CHANGELOG.md` is updated, and a release is tagged.

## Don'ts

Don't add any of these:
- transcoding or server-side tag parsing
- OAuth/social login, or email as a hard requirement
- analytics or trackers
- a CSS framework
- Web Audio routing of the playback element on iOS
- `alert()`, italics, or container borders
- stock photos inside the app

Don't commit copyrighted audio: demo and test music is generated.
