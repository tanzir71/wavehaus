# Visibility: Private / Public for tracks, albums, playlists, folders

This file is the single source of truth for privacy. `ORGANISE.md`, `AUTH.md`, `API.md` and `ASSISTANTS.md` point here.

**Principle:** private is one tap; public always confirms, with counts. Bulk privacy should never mean editing tracks one by one.

## Model

- **The track is what gets enforced.**
  - `tracks.visibility` is `private` (default) or `public`.
  - `private` means only the uploader (`owner_id`) can see or stream it.
  - `public` means anyone visiting this server can see and stream it, including signed-out guests.
  - Guests use the normal app player, public library/search, media and artwork routes. Account data and every mutation still require sign-in. Private tracks never become public just because their album or playlist is visible.
- **Album:** `albums.visibility` + `albums.sync_visibility` (default on).
  - Albums are **per uploader**. Two members who upload the same record get two album rows, and auto-organise only merges into albums owned by the same uploader (`ORGANISE.md` rule 8).
  - Setting an album's visibility sets **every live track in it** to the same value, in one operation.
  - With `sync_visibility` on, tracks added to or moved into the album later take the album's visibility.
  - If one track is changed on its own afterwards, the album shows as **Mixed**. `albums.visibility` stays as "the default for new tracks".
- **Playlist:** `playlists.visibility` + `playlists.sync_visibility` (default off).
  - The playlist's own visibility decides who can see **the playlist**. Private means only the owner. Public means everyone, who sees **only the items they can play**. Hidden items are not shown or counted for them.
  - Making a playlist public offers **"Also make my N tracks in it Public"** (checked by default). Only the caller's own tracks change. Other members' tracks keep their own setting: "17 tracks by Mira and Nils keep their own setting".
  - Making a playlist private offers **"Also make my N tracks in it Private"** (unchecked by default). If checked, warn about collateral effects: "3 of them are also in 2 public playlists and 1 public album; they'll disappear there too."
  - `sync_visibility` on a public playlist ("Make tracks I add later Public too") publishes your own tracks as you add them. It's off by default, so adding to a public playlist never publishes silently.
  - **Liked songs** is a system list. It is always private as a list and can't be made public; offer "Copy to a new playlist" instead.
- **Folder (P1):** a target `{type:'folder', path}` that applies to all of the caller's tracks whose `original_path` starts with that path. This matches the "drop folders" mental model: the Library → Folders tab gets the same chip.
- **Selection:** any multi-selection of tracks, albums, playlists or folders can be set in one operation.
- **Album display state** (computed client-side from the caller's tracks):

  | State | Condition | Chip label |
  |---|---|---|
  | Private | all private | Private |
  | Public | all public | Public |
  | Mixed | otherwise | Mixed · 2 public |

- **Who can change visibility:**
  - Only the **uploader** can change their tracks, albums and folders. Only the **playlist owner** can change their playlist.
  - **Admin takedown:** admins (and the owner) may set **any** member's track, album or folder to **Private**, never to Public. It's logged, and the uploader sees "Made private by an admin" in Activity. This exists for copyright complaints.

## Where the controls live (UI spec; not drawn as separate Figma frames, compose from existing components)

1. **Visibility chip** (`Chip` with a `lock` or `globe` icon, Label/M), shown only to the owner of the item. Non-owners never see visibility controls.
   - **Mobile album/playlist page (M4 `10:599` layout):** in the action row, right after ⋯ (heart · download · ⋯ · **[lock] Private**), left of shuffle/play.
   - **Desktop album/playlist page (D2 `22:453`):** the existing "Private" chip next to the meta line becomes the trigger. Add a `chevron-down` icon and make it a button.
   - **Library rows** (albums, playlists, folders): a 12 px lock or globe glyph in the meta line ("Album · Halden · lock").
   - **Track rows:** in a **Mixed** album, private tracks show a 12 px lock after the title (text/tertiary). In all-private or all-public albums there are no per-row glyphs (less noise).
   - **Now Playing (M5):** the existing PRIVATE/PUBLIC badge. Tapping it opens the track-level sheet.
2. **Visibility sheet (mobile)** or **popover (desktop, 360 wide, anchored to the chip)**:
   - Bottom sheet styling: `bg/raised`, top radius `l` (20), solid black scrim at 60% opacity (flat; no blur or shadow), and a grab handle 32×4 in `surface/3`.
   - **Title** (Title/S): `Who can play "Glass Rooms"?` For a playlist: `Who can see "Late-night drive"?`
   - **Context line** (Body/S, text/secondary):
     - Album: "11 tracks · uploaded by you"
     - Mixed album: "Now: 9 private · 2 public"
     - Playlist: "48 tracks · 31 yours · 17 by others"
     - Selection: "3 albums · 2 playlists · 52 of your tracks"
   - **Two option rows**, 64 px high, radius m, `surface/1`. The selected row is `accent/900` with an `accent/500` radio.
     - `lock` **Private**: "Only you can see and play it."
     - `globe` **Public**: "Everyone on {serverName} can play it."
   - **Rows by target:**
     - Album: toggle "Tracks added later follow this album" (default on).
     - Playlist: checkbox "Also make my 31 tracks Public / Private" (default on when going public, off when going private), plus the sub-line about other members' tracks. Then the toggle "Make tracks I add later Public too" (only shown when Public is selected).
     - Folder: the same as album, with the text "Tracks uploaded to this folder later follow it".
   - **Impact line** (Mono/S, text/secondary): `AFFECTS 31 TRACKS · UNDO FOR 30 DAYS`. Add `· ALSO IN 2 PUBLIC PLAYLISTS` when relevant.
   - **Rights line** (only when going public, Body/S, text/secondary): "Only share music you have the rights to share."
   - **Primary button** (full width on mobile, right-aligned on desktop): "Make 31 tracks public" / "Make playlist public" / "Make private". Ghost "Cancel".
   - **Going private on an item you own** skips the sheet: one tap applies it, and a toast says "Glass Rooms is private · Undo". **Going public always shows the sheet.**
   - The counts come from a `dryRun` call (see API) while the sheet opens. Show a skeleton line until it returns. On a slow network, cap the wait at 400 ms and show counts computed from local IndexedDB, then reconcile.
3. **Library selection mode** (bulk):
   - Long-press on mobile, or checkboxes on desktop, on album, playlist or folder rows. The action bar gets **Visibility**, which opens the same sheet with aggregate counts.
   - Mixed selections (e.g. albums plus playlists) show both sets of rows. The playlist checkbox applies to all selected playlists.
4. **Upload:**
   - The Upload screen (M7/D3) has a **"New uploads: Private · Public"** segmented control above the drop zone. It defaults to Private, persists per device, and the owner can lock it to Private in settings.
   - The Review screen (M9/D3) keeps a per-album-group visibility chip.
5. **Assistants** follow the same rules and endpoints (`ASSISTANTS.md`). They never set Public unless the user said so for those items.

## Sync, playback and privacy guarantees

- Every visibility change bumps `rev` on each affected row.
- **Delta sync must also remove items that became invisible.**
  - For a caller who isn't the owner, `GET /api/library?since=` returns `hidden: [ids]` for tracks, albums and playlists that changed since `since` and are no longer visible to them.
  - The client deletes those locally, just like tombstones.
  - Hidden ids are opaque ULIDs, with no titles or counts.
- If a track becomes private while someone else is playing it, their next `/media` request returns `403`. The engine skips to the next track with the toast "A track is no longer shared" and drops it from their queue and downloads.
  - Cached offline copies of no-longer-visible tracks are deleted on the next sync (the service worker purges `wh-audio-v1` by id).
- Public playlists never reveal private items: no count, no "hidden" placeholder, no duration total that includes them. (This supersedes the earlier "2 private tracks hidden" idea.)
- Album pages for non-owners show only public tracks. Track count and duration are computed from what they can see.
- Search, recommendations, Daily Mixes and autoplay only ever use rows present in the caller's local library, which already respects visibility.

## Undo

- One `changes` row per operation, e.g. "Made album Glass Rooms public (11 tracks)" or "Made 3 albums and 2 playlists private (52 tracks)".
- `ops` stores each track's **previous** visibility, so undo restores Mixed states exactly, plus the album and playlist `visibility`/`sync_visibility` values.

## Acceptance tests

1. Making an album with 9 private and 2 public tracks **public** is one request and one change entry; all 11 become public. Undo restores 9/2 exactly.
2. Making a playlist public with "also my tracks" changes only the caller's 31 tracks. The 17 tracks owned by others are untouched, and the response says `skippedNotOwned: 17`.
3. A non-owner synced before the change gets `hidden` ids on the next delta. Their `/media/:id` returns 403. Their offline copy is purged.
4. A non-owner viewing a public playlist with 5 inaccessible items sees `n − 5` items. No string, count or duration in the response includes the 5.
5. With album `sync_visibility` on, a new upload into a public album becomes public. With it off, the track uses the upload default.
6. An admin can force-private another member's album, but gets 403 trying to make it public.
7. Going private is one tap with an Undo toast. Going public always shows the sheet, with counts from `dryRun`.
8. Liked songs can't be made public (no control is shown; the API returns 400).
