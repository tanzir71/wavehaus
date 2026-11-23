# Wavehaus — Product spec

**One line:** your own music, uploaded from any device in seconds, organised for you, streamed everywhere — and it keeps playing when your phone is locked.

**SEO name/descriptor:** **Wavehaus — self-hosted music streaming.** "Wave" = the waveform that runs through the whole UI; "haus" = home (your music's self-hosted home). Unique coined token → owns its branded search results; category keywords live in the descriptor, title tags and H2s (see `LANDING.md`).

## Who it's for

1. **The owner** (primary): has years of messy folders (rips, downloads, voice memos, band demos). Wants to drop them in from a phone or laptop and listen anywhere. Won't run a VPS/Docker.
2. **Friends / band / family** (secondary, optional): invited members who can listen and, if allowed, upload their own (private by default).
3. **AI assistants** (operators): Claude/Codex acting on the owner's behalf to upload, tidy and add artwork.

## Principles

- Zero chores: drop files → they're organised. Fix the rest in bulk, never one by one.
- The waveform is the product's signature and the primary progress UI everywhere.
- Missing art is the normal case: generated covers must look intentional.
- Minimal tech: shared hosting or Cloudflare free tier; the browser does the work.
- Android first; desktop is a first-class layout; iOS best effort via Brave.
- Private by default; the owner decides who can join and what's public.

## Feature list (P0 = launch, P1 = soon after, P2 = later)

### Library & listening
- P0 Home: Jump back in (waveform hero, resume position), quick tiles, Made for you, Fresh uploads (SoundCloud-style feed cards with waveforms).
- P0 Search: instant, fuzzy, grouped (top result, songs, albums, artists, folders, moments). Keyboard `/` on desktop.
- P0 Library: playlists, albums, artists, folders, downloaded; sort; Liked songs pinned.
- P0 Album / playlist / artist / folder pages; desktop album shows **the whole album as one waveform** (segments per track).
- P0 Now Playing: large waveform scrubber, format badges, visibility badge, shuffle, repeat off/all/one, sleep timer, lyrics entry, queue entry.
- P0 Queue: now playing (expanded row with waveform), next in queue (drag reorder), next from context, **Autoplay** (toggle) with suggested tracks.
- P0 Mini player with a **scrubbable waveform** (not a thin line).
- P1 **Moments**: long-press waveform to save a timestamp (label optional); markers shown on the waveform; searchable.
- P1 **Loop A–B** on the waveform.
- P1 Lyrics: embedded USLT/SYLT or sidecar `.lrc` uploaded with the folder; synced view when timestamps exist.
- P1 Offline downloads (Cache API) for albums/playlists, with storage meter.
- P2 Crossfade + ReplayGain (desktop/Android only).
- P2 Public share link for a track/playlist (signed, expiring) — only for Public items.

### Upload & organise
- P0 Upload from desktop (drag files/folders, pickers) and mobile (file/folder picker).
- P0 **Android share target**: share audio from any app → Wavehaus.
- P0 Resumable chunked upload (8 MB), duplicate skip (fingerprint), unsupported-format warning per device.
- P0 Client-side tags, cover extraction, `cover.jpg/folder.jpg/front.*` pickup, waveform peaks.
- P0 **Auto-organise review** after each drop (tags → folders → filename patterns; confidence; accept guesses).
- P0 **Bulk edit** (multi-select): set artist/album/year/genre, rename from filename pattern with live preview, quick fixes (Title Case, strip junk), set visibility, set artwork. 30-day undo via change log.
- P0 Generated covers for anything without art.
- P1 Library rules settings (toggle each heuristic).
- P1 "Find artwork" (paste/drop/pick image; optional fetch-by-URL with SSRF guard).

### Access & safety
- P0 First-run setup: owner account + **recovery codes**. No email, no third-party auth.
- P0 Sessions per device (revocable), **QR/6-digit pairing**, rate limiting + lockout.
- P0 **Visibility**: Private (uploader only) / Public (all members) per **track, album, folder or playlist**, plus multi-select from the Library. Default is Private. A whole album or playlist flips in one step, with exact counts shown first and 30-day undo (`VISIBILITY.md`).
- P0 **Settings entry points**: desktop sidebar "Settings"; a gear on the mobile Home and Library headers; the avatar menu (Settings, Devices, Background play, Sign out).
- P1 Registration modes: Closed / Invite only / Request access / Open; per-member upload permission, quota, invites (referrals); spam hardening (proof-of-work, honeypot, min-fill time, disposable-domain list).
- P1 Members admin: roles (owner/admin/uploader/listener), storage, invites left, approve/deny requests.

### Assistants
- P0 Agent-operable UI (works in Claude/Codex built-in browser on a signed-in session).
- P1 API tokens with scopes + `tools/mcp.mjs`; assistant activity log with undo.

### Background play
- P0 Hardened engine (single audio element, Media Session, sync track advance).
- P0 **Brave route** onboarding: detect Brave; "Open in Brave" handoff; per-platform steps (Background play / Enable Background Audio under Settings → Media); one-tap home-screen icon flow; 30-second self-test.

### Marketing & preview
- P0 Static landing page plus subpages (`LANDING.md`): L1 landing, L2 docs template (shared hosting, Cloudflare, updating, backups, assistants…), L3 Background play, L4 Self-hosted Spotify alternative, L5 Changelog.
- P0 **GitHub Pages preview every milestone**: the landing at `/wavehaus/` and the app in **demo mode** at `/wavehaus/app/` (in-browser backend with generated sample music).

## Screens (Figma)

Mobile (Android 412×915): M1 Home · M2 Search · M3 Library · M4 Album · M5 Now Playing · M6 Queue · M7 Upload · M8 Background play (Brave · Android) · M8b (Brave · iPhone, 390×844) · M9 Review import · M10 Bulk edit · M11 Sign in / invite / recovery.
Desktop (1440×900): D1 Home · D2 Album · D3 Upload & auto-organise · D4 Bulk edit & rename · D5 Settings · Access & members · D6 Settings · AI assistants & security.
Landing (1440 wide): L1 Landing · L2 Docs template · L3 Background play · L4 Self-hosted Spotify alternative · L5 Changelog.
Logo: page 04 · Logo options. Option B "Wave W" is final and lives in `Logo/Mark` and `Logo/Lockup`. Node IDs are in `DESIGN.md`.

Screens not drawn but required (compose from existing components): Artist page, Playlist page (= Album layout), Folder page (= Library list), **Visibility sheet / desktop popover** (spec in `VISIBILITY.md`), **Avatar menu**, Demo-mode banner, Lyrics sheet, Sleep-timer sheet, Settings · General / Library rules / Devices / Storage / Updates (= D5 layout), Setup (= M11 layout + recovery-codes step), Request-access form, Empty states (no music yet → big Upload CTA + "Ask your assistant" tip).

## Non-goals

Transcoding, streaming services integration, social feeds/followers, comments, federation, native apps, podcasts (P2 at most), DRM, payment.
