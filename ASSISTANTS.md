# AI assistants (Claude / Codex) as operators

Users can ask an assistant to **"upload this folder, fix the tags, find cover art and keep it private"**. There are two routes. Route A is primary and needs no setup beyond signing in.

## Route A — the assistant drives the normal UI in its built-in browser (P0)

The user signs in to Wavehaus once **themselves** in the assistant's browser (Claude's built-in browser pane keeps sign-ins), naming the device e.g. **"Claude's browser"**. The assistant never types passwords or one-time codes. From then on, the assistant works in that signed-in session like a person would, and every change is attributed to that device label.

### UI requirements (acceptance criteria for every screen)

- **Real inputs:** uploads use visible or label-associated `<input type="file" multiple>` and `webkitdirectory` inputs (`data-testid="upload-files"`, `"upload-folder"`), not only drag-and-drop. Artwork dialogs accept **file input, paste and drop** (`data-testid="art-file"`).
- **Accessible names on everything:**
  - Icon buttons have `aria-label` ("Play Afterglow (Live)", "More options for Glass Rooms").
  - Inputs have `<label>`s.
  - Lists use `role="list"`/`listitem`. The waveform scrubber is `role="slider"` with `aria-valuetext="1:36 of 4:12"` and arrow-key seeking.
- **Stable hooks:** `data-testid` on primary actions and rows, e.g. `track-row-<id>`, `album-<id>`, `bulk-apply`, `accept-all-guesses`, `visibility-toggle`.
- **Addressable routes:** `/upload`, `/review/<batchId>`, `/album/<id>`, `/bulk?ids=a,b,c`, `/settings/library-rules`, `/settings/activity`. Agents can navigate directly.
- **No native dialogs:** no `alert/confirm/prompt` (they block automation). Use in-page sheets with labelled buttons.
- **Readable status:** toasts are `role="status"` and stay at least 5 s. The upload queue shows text states (`Queued`, `Uploading 42%`, `Done`, `Duplicate — skipped`).
- **Text equivalents:** every confidence dot or badge has a text equivalent ("Needs a look", "From filenames").
- **Settle signals:** expose `document.body.dataset.busy="true|false"` while syncing or uploading, so agents can wait for it.

### Typical assistant task (documented in-app under Settings → AI assistants)

1. Open `/upload`, set the folder input to the user's folder, and wait for `busy=false`.
2. Open the review: accept the high-confidence groups and fix the low-confidence fields inline.
3. Use bulk rename with a pattern, e.g. `{track} - {title}`. Check the preview, then **Apply**.
4. **Artwork:** for albums with generated covers, find the official cover on the web (Cover Art Archive / MusicBrainz, the label's or artist's site, Bandcamp page). Check that artist, title and year match, save the image locally, then open **Find artwork** and use the file input or paste. Prefer images ≥ 600 px and square.
5. **Visibility:** leave everything **Private** unless the user explicitly says which items can be Public. When they do, use the album or playlist visibility chip (one step for the whole album or playlist, `VISIBILITY.md`), not track-by-track edits. Never make copyrighted commercial releases public on the user's behalf without asking.
6. Report back with a link to `/settings/activity`, where each step has **Undo**.

## Route B — API tokens + MCP (P1, for CLI agents like Codex/Claude Code)

- **Settings → AI assistants → Create token:** name ("codex · laptop"), scopes (`read`, `upload`, `organise`, `admin`) and expiry. The raw token `wh_live_…` is shown once. The list shows the prefix, last used and **Revoke**.
- Tokens go in `Authorization: Bearer`. CSRF headers aren't needed for Bearer auth.
- `tools/mcp.mjs`: a zero-dependency Node 18+ stdio MCP server. Config: `WAVEHAUS_URL` and `WAVEHAUS_TOKEN`, set by the user in their MCP config. Tools:

| Tool | Does |
|---|---|
| `search_library(query, limit)` | MiniSearch-equivalent server-side LIKE search over visible rows |
| `list_albums(filter)` / `get_album(id)` | read |
| `upload_files(paths[], visibility='private')` | runs the same pipeline as the web client in Node: tags via `music-metadata` (optional peer dep; falls back to filename rules), chunked upload, sha256 |
| `preview_organise(paths[] or trackIds[])` | returns proposed fields with confidence (same rules as `ORGANISE.md`, shared module `app/src/upload/organise.ts` compiled to ESM) |
| `bulk_update(ids[], set, perId)` | `PATCH /api/tracks` |
| `rename_by_pattern(ids[], pattern, source)` | preview + apply |
| `set_artwork(albumId, imagePathOrUrl)` | resizes with `OffscreenCanvas`-free fallback (uploads original if no resizer; server keeps ≤ 5 MB) |
| `set_visibility(targets[], 'private'|'public', { applyToTracks, dryRun })` | Wraps `POST /api/visibility`. Targets are tracks, albums, folders or playlists. Always call with `dryRun` first and report the counts to the user before applying a `public` change |
| `create_playlist(name, trackIds[])`, `add_to_playlist` | |
| `list_changes(limit)`, `undo_change(id)` | audit + undo |

`app/src/upload/organise.ts` must be pure (no DOM), so the MCP server and the web app share it.

## Audit & undo (both routes)

- Every mutation batch writes a `changes` row with `actor` (`web` or `api`), `session_label` or `token_name`, a human `summary` and revertible `ops`.
- **Settings → Activity** (D6 `27:1374`) lists entries: "Claude's browser · Organised 48 files into 4 albums · 14:02 · Undo". Filter by actor.
- Undo reverts the ops if the rows haven't changed since. Otherwise it shows the conflicts and lets the user undo the non-conflicting ones. Undo is available for 30 days. After that, `ops` is pruned and the summary is kept.
- Assistant-made changes show a small `bot` icon next to the album in Fresh uploads ("organised by Claude").
