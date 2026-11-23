# Design spec

Figma: https://www.figma.com/design/jpktTO1igsegz2iP68nsRd/PWA-Spotify. Links take the form `?node-id=9-168` (replace `:` with `-`).
PNG exports: `design/mobile`, `design/desktop`, `design/landing` (L1–L5), `design/foundations` (including `logo-options.png`). Brand files: `assets/brand/`. Tokens: `tokens.css` and `tokens.json`. The values were exported from the Figma variables.

## Direction

The look is premium and quiet, in the spirit of Tidal and SoundCloud Pro: a near-black stage where the **waveform is the hero**. Art and photography carry the colour. The UI itself stays monochrome, with one Klein-blue accent.

**Rules (enforced in review):**
- Dark theme only. Flat surfaces separated by tone (`bg/base` → `surface/3`).
- **No container strokes or borders.** Hairline dividers in lists use `line/subtle` only where tone isn't enough.
- No glows, shadows, blur or gradients. The only exception is the waveform played/unplayed hard split.
- **No italics, anywhere** (CSS: `font-style: normal` reset on `em, i, cite, var, address`; use weight for emphasis).
- The accent (`accent/500` `#3D5AFE`) is reserved for waveform progress, the primary button, the active nav indicator, selection and focus rings. `accent/300` is for links and changed values. `accent/900` is for selected and loop-region fills.
- Status colours appear only in small badges and dots.
- Type: **Geist** for UI and display, **Geist Mono** for times, formats, codes, eyebrows (uppercase, +4% tracking) and data.
- Icons: 24 px grid, **2 px stroke**, round caps (Lucide-compatible names in Figma, section Icons `6:122`). Export them as an inline SVG sprite. New: `agent` (`15:200`, cursor + sparkle, used for AI assistants everywhere) and `settings` (`41:172`, gear).
- **Cards side by side share one height** (set row children to fill the row's height). Bottom chips and buttons sit on the card's bottom edge. Never let a row of cards end at different heights.
- **Imagery:** no stock photos inside the app. On the landing page, only the one hero render is a photo; everything else is real product UI or generated graphics (the wave field). Image containers have square corners.

## Tokens (from Figma variables)

| Token | Value | Use |
|---|---|---|
| bg/base | #0A0A0B | app background |
| bg/raised | #111113 | sidebar, sheets, player bar |
| surface/1 | #17171A | cards, rows on hover |
| surface/2 | #1F1F23 | inputs, chips, secondary buttons |
| surface/3 | #2A2A2F | pressed, progress tracks, skeletons |
| line/subtle | #232327 | list dividers (rare) |
| text/primary | #F4F4F5 | |
| text/secondary | #A1A1AA | |
| text/tertiary | #6B6B74 | metadata, disabled |
| text/on-light | #0A0A0B | text on the white play button |
| accent/500 | #3D5AFE | progress, primary, active |
| accent/300 | #8EA2FF | links, changed values |
| accent/900 | #141A3D | selected / loop fill |
| wave/unplayed | #3A3A41 | |
| wave/played | #3D5AFE | |
| wave/reflection | #26262B | SoundCloud-style mirror below the baseline |
| status/success · warning · danger | #3DD68C · #F2C14E · #FF5C5C | |
| cover/ink · teal · plum · moss · steel · graphite | #1B2142 · #0F2A2C · #2A1C33 · #1A2A20 · #1C2733 · #232326 | generated cover tints |
| radius | xs 4 · s 8 · m 12 · l 20 · pill 999 | covers 8 (mobile) / 12 (desktop) |
| space | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 | mobile gutters 16, desktop 32 |

**Type styles** (size/line-height, tracking):

| Style | Font | Size/LH | Tracking |
|---|---|---|---|
| Display/Hero | Geist SemiBold | 88/88 | −4% |
| Display/XL | Geist SemiBold | 56/60 | −3% |
| Display/L | Geist SemiBold | 40/44 | −2.5% |
| Title/L | Geist SemiBold | 28/32 | −1.5% |
| Title/M | Geist SemiBold | 22/28 | −1% |
| Title/S | Geist SemiBold | 17/22 | −0.5% |
| Body/L | Geist Regular | 18/28 | −0.5% |
| Body/M | Geist Regular | 15/22 | 0 |
| Body/S | Geist Regular | 13/18 | 0 |
| Label/M | Geist Medium | 14/18 | 0 |
| Label/S | Geist Medium | 12/16 | 0 |
| Mono/M | Geist Mono Regular | 13/16 | 0 |
| Mono/S | Geist Mono Medium | 11/14 | +4%, uppercase for eyebrows/badges |

## Layout

- **Mobile (Android-first), 412×915 dp:** Android status bar 36, content gutter 16, mini player 97 above the nav bar, **bottom nav** with 4 tabs (Home, Search, Library, Upload). The nav uses an M3-style pill indicator (`accent/900` fill with an `accent/500` icon) and leaves room for the gesture handle. Touch targets are at least 48 dp. The iPhone reference frame (390×844) exists only for M8b.
- **Tablet (720–1099):** a 72 px icon rail replaces the bottom nav. The mini player stays.
- **Desktop (≥ 1100), 1440×900:** sidebar 264 (`Desktop/Sidebar`) with Home, Search, Your library and **Settings**, then Upload music, playlists and the storage card. The main area scrolls, with a max content width of 1120. **Player bar 88** is fixed at the bottom (`Desktop/PlayerBar`).
- **Player bar = one centred row** (redesigned: the old two-row stack was cramped). Left to right:
  - Track block (280): cover 56, title and artist, like.
  - Transport: prev, play 36, next. Gap 18.
  - Elapsed time (Mono/S), then `Waveform/Wide` filling the space, then remaining time.
  - Secondary cluster (336, right-aligned): shuffle, repeat, lyrics, queue, sleep, volume, slider.

  Everything is vertically centred on 44. Column gap is 40; padding is 16 left and 24 right.
- **Settings entry points:**
  - Desktop: the sidebar "Settings" item, active on all settings screens, plus the avatar (top right), which opens a menu: Settings, Devices, Background play, Sign out.
  - Mobile: a gear icon on the Home header (next to downloads) and on the Library header (after search and plus). It opens `/settings`.
  - The settings sections are General, Library rules, Access & members, Devices & sessions, AI assistants, Storage & backups, Updates and Activity (D5/D6 layout).
- Safe areas: use `env(safe-area-inset-*)`. The bottom nav sits above the inset.

## Components (Figma node IDs)

| Component | Node | Notes |
|---|---|---|
| Logo/Mark · Logo/Lockup | 6:411 · 6:422 | **Final logo = Option B "Wave W"**: one continuous sine that spells W, stroke 3 on the 32 grid, colour text/primary (white on the accent tile). Lockup = mark + 10 gap + "wavehaus" in Geist SemiBold. Explorations are on page 04 · Logo options (`50:686`). App icons are in frame `54:176` and exported to `assets/brand/` |
| **Waveform/Hero** | 6:450 | 1120×161, desktop album/landing hero, with reflection |
| **Waveform/Now** | 14:175 | 380×131, mobile Now Playing, with reflection, moments and A–B handles |
| **Waveform/Scrubber** | 6:426 | 343×61, Home "Jump back in" card |
| **Waveform/Wide** | 6:433 | 520×41, desktop player bar |
| **Waveform/Mini** | 14:168 | 380×31, **mobile mini player — scrubbable, not a thin line** |
| **Waveform/Row** | 6:440 | 140×20, track rows (playing/expanded), feed cards |
| **Waveform/Strip** | 6:445 | 358×10, album segment strip / tiny previews |
| Button | 6:466 | Primary (accent fill) · Secondary (surface/2) · Ghost |
| PlayButton | 6:491 | L 64 / M 48 / S 36. White circle, black glyph. Play/Pause |
| Chip | 6:499 | Default (surface/2) · Selected (text/primary fill, on-light text) |
| StatusBar/Android · iOS | 14:228 · 6:503 | reference only |
| TrackRow/Mobile | 7:49 | Default · Playing (accent title + eq icon) · **Expanded** (current track grows to show a Row waveform) |
| TrackRow/Desktop | 7:98 | # · title/artist · album · waveform · visibility · duration · more |
| AlbumCard · MixCard | 7:110 · 7:133 | Mobile/Desktop sizes |
| SectionHeader | 7:134 | Title/M + "Show all" |
| MiniPlayer | 7:140 | cover 40, title/artist, play/pause, **Waveform/Mini under the text, full width** |
| TabBar | 7:268 | active = Home/Search/Library/Upload |
| UploadItem | 7:316 | Uploading · Analyzing · Added · Duplicate · Unsupported |
| Desktop/Sidebar · PlayerBar | 7:320 · 7:401 | Sidebar now includes Settings (`42:1352`). PlayerBar is the single-row layout described under Layout |
| Icon/agent · Icon/settings | 15:200 · 41:172 | AI assistant (cursor + sparkle) · settings gear |
| **Cover/Generated** | 12:216 | 6 tints × Large/Small (algorithm in `ORGANISE.md`) |
| Avatar/Monogram | 12:217 | member initials on a tint |

Foundations sections: Cover `6:2`, Colour `6:6`, Type `6:75`, Icons `6:122`, Core `6:395`, Image library `6:509`, Library & player `7:18`, Cover fallback `12:174`.

## Screens

| Screen | Node | PNG |
|---|---|---|
| M1 Home | 9:168 | design/mobile/M01-home.png |
| M2 Search | 10:314 | M02-search.png |
| M3 Library | 10:459 | M03-library.png |
| M4 Album | 10:599 | M04-album.png |
| M5 Now Playing | 17:806 | M05-now-playing.png |
| M6 Queue | 11:557 | M06-queue.png |
| M7 Upload | 11:700 | M07-upload.png |
| M8 Background play · Brave · Android | 19:857 | M08-background-play-brave-android.png |
| M8b Background play · Brave · iPhone | 19:936 | M08b-background-play-brave-iphone.png |
| M9 Review import | 21:864 | M09-review-import.png |
| M10 Bulk edit | 21:982 | M10-bulk-edit.png |
| M11 Sign in / invite / recovery | 21:1095 | M11-sign-in.png |
| D1 Home | 22:171 | design/desktop/D1-home.png |
| D2 Album (whole-album waveform) | 22:453 | D2-album.png |
| D3 Upload & auto-organise | 26:664 | D3-upload-organise.png |
| D4 Bulk edit & rename | 26:1007 | D4-bulk-edit.png |
| D5 Settings · Access & members | 27:1046 | D5-settings-access.png |
| D6 Settings · AI assistants & security | 27:1374 | D6-settings-assistants-security.png |
| L1 Landing | 28:171 | design/landing/L1-landing.png |
| L2 Docs template (Install on shared hosting) | 57:649 | L2-docs-shared-hosting.png |
| L3 Background play | 57:817 | L3-background-play.png |
| L4 Self-hosted Spotify alternative | 57:1012 | L4-self-hosted-spotify-alternative.png |
| L5 Changelog | 57:1187 | L5-changelog.png |
| **L6 Instance homepage, desktop** (owner's site at `/`) | 59:701 | L6-instance-homepage-desktop.png |
| **L6m Instance homepage, mobile** (412) | 60:767 | L6m-instance-homepage-mobile.png |
| Logo options (B chosen) | 50:686 | design/foundations/logo-options.png |

**Visibility UI** (no separate frame; composed from Chip, Button and option rows): the visibility chip on album and playlist headers, the bottom sheet on mobile and a 360 px popover on desktop. The full spec is in `VISIBILITY.md`; the landing "Beyond playback" section (`47:676`) shows the sheet as the visual reference.

## The waveform (core experience)

- **Data:** 1000 uint8 peaks per track (`tracks.peaks`). Downsample to `N = floor(width / (barW + gap))` bars using the max of each bucket.
- **Geometry** (match the Figma vectors):

  | Variant | Bar width | Gap | Reflection below baseline |
  |---|---|---|---|
  | Row / Strip | 2 | 1 | none |
  | Mini / Wide / Scrubber | 2 | 1 | 25% height, `wave/reflection` |
  | Now / Hero | 3 | 2 | 30% height |

  Bars are top-aligned to a baseline at 70% of the height, with a 1 px gap between the bars and their reflection. Corner radius is 1 px on Hero and Now.
- **Paint:** unplayed bars are `wave/unplayed`, played bars are `wave/played` (hard split at the playhead, not per bar). Played reflection uses `accent/500` at 35%.
  - Buffered-but-unplayed is not shown. Keep it calm.
- **Implementation:** draw on `<canvas>`, sized by `devicePixelRatio`.
  - Two passes: draw everything unplayed, then clip to `[0, progressX]` and draw played.
  - Redraw on `requestAnimationFrame` only while visible and playing. Elsewhere use `timeupdate` (about 4 Hz).
  - Colours come from CSS custom properties.
- **Interaction:**
  - **Tap or click** to seek.
  - **Drag** to scrub (`touch-action: pan-y` so vertical scroll still works). Show a time bubble (Mono/M) above the finger.
  - **Desktop hover** previews: bars up to the cursor tint `accent/300` at 40%, with a time tooltip.
  - **Long-press (500 ms)** to save a moment, with haptic `navigator.vibrate(8)`.
  - **Keyboard:** ←/→ ±5 s, Shift ±30 s, Home/End.
  - Times render in Mono at both ends: elapsed on the left, remaining on the right (`−2:36`).
- **Moments:** a 2 px `text/primary` tick above the bars at each timestamp, with a ◆ marker in the time row. Tapping one seeks to it. The label shows in a tooltip or chip ("The drop · 2:41").
- **Loop A–B:** two handles (A/B chips, Mono/S) on the waveform with the region filled `accent/900`. Label: "LOOP A–B · 2:10–2:52".
- **No peaks yet:** render a flat 2 px line at the baseline in `wave/unplayed`. Played progress still shows, as the line in accent. The placeholder is swapped in when peaks arrive (fade 150 ms).
- **Album waveform (D2):** concatenate the tracks' peaks proportionally to their durations, with a 4 px gap between segments. Hover shows a track label. The current track's segment shows progress, finished segments are fully accent, and later ones are unplayed.
- **Where it appears:** Now Playing, mini player, desktop player bar, Home hero, expanded and playing track rows, feed cards, the album hero, generated covers (tonal), the landing page and the lock screen (via generated cover art).

## Covers & imagery

- **Real art:** `object-fit: cover`, radius s/m, no border. While loading, a placeholder uses the generated cover. Never use a blank grey square.
- **Generated covers:** see `ORGANISE.md`. They must look intentional at every size: 24 tonal bars at 26% white, title in Geist SemiBold and artist in Geist Mono at 55%. The small size (< 96 px) has no text.
- **Photography** is used only on the landing page (Unsplash, credited in `ASSETS.md`). The app has no stock imagery.

## Motion

Durations: 150 ms (state), 220 ms (sheets, `cubic-bezier(.2,.8,.2,1)`), 300 ms (Now Playing expand from the mini player, shared-element cover). Respect `prefers-reduced-motion`: no expand animation, instant swaps.

## Accessibility

- Contrast on `bg/base`: text/primary 18:1, text/secondary 7.7:1, accent/300 8.3:1, white on accent/500 5.1:1.
- **text/tertiary `#6B6B74` is 3.75:1, which fails WCAG AA for small text.** Use it only for non-essential decoration, such as separators and disabled states. For metadata that must be read, use text/secondary. If the a11y check (≥ 95) flags it, ship `--wh-text-tertiary: #80808A` (5.1:1 on base, 4.6:1 on surface/1) and update the Figma variable to match.
- accent/500 is 3.9:1 on base. Use it for bars, fills and icons, never for small text (links use accent/300).
- Focus ring: 2 px `accent/500` offset 2 (the one place an outline is allowed).
- All waveform interactions have keyboard and slider equivalents (`ASSISTANTS.md`).
