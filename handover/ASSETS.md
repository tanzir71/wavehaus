# Assets & credits

## Brand (final logo: Option B, "Wave W")

The mark is a single continuous sine that spells W. The stroke is `--wh-text-primary` on dark backgrounds and white on the accent tile. Never recolour the stroke to accent on dark.

**Figma:**
- components `Logo/Mark` `6:411` and `Logo/Lockup` `6:422`
- the icon frame "Brand · app icons (exports)" `54:176` on 00 Foundations
- the explorations on page 04 · Logo options (`50:686`)

**Files** in `assets/brand/`:

| File | Use |
|---|---|
| `wavehaus-mark.svg` | Mark, `stroke="currentColor"`, 32 grid, stroke 3. Use inline in the app and the landing |
| `wavehaus-app-icon.svg` | Accent tile + white mark, the source for every icon |
| `icon-512.png` | manifest `purpose: "any"` |
| `icon-maskable-512.png` | manifest `purpose: "maskable"` (mark inside the 80% safe zone) |
| `icon-192.png` | manifest |
| `apple-touch-icon-180.png` | iOS home screen |
| `shortcut-icon-180.png` | the icon users pick for the iOS Shortcuts method (offered for download on the Background play screen) |
| `favicon-32.png` | favicon (dark tile). Also generate `favicon.svg` from `wavehaus-mark.svg` |

**Lockup:** mark 32 px + 10 px gap + "wavehaus" in Geist SemiBold 22/28, −3% tracking, text/primary. Build it in HTML, not as an image.

## Photography

All photos are from **Unsplash** under the Unsplash License. It allows free use, including commercial, without permission. Attribution isn't required, but we give it in the landing footer.

| File | Photographer | Unsplash page | Used in |
|---|---|---|---|
| `assets/unsplash/landing-hero-abstract-curves.jpg` (2880 px) | Andrew Kliatskyi | https://unsplash.com/photos/abstract-dark-wavy-lines-with-subtle-highlights-qmUKOInkOL8 | L1 hero |

`assets/unsplash/_unused/` holds earlier candidates the owner rejected (turntable, crates, headphones, concert, vinyl, blue light-trail and blue 3D waves, second abstract render). Don't use them.

### Placeholder album art (design mocks and seed/demo data only)

These photos stand in for "files that do have embedded art" in the mocks. Don't ship them as default covers (the default is the generated cover), and don't bundle them in the demo seed (the seed uses generated covers).

| File | Photographer | Unsplash page |
|---|---|---|
| cover-01-grayscale-swirl.jpg | Antonius Harel | https://unsplash.com/photos/bylORj44ufs |
| cover-02-smoky.jpg | Mahdi Bafande | https://unsplash.com/photos/CYsMPZ2yjlw |
| cover-03-geometric.jpg | Daniele Levis Pelusi | https://unsplash.com/photos/5yz1khuZrCc |
| cover-04-pixel.jpg | Logan Voss | https://unsplash.com/photos/-IFrhTOD_I8 |
| cover-05-blocks.jpg | Logan Voss | https://unsplash.com/photos/TAaB4K2PvJc |
| cover-06-squares.jpg | Steve A Johnson | https://unsplash.com/photos/R3xaKrGF1sw |
| cover-07-paint-pour.jpg | Susan Wilkinson | https://unsplash.com/photos/mj3JgJIABsE |
| cover-08-neon-exposure.jpg | Jatin Gajjar | https://unsplash.com/photos/B34in_2j2Gc |
| cover-09-light-painting.jpg | Solen Feyissa | https://unsplash.com/photos/4LysFkWr8YQ |
| cover-10-neon-green.jpg | Logan Voss | https://unsplash.com/photos/bHd7tm-2oWU |
| cover-11-backlit-silhouette.jpg | Cemrecan Yurtman | https://unsplash.com/photos/s1xqM0GX52w |
| cover-12-pink-silhouette.jpg | Cemrecan Yurtman | https://unsplash.com/photos/wih0v2QIySo |
| cover-13-colour-lights.jpg | Solen Feyissa | https://unsplash.com/photos/JP0uNI-4uEE |

## Generated graphics

- **Closing-band wave field:** generated SVG (`LANDING.md` § 8). No licence issues.
- **Generated album covers:** `ORGANISE.md`.

## Fonts

Geist and Geist Mono (by Vercel), under the SIL Open Font License 1.1. Download the variable woff2 files from the official Geist repository and put them in `app/public/fonts/` and `landing/fonts/`. Include `OFL.txt`.

## Icons

The icons are on a 24 px grid with a **2 px stroke** and round caps, in a Lucide-compatible style. Ship them as an inline SVG sprite (`app/src/ui/icons.svg`), exported from Figma section Icons `6:122`.

`agent` (cursor + sparkle) and `settings` (gear) are new. `settings` and some others follow Lucide (ISC licence): keep its notice.

## Audio

`app/public/chime-test.mp3` is the background-play self-test. Generate it at build time with `scripts/make-chime.mjs`: a 45 s quiet sine pad that ends in a chime. It's original, so there are no licence issues. Demo seed music and test fixtures are generated too.

## Design exports

`design/**.png` are 1× exports of the Figma frames, kept for reference. The Figma file is the source of truth.

| Folder | Contents |
|---|---|
| `design/mobile/` | M01–M11 |
| `design/desktop/` | D1–D6 |
| `design/landing/` | L1–L5 |
| `design/foundations/` | color tokens, components core, library & player components, cover generated, icons, logo options |
| `design/review/` | working images (rejected options), not specs |
