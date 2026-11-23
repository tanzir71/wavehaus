# Instance homepage (L6): the site that ships with every Wavehaus server

The owner's deployment is **one origin** that serves both the website and the app, following the Loft/Tack pattern:

```
https://music.tanziro.com/        → instance homepage (L6): the owner's music, playable without an account
https://music.tanziro.com/app/    → the Wavehaus PWA (sign in, library, upload, settings)
https://music.tanziro.com/join/…  → invite links          /api/… /media/… /art/… → the API
```

**The app is the primary action.** "Open the app" is the primary button everywhere. The owner's music is playable right on the page. Invites follow the registration mode, and GitHub is a quiet secondary link.

The project marketing site (L1–L5, `LANDING.md`) is separate: it lives on GitHub Pages and the repo README, and sells Wavehaus to self-hosters. Every deployed server shows **L6** at `/`, and its owner customises it in **Settings → Homepage**.

Figma, on page 03 · Landing:
- L6 desktop: `59:701`, exported as `design/landing/L6-instance-homepage-desktop.png`
- L6m mobile (412, Android-first): `60:767`, exported as `L6m-instance-homepage-mobile.png`

## Sections (desktop, then mobile stacking)

1. **Nav**
   - Left: Wave W lockup and a host tag (`MUSIC.TANZIRO.COM`, Mono/S on surface/1).
   - Right: "Source on GitHub" (quiet text link with icon) · **Sign in** (secondary) · **Open the app** (primary).
   - When signed in, show only **Open the app** and the avatar.
   - Mobile shows the lockup and **Open the app** only.
2. **Hero: listen here.** This is the featured release, set in Settings → Homepage.
   - **Left copy:**
     - Eyebrow `TANZIR · NEW ALBUM`
     - Display title = featured title (`Dual Frequency`)
     - Intro: "My own music, streaming from my own server. Press play right here, or open the app and keep listening with your screen off."
     - Meta `8 TRACKS · 29 MIN · NO ACCOUNT NEEDED TO LISTEN`
     - **Open the app** + **Request an invite** buttons (the second one depends on the registration mode; see below)
     - Install note: "Installs from the browser. Plays in the background on Android with Brave."
   - **Right: showcase player card.**
     - Cover (real or generated), title, artist, and a large play button.
     - The real `Waveform` scrubber with times and a `NOW PLAYING · 02 SIGNAL` label.
     - The first 6 tracks, with the playing row highlighted.
     - The line `+ 2 MORE · OPEN IN THE APP FOR THE FULL ALBUM, QUEUE AND DOWNLOADS`.

     On mobile, this card sits under the intro, shows 4 tracks, and the buttons go full width below it.
3. **The app.**
   - The lock-screen phone, showing the owner's track playing via Brave.
   - "Take it with you. No app store."
   - Three steps: Open this site in Brave · Add it to the home screen · Turn on Background play.
   - **Open the app**, plus "How background play works →" (the in-app guide, or the project's L3 page).
4. **More to listen to.** Up to 8 showcase items (albums and playlists) as covers, with title and a mono meta line. Note: "Everything here plays without an account." Tapping an item plays it in the hero card. Opening it in the app needs an account.
5. **Invites** (shown only when the registration mode is not `closed`; this is the `request` state):
   - Copy: "Want your own account? Ask for an invite." / "Members can upload their own music, keep it private, make playlists and listen on every device. I read every request and send codes by hand."
   - The request form: Your name · How should I reach you? (optional) · A note (optional) · **Request invite** (full width) · `NO EMAIL REQUIRED · SPAM CHECK RUNS IN YOUR BROWSER`.
   - Below the form: "Have an invite code?" with an input and a **Join** button.
6. **Open source band (quiet):** "This server runs Wavehaus. Run your own in five minutes." · `MIT · PHP 8 + SQLITE OR CLOUDFLARE · GITHUB.COM/TANZIR71/WAVEHAUS` · View on GitHub (secondary) · Self-host guide (ghost). The owner can hide it.
7. **Footer:** lockup · `© 2026 TANZIR · MUSIC.TANZIRO.COM` · Open the app · Background play · Privacy · GitHub · tanziro.com (owner-defined links).

### CTAs by registration mode (`AUTH.md`)

| Mode | Hero secondary button | Invite section | Nav |
|---|---|---|---|
| `closed` | none | hidden | Sign in · Open the app |
| `invite` | "Have an invite?" (scrolls to the code field) | code field only | Sign in · Open the app |
| `request` | "Request an invite" | request form + code field (as designed) | Sign in · Open the app |
| `open` | "Create an account" | replaced by a sign-up card | Sign in · Open the app |

Signed-in visitors see none of the invite UI.

## Showcase (what visitors may play without an account)

Visibility stays two-level (`VISIBILITY.md`): private / public, where public means signed-in members. **Showcase is an extra, owner-curated flag**, and only showcased items can be played anonymously:

- The owner or admins add **public** albums, playlists or tracks to the showcase (ordered, max 8) and choose one as **featured**, which fills the hero.
  - Adding a private item asks: "Make Glass Rooms public and show it on the homepage?" This uses the same counts and undo as the visibility sheet.
- Anonymous visitors can stream **only tracks inside showcased items**, through `/media/:id` and `/art/…`:
  - rate-limited per IP (300 requests / 10 min)
  - `Range` supported
  - `Cache-Control: public, max-age=600`
  - no download button

  Everything else still returns 401 or 403.
- When an item is removed from the showcase or made private, anonymous access ends on the next request. CDN caches expire within 10 minutes; Cloudflare also purges by URL on change.
- Members' uploads can never be showcased by members. Only the owner and admins curate. A member's public album can be showcased only if the member allows it: there's a per-album "Allow on homepage" toggle, off by default.
- Anonymous plays are counted per item per day (`showcase_stats`) for the owner. No visitor tracking, no cookies, no analytics.

## Settings → Homepage (owner/admin, D5 layout)

Fields:
- **Homepage**: on, or off. When off, `/` redirects to `/app/`.
- **Title**: defaults to the featured item's title.
- **Eyebrow**: e.g. `TANZIR · NEW ALBUM`.
- **Intro** (≤ 240 chars).
- **Featured** item picker.
- **Showcase items**: a drag-sortable list with an "Add from library" picker.
- **Visitors can play the showcase without an account**: on by default.
- **Show "Source on GitHub" and the open-source band**: on by default; the URL defaults to `https://github.com/tanzir71/wavehaus`.
- **Footer links**: label + URL, max 5.
- **Owner name**: used for `©` and for metadata.

There's a live preview pane on the right (desktop) or a "Preview" button (mobile). Saving writes `settings.homepage` and creates a `changes` entry with undo.

## Implementation

- **Routes:**
  - `GET /` is the homepage document, rendered on the server so it has content and meta tags without JS. PHP uses a small template (`server-php/templates/home.php`); the Worker uses a template string.
  - The showcase JSON is inlined as `<script type="application/json" id="wh-home">`.
  - JS is a single small module, `home.js` (≤ 25 KB gzip). It reuses `app/src/engine` (the same audio engine, Media Session and waveform canvas) without Preact, so lock-screen controls and Brave background play work on the homepage too.
- **The app moves under `/app/`:**
  - Vite `base: '/app/'`.
  - Manifest `start_url: "/app/?source=homescreen"`, `scope: "/app/"`.
  - The service worker is registered with `scope: '/app/'`. The homepage has its own tiny service worker, used only for the offline fallback page.
  - The install prompt and "Add to Home screen" from the homepage both install the app (the manifest is linked from `/` too, with the same `/app/` start URL).
- **Requests:** the invite form posts to `POST /api/auth/request-access`, with proof-of-work, honeypot and minimum fill time (`AUTH.md`). "Join" goes to `/join/<code>`, inside the app.
- **SEO:**
  - `<title>`: `{Title} by {Owner} — listen on {host}`
  - description: from the intro
  - JSON-LD: `MusicAlbum` or `MusicPlaylist` with `track` items and `byArtist` (Person = owner), plus `WebSite`
  - `og:image`: 1200×630, rendered client-side from the cover or generated cover when settings are saved, uploaded to `/art/home-og.png`
  - canonical = `/`
- **Demo / Pages preview:** in demo mode, the homepage is served at `/wavehaus/home/`, built from the seeded albums, so the owner can review L6 on every milestone preview.
- **Performance:** server-rendered HTML ≤ 30 KB, LCP under 1.5 s on a mid Android over 4G, and no layout shift when the player hydrates.

## Acceptance

1. A signed-out visitor on Android Brave can play the featured album from `/`, lock the phone, and keep listening. Lock-screen artwork and controls show.
2. A signed-out visitor gets 401 from `/media/:id` for any track not in a showcased item.
3. When the owner removes an album from the showcase, the next anonymous request for its tracks fails.
4. Switching the registration mode changes the homepage CTAs exactly as in the table above.
5. "Open the app" goes to `/app/`. If there's no session, the app shows sign-in. With one, it opens Home.
6. With JavaScript disabled, `/` still shows the title, intro, track list, CTAs and links, and validates as `MusicAlbum` structured data.
