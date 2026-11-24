# Upload, auto-organise & bulk edit

Goal: **drop files → they're in the library, organised, playable on the phone within seconds.** Fix what's wrong in bulk, never one by one. All analysis runs in the browser (`app/src/upload/`). The server only stores bytes and rows.

## Entry points

- **Desktop:** drag files or folders anywhere in the app. A full-window drop overlay says "Drop to add to your library". Buttons: **Choose files** (`<input type=file multiple accept="audio/*,.flac,.m4a,.alac,.opus,.ogg,.wav,.aiff,.lrc,image/*">`) and **Choose folder** (`webkitdirectory`). Folder drops use `DataTransferItem.webkitGetAsEntry()` recursion, which keeps the relative paths.
- **Mobile (M7, `11:700`):** big **Choose files** button. **Choose folder** where supported (Android Chrome/Brave support `webkitdirectory`). Recent uploads list.
- **Android share target:** in `manifest.webmanifest`:
  ```json
  "share_target": { "action": "/share-target", "method": "POST", "enctype": "multipart/form-data",
    "params": { "files": [{ "name": "audio", "accept": ["audio/*", ".flac", ".m4a", ".opus", ".ogg", ".wav", ".mp3"] }] } }
  ```
  The service worker stores the files in IndexedDB and redirects to `/upload?shared=1`, which starts the pipeline automatically.
- **Assistants:** the same inputs, driven by Claude/Codex in their browser. API route in `ASSISTANTS.md`.

Sidecar files dropped with the audio are matched by folder and basename: `cover.jpg|png|webp`, `folder.*`, `front.*`, `album.*`, `*.lrc`.

## Pipeline (per file, 3 files in parallel, in a Web Worker where possible)

1. **Sniff and allow-list.** Check the extension and magic bytes (ID3/`ÿû` MP3, `fLaC`, `OggS`, `ftyp` M4A/ALAC, `RIFF…WAVE`, `FORM…AIFF`). Unsupported files show in the review screen as "Skipped: not audio".
2. **Quick hash.** `sha256(first 1 MB ‖ last 1 MB ‖ size)`. Batch `POST /api/uploads/check`. Duplicates are marked "Already in library" and skipped (the user can override).
3. **Tags.** `music-metadata` `parseBlob(file, { duration: true, skipCovers: false })`. Read: title, artist(s), albumartist, album, track/disc no, year, genre, bpm, embedded picture, USLT/SYLT lyrics, ReplayGain, format (codec, container, bitrate, sampleRate, bitsPerSample, channels, duration).
4. **Organise guess** (rules below). Each field gets a source (`tags`, `folder` or `filename`) and a confidence (high, medium or low).
5. **Artwork** (resolution order): embedded picture → sidecar in the same folder (`cover` > `folder` > `front` > `album` > the only image in the folder) → existing album art on the server → **generated**. Resize with `OffscreenCanvas` (or canvas) to 600 and 96 px WebP (q 0.82). For generated covers, also render `generated-512.png` (see below).
6. **Peaks.** Only when the device is capable: `file.size ≤ 80 MB` and `(navigator.deviceMemory ?? 4) ≥ 4`, and not on Save-Data.
   - Use `AudioContext.decodeAudioData` on an `OfflineAudioContext`-sized buffer.
   - Compute **1000 buckets** of max |sample| across channels, scale with `sqrt` and normalise to the track max, then quantise to uint8 and base64 encode.
   - Free the buffer immediately.
   - If skipped, peaks stay `NULL` and any later player who can decode backfills them with `POST /api/tracks/:id/peaks`, computed on the first full play on a capable device. Until then, waveforms render as a flat placeholder line with the same height rhythm (`DESIGN.md`).
7. **Full SHA-256** (streamed with `crypto.subtle.digest` over 8 MB slices, combined via an incremental hash in the worker). Upload starts in parallel. The hash is sent at `complete`.
8. **Upload.** `POST /api/uploads`, then `PUT` parts (2 parallel) and `complete` with metadata, album, peaks and visibility (the default comes from settings, normally private).
   - Retry each part 5 times with exponential backoff.
   - Persist `{uploadId, file handle or blob key, partsReceived}` in IndexedDB so a reload or a background kill resumes. `GET /api/uploads/:id` returns the parts already received.
   - Keep the screen awake while uploading (`navigator.wakeLock.request('screen')` if available). Show "Keep Wavehaus open while uploading" on mobile.
9. **Instant library.** On `complete`, the track row is inserted locally, so it appears in the library and search immediately, and on other devices on their next sync (≤ 60 s, or immediately on focus).

## Auto-organise rules (`upload/organise.ts`)

Settings → Library rules lists these rules. Each one can be toggled. They are stored in `settings.library_rules`.

1. **Tags first.** Use the tag value when it's present and not junk.
2. **Folder names next.** `Artist/Album/…`, `Artist - Album (Year)/…` and `Album/…` (with the artist from the parent or the tags). Recognise `CD1`, `Disc 2` and `Disc 2 of 2` subfolders as disc numbers.
3. **Filename patterns last** (the first match wins, case-insensitive):
   - `^(?<track>\d{1,3})[\s._-]+(?<artist>.+?)\s+-\s+(?<title>.+)$`
   - `^(?<artist>.+?)\s+-\s+(?<track>\d{1,3})\s+-\s+(?<title>.+)$`
   - `^(?<track>\d{1,3})[\s._-]+(?<title>.+)$`
   - `^(?<artist>.+?)\s+-\s+(?<title>.+)$`
   - `^(?<disc>\d)(?<track>\d{2})\s+(?<title>.+)$` (e.g. `101 Intro`)
   - otherwise the title is the filename.
4. **Strip junk** from names: `\[(official|lyric|audio|video|hq|hd|320|flac|mp3|free download)[^\]]*\]`, `\((official\s*)?(music\s*)?(video|audio|lyrics?)\)`, ` - Copy`, `(1)`, `www.*.com`, `_` → space, repeated spaces, `.mp3.mp3`. Leave "feat." and "remix" in place.
5. **Title Case** only when the whole field is UPPER or lower case. Keep these as they are: `DJ`, `MC`, `EP`, `LP`, `UK`, `USA`, roman numerals, and words with inner capitals (`McCartney`, `iPhone`).
6. **Group into albums** by `(albumArtist ?? artist, album)`, case-insensitive with whitespace normalised. Tracks without an album:
   - With a shared folder, the album is the folder name.
   - Otherwise put them in **Singles · <Artist>**, or **Unsorted** if there's no artist.
7. **Various artists.** When there are more than 3 different artists under one album and no albumartist tag, set albumArtist to "Various Artists".
8. **Merge with existing albums.** If a server album **owned by the same uploader** exists with the same artist and title (normalised), attach to it. Albums are per uploader (`VISIBILITY.md`). New tracks take the album's visibility when its `sync_visibility` is on.
9. **Number missing track numbers** from filename order inside each album.
10. **Voice memos and recordings** (`Recording 12.m4a`, `PTT-2026…`, `AUD-…`) go to the album **Recordings** with the date from the filename or `lastModified`.

Confidence per track: **high** when tags are complete, **medium** when filled from the folder, **low** when filled from the filename or defaulted. Albums inherit the lowest confidence of their tracks.

## Review import (M9 `21:864`, D3 `26:664`)

Before choosing files, **Album assignment** offers tag/folder suggestions, one
new album (your title and album artist), or an existing album you own. The same
control in review can regroup the whole batch while it uploads or afterwards.
Individual song titles/artists stay intact. Explicit upload visibility wins over
album suggestions, unless the server locks uploads to Private; finishing import
organisation preserves each track's current visibility. Auto-organisation never
silently undoes a publication or publishes a private track.

On an album, use **Move tracks to album** or **Delete album**. A track's options
also offer **Move to album** and **Delete track**. Moves follow the destination's
visibility policy and confirm any publication; deletion retains original audio
for the existing 30-day Undo window.

Local regression checks: `npm test`, `npm run test:php -- --management` and
`npm run test:worker -- --management`. The management suites use disposable
stores and phone/desktop browsers; they never read or reset a live installation.

This screen appears after every drop, while the upload continues in the background. It is non-blocking: closing it accepts everything.

- **Summary:** "48 files → 4 albums · 2 need a look". Chips: All / Needs a look / Duplicates / Skipped.
- One **album group** per album: cover (real or generated), title, artist, year, track count, source badge (`From tags`, `From folders` or `From filenames`) and confidence dot. Tap a field to edit it inline.
- Tracks inside the group: number, title, a small waveform when peaks are ready, and a warning icon on low-confidence fields.
- Per-group actions: **Find artwork**, **Merge with…**, **Split**, **Visibility** (Private/Public).
- **Accept all guesses** (primary), **Bulk edit selected**, **Undo import** (removes the batch through the change log).
- Desktop D3 shows the drop zone and upload queue on the left and the review on the right, with the rules summary ("Tags → folders → filenames · strip junk · Title Case") and a link to Library rules.

## Bulk edit & rename (M10 `21:982`, D4 `26:1007`)

- Multi-select from any track list:
  - Desktop: checkboxes, shift-click for a range, `⌘/Ctrl+A`.
  - Mobile: long-press to enter selection mode, then tap.
  The selection bar shows the count and these actions: Edit, Rename, Artwork, Visibility, Add to playlist, Delete.
- **Edit fields:** artist, album artist, album, year, genre, disc. When the selection holds several values, the field shows "Mixed (3)". Leave it untouched to keep the per-track values.
- **Rename from pattern.** Pick a source (filename or current title) and a pattern. Presets match the filename patterns above. A custom pattern uses brace tokens: `{track} - {artist} - {title}`. Available tokens: `{track}`, `{disc}`, `{artist}`, `{albumartist}`, `{album}`, `{year}`, `{title}`, `{genre}`, and `{*}` (ignore). The same syntax both parses names (filename → fields) and formats them (fields → title). Live preview table: `Before → After`, with changed fields highlighted in accent/300 and unchanged fields in text/tertiary.
- **Quick fixes:** Title Case · Strip junk · Remove track numbers from titles · Trim "feat." into the artist field · Number tracks by current order.
- **Visibility:** Private / Public for the selection.
- **Artwork:** apply one image to all selected albums.
- **Apply** does one `PATCH /api/tracks` call with `perId` values, which creates one change-log entry ("Renamed 12 tracks"). The toast offers **Undo**. Undo works for 30 days from Settings → Activity.

## Generated covers (the default; most files have no art)

- **Tint:** `hash(lower(albumArtist ?? artist) + '|' + lower(album)) % 6` → Ink `#1B2142`, Teal `#0F2A2C`, Plum `#2A1C33`, Moss `#1A2A20`, Steel `#1C2733`, Graphite `#232326`. FNV-1a 32-bit is the hash.
- **Mark:** symmetric vertical bars from the album's **concatenated track peaks**, downsampled.
  - Large (≥ 96 px): **24 bars**, bar width 4.5% of the size, gap 2.2%, max height 46% of the size, centred vertically at 46%, corner radius 1 px at 600 px scale.
  - Small (< 96 px): **11 bars**, max height 56%, no text.
  - Bars are `rgba(255,255,255,0.26)` (tonal, low contrast).
  - With no peaks yet, use a deterministic pseudo-random pattern seeded by the same hash. It never changes for that album.
- **Text** (Large only): album title, Geist SemiBold, 7.5% of the size, white, max 2 lines, bottom-left inset 8%. Artist below it in Geist Mono Medium, 4.5%, 55% white, 1 line, ellipsis.
- **Rendering:** the same function renders the in-app cover (canvas or inline SVG, cached as an object URL in memory) and `generated-512.png` (uploaded for Media Session).
- The Figma reference is the component `Cover/Generated` (`12:216`) and the section Cover fallback (`12:174`).

## Find artwork

Triggered from **Find artwork** on an album, from the selection bar, or by an assistant.

- **Paste** an image (`paste` event on the dialog), **drop** an image, or **choose a file**. All are resized client-side to 600/96 WebP and sent with `PUT /api/albums/:id/art`.
- **Optional** `From URL` (P1): sent through `POST /api/albums/:id/art/from-url` because of browser CORS. SSRF-guarded server fetch.
- Assistants usually find art on the web, such as the Cover Art Archive or the label's or artist's site. They save it locally and use the file input or paste, so no server fetch is needed. See `ASSISTANTS.md`.

## Visibility

The full rules and UI live in **`VISIBILITY.md`**. In short:
- Every upload starts **private** (only the uploader can see or stream it).
- A whole **album, folder, playlist or multi-selection** can be made public or private in one step through `POST /api/visibility`. The sheet shows exact counts first.
- Albums keep new tracks in sync with the album's setting.
- Other members' tracks are never changed.
- Admins can force-private but never publish.
- Uploads: the Upload screen has a "New uploads: Private · Public" control (default Private). The review screen has a visibility chip per album group.
