# Playback & background play

Background play is the key requirement. Wavehaus stays a PWA, so we do two things:

1. **Engine hardening**: an audio engine that the OS treats as a real media session and that never gives the browser a reason to suspend it.
2. **The Brave route**: in-app guidance that makes Brave the supported way to listen in the background on phones, with a one-tap home-screen icon and a self-test.

## 1. Engine (`app/src/engine/`)

No UI imports. Public API: `load(queue, index)`, `play()`, `pause()`, `seek(ms)`, `next()`, `prev()`, `setRepeat('off'|'all'|'one')`, `setShuffle(bool)`, `setAutoplay(bool)`, `setLoop(aMs, bMs | null)`, `sleep(minutes | 'endOfTrack' | null)`, signals for `state`, `positionMs`, `bufferedMs`, `current`, `queue`.

### Rules

- **One persistent `<audio>` element** created once at boot, appended to `document.body`, never re-created, never removed on route changes. On iOS, use exactly one element for everything (iOS allows one active media session per page).
  - Non-iOS only: a second hidden `<audio preload="auto">` preloads the next track. On `ended`, swap roles.
- **Never route the playback element through Web Audio on iOS.** `createMediaElementSource` makes iOS suspend audio in the background. Waveforms come from stored peaks, not an `AnalyserNode`. Crossfade and ReplayGain (P2) use `element.volume` on desktop/Android only. iOS volume is read-only, so skip both there.
- **Advance synchronously in `ended`.** Inside the `ended` handler, in the same task: set `audio.src = nextUrl`, then `audio.play()`. Don't `await` anything before setting `src`, and don't fetch metadata first. A gap in the background can lose the media session on iOS and some Android OEM skins. Resolve the next track's URL ahead of time (`/media/:id`, same-origin, cookie auth).
- **Same-origin media URLs only.** No signed query tokens (they expire mid-session) and no redirects to other hosts.
- **Media Session** (`navigator.mediaSession`):
  - On every track change, set `metadata = new MediaMetadata({ title, artist, album, artwork })`.
  - Artwork: `[{src:'/art/<albumId>/600.webp?v=<rev>', sizes:'600x600', type:'image/webp'}, {src:'/art/<albumId>/96.webp?v=<rev>', sizes:'96x96', type:'image/webp'}]`. With no real art, use `/art/<albumId>/generated-512.png` (rendered client-side at upload; see `ORGANISE.md`), so the lock screen is never blank.
  - Handlers: `play`, `pause`, `stop`, `previoustrack`, `nexttrack`, `seekto` (respect `fastSeek`), `seekbackward`/`seekforward` (10 s).
  - `setPositionState({ duration, playbackRate, position })` on `loadedmetadata`, `seeked`, `ratechange`, `play` and `pause`, and at most once every 5 s while playing. Clamp `position <= duration`.
  - `playbackState` mirrors the engine state.
- **Audio session (Safari 17+):** `if ('audioSession' in navigator) navigator.audioSession.type = 'playback'` before the first play.
- **Start from a user gesture.** The first `play()` must come from a tap (autoplay policy). After that, track changes in `ended` are allowed.
- **Recovery:**
  - On `error` with `MEDIA_ERR_NETWORK`, or `stalled` longer than 8 s: remember `currentTime`, then reassign the same `src`, seek and play again. Back off at 1, 2, 4, 8 s, then surface a toast.
  - On `online`, retry immediately.
  - On `MEDIA_ERR_SRC_NOT_SUPPORTED`, skip to the next track and mark the track "can't play on this device". Per-device codec probing uses `canPlayType`: ALAC/AIFF often fail outside Apple, and Opus/OGG fails on older iOS.
- **Interruptions:**
  - When a call or another app pauses us, `pause` fires without our intent. Mark `interrupted = true`. Don't auto-resume, except on Android when `play` comes from the Media Session.
  - Never call `play()` from `visibilitychange`.
- **Persist state**: queue, index and position go to IndexedDB every 5 s, and to `PUT /api/player-state` on pause, on track change and on `pagehide` (`sendBeacon`). On boot, restore paused at the saved position ("Jump back in").
- **Plays**: record when a track ends or changes. A track is `completed` when `ms_played ≥ 0.8 × duration`. It is `skipped` when the user skips before 30 s (or before 50% for tracks shorter than 60 s). Batch to `POST /api/plays`.

### Queue semantics (Spotify parity)

- The queue has three parts: **Now playing**, **Next in queue** (user-added, plays first, drag to reorder) and **Next from: <context>** (album/playlist/search results).
- When the context runs out and **Autoplay** is on (default), append 10 tracks from `recs.radio(seedTrack)` and show them under "Autoplay". Refill when 3 are left.
- Repeat cycles off → all → one. Repeat-one replays the current track on `ended` (`currentTime = 0; play()`).
- **Shuffle** is "smart shuffle": a deterministic shuffle of the context, weighted to avoid the same artist back to back. Toggling it keeps the current track.
- **Loop A–B** (P1): set A and B on the waveform. On `timeupdate`, if `t ≥ B` then `seek(A)`. A `requestAnimationFrame` check while visible gives tighter loops.
- **Sleep timer**: 5/15/30/45/60 min or end of track.
  - Desktop/Android: fade the volume over the last 10 s, then pause.
  - iOS: pause at the time, with no fade.
- **Moments** (P1): long-press the waveform (500 ms) to create a moment at that time. The label is optional.

### Offline (downloads)

- When a track is downloaded, `fetch('/media/:id')`, then `cache.put()` the full response into `wh-audio-v1`.
- The service worker answers `Range` requests from the cache by slicing the blob. It returns `206` with `Content-Range: bytes s-e/total`, `Accept-Ranges: bytes` and `Content-Length`. Without `206`, seeking breaks on Safari and Chrome.
- Downloads use a queue of 2 concurrent requests, show the storage meter (`navigator.storage.estimate()`), and call `navigator.storage.persist()` the first time.

## 2. The Brave route

### Why Brave

- On iOS, every browser uses WebKit. Background audio for web pages and home-screen web apps is unreliable: it often stops a while after the screen locks or when the app is switched.
- Brave has a dedicated setting that keeps media playing when you switch apps or lock the screen:
  - Android: **Settings → Media → Background play**
  - iOS: **Settings → Media → Enable Background Audio**
- Wavehaus treats Brave as the supported route on phones, explains it once, and verifies it with a test. Chrome on Android usually keeps `<audio>` playing too, but OEM battery managers can still kill it. Brave plus the setting is the path we document and test.

### Detection & handoff (`engine/brave.ts`)

```ts
export const isBrave = async () => !!(navigator as any).brave && await (navigator as any).brave.isBrave();
export const platform = () => /android/i.test(navigator.userAgent) ? 'android'
  : (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'ios' : 'desktop';
export const openInBraveUrl = (url = location.href) => platform() === 'android'
  ? `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.brave.browser;S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.brave.browser')};end`
  : `brave://open-url?url=${encodeURIComponent(url)}`;
```

- On a phone that isn't Brave, show the **"Background play works best in Brave"** banner on Home and on the first Now Playing (dismissible, comes back after 7 days, max 3 times). The buttons are **Open in Brave** (the URL above) and **How it works** (opens the Background play screen).
- On iOS, if `brave://` does nothing within 1.5 s (no `visibilitychange`), show the App Store link: `https://apps.apple.com/app/brave-private-web-browser/id1052879175`.
- In Brave, show the setup checklist instead. The app can't read the Brave setting, so the checklist ends with the self-test.

### Screens

- **M8 Background play · Brave · Android** (412×915, Figma `19:857`)
- **M8b Background play · Brave · iPhone** (390×844, Figma `19:936`)

Both are reachable from Settings → Playback → Background play, from the banner and from the "Test background play" row. Each screen has three numbered steps:

**Android (Brave)**
1. **Open Wavehaus in Brave.** Button: **Open in Brave**, or **Get Brave** if it isn't installed.
2. **Turn on Background play.** Brave three-dot menu → **Settings → Media → Background play** → on.
3. **Add Wavehaus to your home screen.** In Brave, on Wavehaus: three-dot menu → **Add to Home screen** (shows as **Install app** when the PWA is installable) → **Add**. The icon opens Wavehaus in Brave with one tap. The **Show me** button opens an inline illustrated sheet.

**iPhone (Brave)**
1. **Open Wavehaus in Brave.** **Open in Brave** (`brave://open-url?url=…`).
2. **Turn on Enable Background Audio.** Brave **Settings → Media → Enable Background Audio** → on.
3. **Add a one-tap icon.** Two methods, A shown first:
   - **A — Brave as default browser** (iOS 18.2+ / 26): iOS Settings → Apps → Brave → Default Browser App → Brave. Then in Brave, on Wavehaus: Share → **Add to Home Screen**. On iOS 26, turn **Open as Web App off** so the icon opens a Brave tab. A standalone web app runs in WebKit outside Brave and loses the Brave setting.
   - **B — Shortcuts** (works on any iOS version, opens Brave directly): Shortcuts app → + → **Open URLs** → `brave://open-url?url=https://<your-host>` → name it **Wavehaus** and choose an icon (download `/icons/shortcut-icon-180.png` from the screen; the source is `assets/brand/shortcut-icon-180.png`) → Share → **Add to Home Screen**.
   The screen includes a **Copy shortcut URL** button that copies the exact `brave://open-url?url=<encoded origin>` string.

**Both:** step 4 is the **30-second test**. **Start test** plays `/chime-test.mp3`, a 45 s quiet tone that ends in a chime. It tells you to lock the phone and wait for the chime. When you come back, the app compares wall-clock time with `audio.currentTime` progress:
- Pass: drift under 3 s and not paused. Store `bgTest = {pass, ua, at}` in localStorage, and show "Background play verified on this device" in Settings.
- Fail: show the most likely fix: the setting is off, you're not in Brave, the icon opens a standalone web app (iOS), or battery optimisation is on (Android → App info → Battery → Unrestricted).

### Copy (use verbatim)

Screen copy, as in Figma M8/M8b:
- Title: "Background play". Subtitle: "Keep playing with the screen off".
- Intro: "Wavehaus is a web app. Brave is the browser we support for background play: lock your phone or switch apps and the music keeps going."
- Status chip shows the detected browser ("You're in Chrome" / "You're in Brave"), plus an Android / iPhone segmented toggle that defaults to the detected platform.
- Step 1 "Get Brave": "Free on Google Play. "Open in Brave" hands this page straight to Brave." (iPhone: "Free on the App Store. "Open in Brave" hands this page to Brave."). The handoff URL is shown in Mono below it.
- Step 2 "Turn on Background play": "Brave → Settings → Media → Background play." (iPhone, "Enable Background Audio": "Brave → Settings → Media → Enable Background Audio."). Includes a mock settings row with the breadcrumb "BRAVE › SETTINGS › MEDIA".
- Step 3 "Add the one-tap icon":
  - Android: "In Brave: three-dot menu → Add to Home screen (may read "Install app") → Add. Tapping the icon opens Wavehaus in Brave."
  - iPhone: "Option A: make Brave your default browser, then Share → Add to Home Screen and switch off "Open as Web App". Option B: Shortcuts → Open URLs → paste the link below → Add to Home Screen."
  - Below the step: an icon preview "Wavehaus · Opens in Brave · one tap".
- Step 4 "Test it": "Play a track, lock your phone, wait for the chime. Still playing? You're set." (iPhone: "Play, lock, wait for the chime.")

Other strings:
- Banner: "Background play works best in Brave. Keep music going when you lock your phone or switch apps." Buttons: Open in Brave / How it works
- Android step 2: "In Brave, open the menu (three-dot menu) → Settings → Media → turn on Background play."
- iOS step 2: "In Brave, open Settings → Media → turn on Enable Background Audio."
- Test pass: "Background play works on this device."
- Test fail: "Playback stopped after {n}s. Check that Background play is on, then try again."

### Manifest & install

- `manifest.webmanifest`: `name: "Wavehaus"`, `short_name: "Wavehaus"`, `display: "standalone"`, `start_url: "/?source=homescreen"`, `background_color: "#0A0A0B"`, `theme_color: "#0A0A0B"`, icons from `assets/brand/` (`icon-192.png`, `icon-512.png` `purpose:any`, `icon-maskable-512.png` `purpose:maskable`), `apple-touch-icon-180.png` and `favicon-32.png`/`favicon.svg` in `<head>`. On GitHub Pages, use `start_url: "./?source=homescreen"` and `scope: "./"` (relative to `/wavehaus/app/`).
- `share_target`: see `ORGANISE.md`.
- With `?source=homescreen` and not standalone, the app can tell it was opened from a shortcut in a tab, which is the desired iOS route. Show nothing extra.
- If `display-mode: standalone` on iOS and the background test failed, show the hint: "Home-screen web apps on iPhone may pause in the background. Use method A or B."

## Platform notes (support matrix)

| Platform | Background audio | Notes |
|---|---|---|
| Android · Brave (Background play on) | Supported route | Install or shortcut both open in Brave |
| Android · Chrome | Usually works for audio | Media notification shows. OEM battery killers can stop it; suggest Unrestricted battery |
| iOS · Brave (Enable Background Audio on, opened as a tab) | Supported route | Use method A (Open as Web App off) or B (Shortcuts) |
| iOS · Safari tab / home-screen web app | Best effort | Engine rules maximise survival. Not promised |
| Desktop browsers | Works | Media keys via Media Session |
