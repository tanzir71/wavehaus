# Changelog

## Website integration (after v1.1.0)

- Add the paired PHP/PWA website build at `/wavehaus/app/` and reciprocal
  `sync:website` command, with clean-source/checksum checks in the website updater.
- Scope nested PHP session cookies to APP_BASE, preserve root cookie behavior,
  and retain existing protected fallback storage even when host restrictions lift.
- Make the Background play installation guide available before sign-in; keep
  the existing `/join/request` access form and subpath-safe links.
- Include the full APP_BASE URL in recovery-code downloads, and redirect an
  existing signed-in owner away from the first-run setup screen.
- Align shared-hosting upload limits with DEPLOY.md and add no-index headers.
- Local integration gates cover setup/recovery, two sessions, audio/art uploads,
  repeated full-site overwrites, migration backups and HTTP Range playback.
  No deployment or GitHub Actions are run for this integration.

## v1.1.0 — Desktop density · 2026-11-24

Desktop chrome and lists fit more of your library on screen.

- At 1100 px and above, the sidebar is 232 px, navigation and buttons are 32 px, chips are 28 px and track rows are 44 px with 32 px artwork.
- Adds six desktop text styles, smaller headings, four-column quick tiles, six-column mix grids, and tighter album, upload, bulk-edit and settings layouts.
- Keeps mobile and tablet layouts, the 88 px player bar, Jump back in, Now Playing and waveform heights at their 1.0 sizes. Assistant prompts grow with their text and method cards share one height.
- Adds breakpoint, control-size, overflow and prompt-growth E2E checks, plus a reproducible before/after pixel comparison. No runtime dependency, API, data or playback changes.

## v1.0.0 — Wavehaus 1.0

- Completes the M0–M10 release: both production adapters, installable browser demo, private music library, playback, organise/bulk tools, access controls, assistants and offline listening.
- Adds explicit client update/reload controls, keyboard focus restoration, dismissible account navigation, phone target/safe-area improvements and iPhone volume behavior.
- Precaches lightweight listening routes and bounds initial collection/library rendering while retaining full playback and selection context. Upload/tag parsing stays lazy and initial JavaScript is capped at 90 KB gzip during builds.
- Refreshes installation, update/restore, privacy, offline, lyrics/moments and assistant documentation. Keeps the corrected fullscreen landing footer and design mockups.
- No additional testing was performed, as requested. Publication builds do not establish device playback, accessibility or Lighthouse scores.

## v0.9.0 — Offline listening and listening tools

- Download tracks, albums and playlists through a two-request queue. Offline byte ranges preserve seeking, with account-scoped storage, permission refresh, cancellation and storage persistence controls.
- Restore the last signed-in library offline within its session expiry; signing out and visibility changes remove cached music.
- Follow synced embedded/LRC lyrics, save/edit/delete private moments, and set draggable/keyboard A–B loop handles.
- Added a moments API to all three adapters and a storage/downloads screen. Initial budgets are enforced during publishing builds. No testing was run, as requested.

## v0.8.0 — M8 · 2026-11-24

Your assistant. Your permissions.

- AI assistants settings offers browser-operation guidance and expiring API tokens with read, upload, organise and admin scopes. Raw tokens are shown once; revocation and role changes take effect on later requests.
- PHP, Worker and demo enforce token scopes, expiry and a 600-request-per-minute limit. Bearer requests use the same library privacy rules and do not require cookie CSRF headers.
- The zero-dependency Node stdio MCP server includes search, album reads, shared-rule organise/rename previews, resumable uploads, artwork, privacy, playlists and Undo. Its built files ship in both archives.
- Browser and API actions retain device/token attribution. Activity can filter actors and safely undo unchanged rows when newer edits conflict; expired snapshots are pruned while summaries remain.
- Upload/artwork/rename/review/privacy controls have stable hooks, direct bulk/review routes and readable busy states. Assistant uploads default to Private, including inside albums with public future defaults.

No dependency added. Publication builds only, as requested; no additional tests or browser/device checks were run.

## v0.7.0 — M7 · 2026-11-24

A library with people you choose.

- Track, album, playlist, folder and mixed-selection privacy use one guarded action, impact previews and public confirmation. Playlist publishing changes only your own selected tracks; future publishing stays opt-in.
- Folder defaults follow future uploads. Republishing refreshes playlist relationships for delta sync; private transitions purge local audio, remove queue entries and advance playback.
- Access settings offer Closed, Invite only, Request access and Open modes, member roles and quotas, referrals, one-time invitations, approval links and password-protected ownership transfer.
- Self-hosted signed proof-of-work, one-use claims, a honeypot, a three-second fill time, rate limits and a bundled disposable-domain list protect registration without a required email.
- PHP, Worker and demo implement the access flows. Admin takedowns remain private-only and appear in the uploader's Activity.

Publication builds only, as requested. No dependency was added. Schema 8 preserves existing data and change history.

## v0.6.0 — M6 · 2026-11-24

Find a favourite. Follow the next one.

- MiniSearch runs in a worker with grouped song, album, artist, folder and moment results, recent searches and private/downloaded filters.
- Library tabs include sorting, album grid/list views, folder collections and playlist creation, editing, deletion and accessible reordering.
- Private playlists and item changes use guarded 30-day Undo on PHP, Worker and demo, with migration 7 preserving existing playlists.
- Device-local recommendations provide daily mixes, On Repeat, Rediscover, Fresh uploads and Recently played, plus radio and prepared autoplay excluding the last two hours.
- Smart shuffle inserts labelled recommendations between groups of five context tracks and survives queue restoration.

Production archives and Pages are built for publication. No dependencies were added; no further tests were run, as requested.

## v0.5.0 — M5 · 2026-11-24

Screen off. Still your music.

- Android and iPhone Brave setup checklists include browser handoff, install steps, both iPhone shortcut methods, URL copying and the downloadable icon.
- Home and Now Playing hints respect dismissal for seven days and stop after three browser sessions; desktop avoids phone-only prompts.
- The optional in-app playback check measures at least 30 seconds hidden, accepts a completed chime and restores the previous queue paused. Its result appears in Settings.

Builds and publication only, as requested. Physical-device outcomes remain unverified.

## v0.4.0 — M4 · 2026-11-24

Drop a folder. Make it yours.

- Browser organiser rules use tags, folders and filenames, recognise compilations and recordings, number tracks and preserve deliberately separate imports.
- Persistent import review continues during uploads, with confidence badges, inline album edits, artwork, subset splitting and Undo import.
- Desktop and mobile selection open a bulk editor with mixed fields, rename-pattern previews, quick fixes, exact album targets and one-image artwork application.
- Metadata, artwork, album moves, deletion and track/album privacy share guarded change history and 30-day Undo on PHP, Worker and demo.
- Private transitions remove previously shared items from other members' library sync and cached audio. Generated covers update with the metadata action.

Release packages and Pages are built automatically. Further testing is disabled at the owner's request. Playlist/folder privacy and member controls continue in M7.

## v0.3.0 — M3 · 2026-11-23

Your music keeps moving.

- One permanent audio element, synchronous track advance, Media Session controls/artwork, bounded network recovery and interruption handling.
- Account-scoped local/cloud queue persistence, paused restoration and idempotent completed/skip listening history.
- Separate manual, context and autoplay queues, accessible reordering/removal, deterministic artist-balanced shuffle, repeat and sleep timers.
- Seven accessible canvas waveform variants, proportional album segments, saved moment markers and keyboard/drag seeking.
- Updated Now Playing, Queue and the single-row desktop/mobile players; optional authenticated Apache/LiteSpeed media offloading.

Twenty distinct generated tracks passed browser advance checks on Android emulation and desktop, with each measured transition below 300 ms. Physical screen-lock playback and a real LiteSpeed context remain unverified. Full radio ranking arrives in M6; moment and A–B editing arrive in M9.

## v0.2.1 — Landing fixes · 2026-11-23

The approved mockups, with a footer that stays reachable.

- Replaced simplified landing illustrations with native HTML/CSS matching the Figma product screens, artwork, waveforms and access controls.
- Removed deferred section sizing that changed document height during a jump to the bottom and left the footer out of view.
- Matched the closing headline and compact footer spacing, with wave artwork spanning fullscreen displays.

Verified at 412, 768, 1440 and 1920 px wide. The landing remains static and works without JavaScript.

## v0.2.0 — M2 · 2026-11-23

Drop in your music. Pick up where you left off.

- Resumable, verified uploads on PHP, Worker/R2 and the browser demo, with immutable chunks, quota checks and duplicate detection.
- Browser workers read tags and hash large files in bounded slices. Three files and two chunks per file can run in parallel; reloads retain the file and analysis.
- Embedded and folder artwork, 600/96 WebP covers, generated PNG artwork, waveform gating and lyric sidecars.
- File/folder pickers, full-window folder drop, the PWA share-target handler, a real screen-wake switch and Private/Public upload controls.
- Immediate local library insertion and private second-device sync, with authenticated audio ranges and artwork on both servers.
- Removed the unused visitor/Showcase schema; music and artwork require sign-in in P0.
- Production builds default to `/` and accept `APP_BASE` for a subpath. The Pages demo keeps `/wavehaus/app/`.

The cleanup is migration 0004 because M1 already shipped 0002_defaults.sql and M2 upload staging uses 0003. Existing migration history is preserved. A 300 MB generated FLAC passed throttled reload/resume on both servers. OS-level Android sharing and physical screen-lock playback remain unverified.

## v0.1.0 — M1 · 2026-11-23

A home for your account, on every device.

- Owner setup, ten one-use recovery codes, sign-in and sign-out on PHP, Worker and demo adapters.
- QR and six-digit device pairing, session lists, device revocation and password changes.
- Settings entry points on mobile and desktop, server-name settings and recovery-code regeneration.
- Rate limits, sixth-attempt lockout, CSRF protection and secure HTTP-only sessions on both servers.
- First shared-hosting and Worker release zips, with protected data storage and verified safe code overwrites.

Production music uploads and streaming arrive in M2/M3. The Pages demo plays generated music and keeps uploads in the browser. Physical-device screen-lock testing remains unverified.

## v0.0.0 — M0 · 2026-11-23

Your music, at home. The first Wavehaus preview.

- Landing, background-play guide, comparison, documentation and changelog.
- Installable PWA with 12 original generated tracks, waveform scrubbing and a persistent player.
- Browser-local uploads, generated artwork, library browsing and the 30-second background-play test.

Production server packages begin with M1. Physical-device background playback remains to be verified.
