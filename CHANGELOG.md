# Changelog

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
