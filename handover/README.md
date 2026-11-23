# Wavehaus — self-hosted music streaming

**No app store. Screen off. Still playing.**

Wavehaus is a self-hosted music PWA:
- It installs from the browser.
- It keeps playing with the phone locked, through Brave's Background play.
- It deploys in five minutes on a $3 PHP host (SQLite) or on Cloudflare (Workers + R2 + D1).
- You drop folders from any device and it organises them for you.

There's no Docker, no transcoding and no third-party login.

This folder is the **design handover**. Codex: start with [`AGENTS.md`](AGENTS.md). Section 0 there says to create the new repo and preview each milestone on GitHub Pages.

| | |
|---|---|
| Figma | https://www.figma.com/design/jpktTO1igsegz2iP68nsRd/PWA-Spotify |
| Preview (after M0) | https://tanzir71.github.io/wavehaus/ · app in demo mode at `/wavehaus/app/` |
| Screens | `design/mobile` (Android-first 412×915), `design/desktop` (1440×900), `design/landing` (L1–L5), `design/foundations` |
| Brand | `assets/brand/` (Wave W mark, app icons, favicons) |
| Photos | `assets/unsplash/` (credits in `ASSETS.md`) |
| Tokens | `tokens.css`, `tokens.json` |
| Schema | `schema.sql` (= `migrations/0001_init.sql`) |

## Documents

- `AGENTS.md`: start here. New repo, Pages previews, rules, stack, layout, definition of done
- `SPEC.md`: product, features (P0/P1/P2), screens, non-goals
- `ARCHITECTURE.md`: the PWA and its three backends (PHP, Worker, in-browser demo), sync, media, redeploy safety
- `API.md`: the shared HTTP contract
- `PLAYBACK.md`: the background-safe audio engine, the Brave route and the home-screen icon flows
- `ORGANISE.md`: upload pipeline, auto-organise rules, bulk edit, generated covers
- `VISIBILITY.md`: private/public for tracks, albums, folders and playlists
- `AUTH.md`: setup, recovery codes, sessions, pairing, roles, registration modes, spam hardening
- `REFERENCES.md`: **port the Tack login/register/recovery code**, plus libraries and prior art
- `RECOMMENDATIONS.md`: on-device mixes, autoplay, radio, search
- `ASSISTANTS.md`: Claude/Codex operating the app (signed-in browser or API/MCP), audit and undo
- `DESIGN.md`: visual rules, tokens, logo, components and screens with Figma node IDs, waveform spec
- `HOMEPAGE.md`: **the instance homepage at `/`**: your music playable without an account, Open the app, invites, GitHub link, Showcase
- `LANDING.md`: the project site on GitHub Pages: landing and subpages (docs, background play, compare, changelog), copy, SEO
- `DEPLOY.md`: GitHub Pages preview, Namecheap/cPanel, Cloudflare, updates
- `TASKS.md`: milestones with acceptance criteria. Each one ships a preview
- `RESEARCH.md`: existing solutions and platform constraints, with sources
- `ASSETS.md`: brand files, images, fonts, icons, audio

## The short version

1. **Deploy:** extract the zip in cPanel and open `/setup`, or run `npm run deploy` on Cloudflare. Save your recovery codes.
2. **Install:** open your Wavehaus in Brave and add it to the home screen.
3. **Lock your phone:** turn on Background play (Android) or Enable Background Audio (iOS) under Settings → Media in Brave. Run the 30-second test, then lock the phone.
