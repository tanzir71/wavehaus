# Landing page + subpages (`/landing`)

Static HTML + CSS, with no JS required. One optional script is allowed: under 3 KB, deferred, for the platform switch on the Background play page. Every page scores Lighthouse 100/100/100/100.

On GitHub Pages:
- the landing is served at `/wavehaus/`
- the app (demo mode) at `/wavehaus/app/`

In production, the landing can live at the root of the owner's marketing domain. The app runs wherever the owner deploys it.

## Pages (Figma page "03 · Landing", PNGs in `design/landing/`)

| Page | Route | Node | PNG |
|---|---|---|---|
| L1 Landing | `/` | `28:171` | `L1-landing.png` |
| L2 Docs template (shown: Install on shared hosting) | `/docs/shared-hosting` | `57:649` | `L2-docs-shared-hosting.png` |
| L3 Background play | `/background-play` | `57:817` | `L3-background-play.png` |
| L4 Self-hosted Spotify alternative | `/self-hosted-spotify-alternative` | `57:1012` | `L4-self-hosted-spotify-alternative.png` |
| L5 Changelog | `/changelog` | `57:1187` | `L5-changelog.png` |

**Docs pages built from the L2 template** (left nav, article, "On this page" contents, previous/next):

| Route | Covers |
|---|---|
| `/docs/` | Overview |
| `/docs/shared-hosting` | the shared-hosting install (L2) |
| `/docs/cloudflare` | `DEPLOY.md` § C |
| `/docs/local` | local development |
| `/docs/upload-organise` | upload and organise |
| `/docs/private-public` | `VISIBILITY.md`, written for users |
| `/docs/members` | `AUTH.md` registration modes |
| `/docs/updating` | updating safely |
| `/docs/backups` | backups |
| `/docs/assistants` | `ASSISTANTS.md`, user view |
| `/privacy` | short: no analytics, nothing leaves your server |

Content comes from the matching handover docs, rewritten for users.

**Nav** (same on every page): logo lockup · Features · How it works · Self-host · Compare · Docs · Star on GitHub (secondary) · **Deploy free** (primary, light). The footer is the same on every page too.

## SEO

- **Brand + descriptor:** "Wavehaus — self-hosted music streaming".
  - "Wavehaus" is a made-up word, so it can rank first for its own name.
  - Domain, npm, GitHub and trademark availability are **not yet checked**. Check them before launch.
- L1 `<title>`: `Wavehaus — Self-Hosted Music Streaming PWA with Background Play`.
- L1 description: `A self-hosted music app that installs from the browser and keeps playing with the screen off. Upload from your phone, deploy on a $3 PHP host or Cloudflare in five minutes.`
- **H1 = the eyebrow** (styled Mono/S): `Self-hosted music streaming · PWA`. The display line ("No app store. Screen off. Still playing.") is a `<p class="display">`. This keeps the keyword phrase in the H1.
- Each subpage has one H1 that matches its search intent:

  | Page | H1 |
  |---|---|
  | L3 | "Keep playing with the screen off" (background play PWA, Brave background audio) |
  | L4 | "The Spotify experience, for music you already own" (self-hosted Spotify alternative) |
  | L2 | "Install on shared hosting" (self-hosted music server on shared hosting / Namecheap) |

- Structured data:
  - L1: `SoftwareApplication` (applicationCategory MultimediaApplication, offers price 0, license MIT, operatingSystem "Web, Android, iOS, Windows, macOS, Linux")
  - L3: `FAQPage` (its 4 questions)
  - L2: `HowTo` (the 5 steps)
  - every subpage: `BreadcrumbList`
- `og.jpg` (1200×630): crop of the L1 hero, with the phone and the headline.
- Canonicals, `sitemap.xml`, `robots.txt`, `lang="en"`.
- Self-hosted fonts, with Geist 600 preloaded.
- AVIF/WebP `srcset` for the hero photo. Every image has width/height and alt text.

## L1 sections & copy (verbatim from Figma)

1. **Hero** (`28:197`)
   - Background: monochrome render (`assets/unsplash/landing-hero-abstract-curves.jpg`) under a flat 45% black overlay. Use a solid overlay, not a gradient.
   - Eyebrow/H1: `SELF-HOSTED MUSIC STREAMING · PWA`
   - Display: `No app store.` / `Screen off.` / `Still playing.`
   - Lede: `Wavehaus installs from the browser like an app. Open it in Brave, switch on Background play, and your own library keeps going with the phone locked. Deploy it on a $3 shared host or Cloudflare in five minutes.`
   - Buttons: **Deploy in 5 minutes** (primary, links to `/docs/shared-hosting`) · **View on GitHub**
   - Mono line: `PWA · BRAVE BACKGROUND PLAY · PHP 8 + SQLITE OR CLOUDFLARE · MIT`
   - **Phone mock** (right): an Android lock screen showing:
     - 9:41, "Monday, 23 November"
     - the Wavehaus media notification card: cover, "Afterglow (Live)", "Halden · Wavehaus", waveform, 1:36 / 4:12, and heart / prev / pause / next / queue controls
     - the pill `BRAVE · BACKGROUND PLAY ON`
     - caption `SCREEN LOCKED · STILL PLAYING · ANDROID + BRAVE`

     Build it in HTML/CSS, not as an image: the waveform is the real component.
2. **How it works** (`29:515`). Moved up so the easy deploy comes second.
   - Eyebrow: `DEPLOY · INSTALL · LISTEN`
   - H2: `Live in five minutes. No terminal required.`
   - 01 **Deploy**: `Upload one zip with cPanel File Manager and open the setup page. On Cloudflare it is a single command.` Chip: `npx wrangler deploy`
   - 02 **Install**: `Open your Wavehaus in Brave and add it to the home screen. One tap opens it like any app. No app store, no review queue.` Chip: `Menu → Add to Home screen`
   - 03 **Lock your phone**: `Turn on Background play under Settings → Media in Brave. Lock the screen; the music keeps going.` Chip: `Settings → Media`
   - The three cards share one height, and the chips sit on the bottom edge.
3. **One library. Every screen.** (`28:225`): `A desktop app in the browser, an Android-first app on your phone. Same waveform, same queue, same place you left off.` Shows the desktop and phone product mock.
4. **Feature trio** (`28:391`). Each card is a **square-cornered panel with a crop of a real product screen**: no stock photos, no rounded image containers.
   - ORGANISE · **Drop folders. Done.** (crop of M9 Review import): `Tags, cover art and waveforms are read in your browser. Messy filenames get fixed in bulk. Duplicates are skipped.`
   - UPLOAD FROM ANY APP · **Share it to Wavehaus.** (crop of M7 Upload): `On Android, share audio from Files, a recorder or a chat app straight into your library. Uploads resume if the signal drops.`
   - DISCOVERY · **Mixes without surveillance.** (crop of M1 "Made for you"): `Daily mixes, radio and autoplay are computed on your own device from what you play and skip.`
5. **The waveform** (`29:422`). Unchanged:
   - `Every track gets a waveform.`
   - Scrub by shape / Save moments / Loop A–B
6. **Beyond playback** (`47:676`). This replaces the old six-tile grid; don't reintroduce an icon grid.
   - Eyebrow `BEYOND PLAYBACK`
   - H2 `Built for agents. Private by default. Light on infrastructure.`
   - Lede `The parts that usually need a server team: libraries run by your AI assistant, sharing rules per album, invite-only sign-ups. On a $3 host.`
   - Four rows. Each has a numbered eyebrow, an H3, a paragraph and mono facts on the left, and a **real UI fragment** on the right:
     - **01 · BUILT FOR AGENTS · Hand your library to an assistant.**
       - UI: the "Settings › Activity" panel showing actor "Claude's browser", five entries with Undo, and a TRY ASKING prompt.
       - Facts: `BROWSER SESSION · NOTHING TO INSTALL`, `SCOPED TOKENS · MCP SERVER`, `EVERY CHANGE ATTRIBUTED · 30-DAY UNDO`.
     - **02 · PRIVATE BY DEFAULT · Share an album, not your whole library.**
       - UI: the visibility sheet `Who can play "Glass Rooms"?`, Private/Public options, the "Tracks added later follow this album" toggle, the impact line, and the **Make 11 tracks public** button.
       - Facts: `TRACK · ALBUM · FOLDER · PLAYLIST`, `OTHER MEMBERS' TRACKS ARE NEVER CHANGED`, `ADMINS CAN TAKE DOWN, NEVER PUBLISH`.
     - **03 · ACCESS · Closed by default. Open by choice.**
       - UI: `Who can join music.tanziro.com` with segmented Closed / **Invite only** / Request access / Open sign-up; Invites per member 3; Storage per member 10 GB; Proof-of-work on; Uploads start Private; and a pending request from "Rafi K." (referred by Tanzir) with Deny/Approve.
       - Facts: `CLOSED · INVITE · REQUEST · OPEN`, `REFERRALS TRACKED · QUOTAS PER MEMBER`, `RECOVERY CODES INSTEAD OF EMAIL RESETS`.
     - **04 · RUNS ANYWHERE · Light on infrastructure.**
       - UI: a spec sheet with hairline dividers: SERVER, INSTALL, APP, BACKGROUND PLAY, HEAVY LIFTING, UPDATES, AUTH.
       - Facts: `NO DOCKER · NO NODE ON THE SERVER`, `NO FFMPEG · NO TRANSCODING`, `NO MYSQL · NO REDIS · NO QUEUES`.
7. **Compare** (`29:553`)
   - Wavehaus vs Navidrome, Koel and Funkwhale, with source footnote. L4 has the 5-way version including Ampache.
   - Re-verify the claims before publishing (`RESEARCH.md`).
8. **Closing band** (`29:584`)
   - Headline: `Your library is the best playlist you'll ever own.`
   - Buttons: **Deploy Wavehaus** (primary) · **Read the docs**.
   - The background is a **generative wave field** drawn from the Wave W mark, not a photo: 26 tonal sine lines (white at 5–16% opacity), with one accent line under the buttons.
   - Render it as inline SVG generated at build time (`landing/scripts/wave-field.mjs`). Use the same maths as the Figma layer: amplitude envelope `6 + 46·e^(−t²)`, phase shift `0.22·i`, wavelength 520.
9. **Footer** (`29:593`)
   - Columns: PRODUCT (Features, Background play, Compare, Changelog) · SELF-HOST (Shared hosting guide, Cloudflare guide, Updating safely, API & assistants) · PROJECT (GitHub, Docs, Privacy, tanziro.com).
   - Tagline: `Self-hosted music streaming for your own files. MIT licensed.`
   - Credit line: `Photography on Unsplash: Andrew Kliatskyi` · `A TANZIRO.COM PROJECT`.

## L2–L5 content

- **L3 Background play:**
  - Header and lede.
  - Android / iPhone switch.
  - The four Android steps:
    1. Get Brave (intent link)
    2. Turn on Background play
    3. Add the one-tap icon
    4. Run the 30-second test
  - Alongside the steps, the live M8 screen.
  - The iPhone band: Option A (Brave as default browser + Add to Home Screen with Open as Web App off) and Option B (a Shortcuts icon), with a copyable `brave://open-url?url=` link. The two option cards share one height.
  - The four-question FAQ.
  - Copy is in the Figma frame and matches `PLAYBACK.md`.
- **L4 Self-hosted Spotify alternative:**
  - Header with buttons.
  - "What you keep from Spotify" and "What you get that Spotify won't" (two equal-height panels).
  - A 5-way comparison: Wavehaus / Navidrome / Koel / Funkwhale / Ampache × upload, what you run, on your phone, database.
  - The honest "When something else is a better fit": Navidrome for an existing home server, Jellyfin/Plex for video, Funkwhale for federation.
- **L5 Changelog:** generated from `CHANGELOG.md` at build time. Each entry shows version, milestone, status chip, a title and 3 bullets. The header links the Pages preview.

## Images

- Only **one photo** is in use: `landing-hero-abstract-curves.jpg` (Andrew Kliatskyi, Unsplash License).
- Everything else is product UI or generated graphics.
- Earlier candidates are in `assets/unsplash/_unused/`; don't use them.
- Build the responsive sizes with `sharp` (dev only).
