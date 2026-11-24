# Desktop density pass (v1.1)

24 November 2026 · applies on top of `651e2ee` "Merge M10: Wavehaus 1.0" · Figma PWA-Spotify, page `02 · App — Desktop` (`4:3`)

Wavehaus 1.0 is built. This document lists only what changes; everything not mentioned stays exactly as 1.0 built it.

## Why

At 1440 × 900 the desktop UI read big and amateur. The sidebar, nav, top bar, headings, rows, buttons and settings panels were close to mobile sizes. This pass brings the desktop **chrome and lists** down to desktop density: smaller type, tighter padding, shorter controls.

**The listening areas keep their room.** Leave these exactly as they are:
- the player bar (`.player`, 88 px);
- the Home "Jump back in" card (`.resume-card`) and its hero waveform;
- Now Playing (`.now-playing`);
- all waveform heights.

## Scope

- **Desktop only (≥ 1100 px).** Put every change in `@media (min-width:1100px)` blocks or desktop-only tokens.
  - Mobile (< 720) and the tablet rail (720–1099) must not change. Touch targets there stay at least 48 px.
- **Visual only.** No API, data, routing or behaviour changes.
- **Unchanged:** colours, radius scale, icon set, the no-borders and no-italics rules, and the "cards in a row share one height" rule.

## Figma

The frames were updated in place, so the node IDs are the same as before.

| Frame | Node | PNG (replaced) |
| --- | --- | --- |
| D1 Home | `22:171` | `design/desktop/D1-home.png` |
| D2 Album | `22:453` | `design/desktop/D2-album.png` |
| D3 Upload & auto-organise | `26:664` | `design/desktop/D3-upload-organise.png` |
| D4 Bulk edit & rename | `26:1007` | `design/desktop/D4-bulk-edit.png` |
| D5 Settings · Access & members | `27:1046` | `design/desktop/D5-settings-access.png` |
| D6 Settings · AI assistants & security | `27:1374` | `design/desktop/D6-settings-assistants-security.png` |

**Before and after:**
- The 1.0 renders were moved to `design/desktop/v1/`.
- `design/desktop/D1-before-after.png` shows Home side by side.
- In Figma, the 1.0 frames are kept as a frozen copy in section `69:1306` ("Desktop v1 · before the density pass"). **Don't build from it.**

**Components:**

| Component | Node | Change |
| --- | --- | --- |
| `Desktop/Sidebar` | `7:320` | 264 → **232** wide; everything inside tighter (§ 3) |
| `MixCard` size=Desktop | `7:122` | 184 × 240 → **168 × 216** |
| `TrackRow/Desktop` | `7:98` | 56 → **44** tall |
| `Button` | `6:466` | New **size=S** (32 tall). size=M (44) stays for mobile and tablet. |
| `Chip` | `6:499` | New **size=S** (28 tall). size=M (34) stays for mobile and tablet. |
| `PlayButton` | `6:491` | Desktop uses S (36) in lists and M (48) in the album header, instead of L (64) |
| `Desktop/PlayerBar` | `7:401` | **Unchanged** |

## 1. New desktop text styles

These are in Figma as local text styles. Add them to `tokens.css` and `tokens.json` as `.t-desktop-*` classes.

| Style | Font | Size/LH | Tracking |
| --- | --- | --- | --- |
| Desktop/Title M | Geist 600 | 20/26 | −1% |
| Desktop/Title S | Geist 600 | 15/20 | −0.5% |
| Desktop/Body | Geist 400 | 13/20 | 0 |
| Desktop/Label | Geist 500 | 13/16 | 0 |
| Desktop/Caption | Geist 400 | 12/16 | 0 |
| Desktop/Mono | Geist Mono 400 | 12/16 | 0 |

**Mapping at ≥ 1100.** Each existing style is replaced by the one on its right:

| Existing style | Desktop replacement |
| --- | --- |
| Display/XL (album title) | Display/L 40/44 |
| Display/L (page titles: Home greeting, Settings, Upload, Bulk edit) | Title/L 28/32 |
| Title/L (section headings) | Desktop/Title M 20/26 |
| Title/M | Title/S 17/22 |
| Title/S (card and panel titles) | Desktop/Title S 15/20 |
| Body/L | Body/M 15/22 |
| Body/M | Desktop/Body 13/20 |
| Body/S (metadata) | Desktop/Caption 12/16 |
| Label/M (nav, rows, buttons) | Desktop/Label 13/16 |
| Mono/M | Desktop/Mono 12/16 |

Label/S and Mono/S don't change.

## 2. Spacing and layout tokens

**Spacing steps down one notch on desktop:**

| Before | After |
| --- | --- |
| 10 | 8 |
| 14 / 16 | 12 |
| 20 / 24 | 16 |
| 28 / 32 | 24 |
| 40 / 48 | 32 |
| 60 | 40 |

The side gutter stays at 32.

**Layout tokens:**
- At ≥ 1100, `--wh-sidebar-w` becomes **232px**, and `.app-body` follows it.
- Tablet (720–1099) keeps its 72 px rail, and mobile keeps its layout.
- `--wh-playerbar-h` stays 88.

## 3. Sidebar (`.sidebar`, `Desktop/Sidebar`)

| Part | 1.0 | Now |
| --- | --- | --- |
| Width | 264 | **232** |
| Padding / gap | 32 20 20 / 28 | **16 12 / 16** |
| Logo lockup | 32 tall | **24 tall** (scaled to 0.75) |
| Nav (`.sidebar nav`) | gap 6 | **gap 2** |
| Nav item (`nav a`) | min-height 48, padding 12 16, gap 14, radius 8, icon 22 | **32 tall, padding 8 10, gap 10, radius 6, icon 16**, Desktop/Label |
| Upload music (`.upload-button`) | 44 tall | **32 tall**, padding 8 10, gap 6, icon 16, Desktop/Label |
| Playlist rows (`.sidebar-library > a`) | ~52 tall, art 48 | **40 tall**: padding 4, gap 10, **art 32** (`.liked-tile` 32, heart icon 14). Name in Desktop/Label, count in Desktop/Caption. Rows 2 apart. |
| `PLAYLISTS` label | Mono/S | unchanged |
| Storage card | padding 16, gap 10 | **padding 12, gap 8**, text 12. Copy shortened to "3,412 tracks · 50 GB plan" (the R2 mention was dropped). |

## 4. Top bar (`.topbar`)

| Part | 1.0 | Now |
| --- | --- | --- |
| Bar | 76 tall, padding 0 40, gap 14 | **36 tall content** (bar about 52 with main padding), padding 0 32, gap 12 |
| Back / forward (`.topbar-history .icon-button`) | 48 | **28**, gap 8, icon 16 |
| Search (`.top-search`) | 440 wide, padding 11 16 | **320 × 36**, padding 8 12, gap 8, Desktop/Body, pill |
| Avatar | 36 | **28** |

## 5. Main column and Home (D1)

- `main`: padding **16 32 40**, gap **24** (was 12 40 40 / 28).
- Page title "Good evening, Tanzir": **Title/L 28/32** (was 40).
- `.resume-card` ("Jump back in"): **unchanged.**
- **Quick tiles** (`.quick-tiles`):
  - **4 columns from 1100** (1.0 switched to 4 only at 1440);
  - gap **8**; tiles **48** tall with **48** art (was 56);
  - title in Desktop/Label.
- **Section headings** (`.section-heading h2`):
  - **Desktop/Title M 20/26**; the sub line stays 12;
  - heading block to content: **12** (was 16).
- **Made for you** (`.album-grid` on Home):
  - **6 columns** at 1100–1439 and above, **gap 16**;
  - card cover **168**, then 8, then the title (Desktop/Label), then the subtitle (Desktop/Caption, one line with an ellipsis).
  - Figma added a sixth card, "Late-night radio" ("Seeded by Late-night drive"), to fill the row. In code, show up to 6 mixes on desktop.
- **Fresh uploads** (`.fresh-grid`, `.fresh-card`):
  - grid gap **16**;
  - card padding **12**;
  - card title **Desktop/Title S 15/20** (was 17).

## 6. Album (D2)

- **Header** (`.collection-heading`):
  - gap **24**, cover **220**;
  - title **Display/L 40/44** (was 56);
  - meta in Desktop/Caption.
- **Action row:**
  - play **48** (`PlayButton` M, was 64);
  - shuffle, like, download and more icons at **20**, gap **16**;
  - "Edit album" is Button S.
- **Album waveform panel** (`.album-wave`): padding **12**, radius 14. The waveform height is unchanged.
- **Track rows** (`.track-row`, `TrackRow/Desktop`):
  - **44 tall** (was 64), padding 0 12, gap 12, **cover 32**, index 16;
  - title Desktop/Label 500, artist and album Desktop/Caption;
  - icons 16; rows 2 apart.
  - The playing row keeps its `surface/1` fill and `accent/300` title.

## 7. Upload (D3), Bulk edit (D4), Settings (D5, D6)

**Page titles:** Title/L 28.

**Panels:**
- Selectors: `.access-panel`, `.assistant-panel`, `.upload-preferences`, `.upload-review-card`, `.bulk-panel`, `.setting-row`.
- padding **14 16** (was 20), radius **14**;
- panel titles **Desktop/Title S 15/20** (were 17 or 18);
- gap between panels **12**.

**Settings layout:**
- the settings nav column is **210** wide;
- items (`.settings-nav > a`) are **34** tall, padding 9 12, Desktop/Label, 2 apart;
- `.settings-content` gap **12**;
- the content column starts 16 after the nav.

**Access modes** (`.access-modes button`): padding **12**.

**Rows inside panels:**
- label Desktop/Label;
- helper and code lines stay Mono/S;
- values Desktop/Mono;
- toggles unchanged (36 × 20).

**D6 assistants:**
- The "Try asking" prompt box must grow with its text. It was clipped at 48 in Figma before the fix.
- The two method cards share one height.

**Drop zone** (`.upload-page .drop-zone`): padding **24** and a heading in Desktop/Title S. The upload list items keep their 1.0 size.

**Bulk edit:**
- table rows **42** tall, padding 7 8, gap 12, text 12;
- header row 30;
- toolbar **32** tall, padding 8 12;
- the right panel is **340** wide (unchanged), padding 14, gap 12.

**Buttons** (`.button` at ≥ 1100):
- `min-height` **32**, padding **6 14**, gap 6, Desktop/Label 13 (Button size=S);
- this applies to `.access-row .button` and the settings action buttons too.

**Chips** (`.chips button`, `.chip` at ≥ 1100): `min-height` **28**, padding **4 10**, Label/S 12.

**Inputs** (`.edit-fields input`, `.search-input`, settings number fields): height **32**, Desktop/Body 13.

**Anything not listed:** step it down one notch (§ 2) and match the PNG.

## Acceptance

- At 1440 × 900, D1–D6 match the new PNGs in `design/desktop/`.
- At 1100–1439 the same density applies, with the content max width unchanged.
- At 412 × 915 (mobile) and 900 × 1100 (tablet), screenshots are **identical to 1.0**. Add a visual check for this.
- Player bar, "Jump back in", Now Playing and waveform heights are pixel-identical to 1.0.
- Keyboard focus rings and hit areas work as before.
  - Desktop targets can be 32. Keep icon buttons' click area at least 28 × 28.
- E2E green at 412 × 915 and 1440 × 900. Update any desktop test that asserts 1.0 sizes.
- `CHANGELOG.md` gets a **v1.1.0** entry. Release as usual: Pages preview, tag `v1.1.0`, GitHub Release with zips.
