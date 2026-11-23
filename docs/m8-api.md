# M8 API and assistant operation

## Tokens

`GET /api/tokens` lists the caller's token metadata. `POST /api/tokens` accepts `{name, scopes:["read","upload","organise","admin"], expiresDays:30}` (1–365 days) and returns the raw token once. Only its SHA-256 hash is stored. `DELETE /api/tokens/:id` revokes it.

Use `Authorization: Bearer wh_live_…`. Valid Bearer requests do not need X-Wavehaus; cookies still do. Tokens are limited to 600 requests/minute. Current account status, role and the granted scopes are checked on every request. Listeners can receive read only; uploaders can receive read/upload/organise; owner/admin may also grant admin. Scopes do not bypass owner/public media checks. Browser security, pairing, sessions and token management remain browser-session operations.

- read: library, album/search metadata, media, artwork, Activity and auth/me.
- upload: resumable upload endpoints and waveform backfill.
- organise: metadata, artwork, visibility, playlists and supported library mutations/Undo.
- admin: server settings and member/invitation controls; also requires the user's current admin role.

## Metadata reads for CLI tools

`GET /api/search?q=&limit=20` returns visible track metadata with bounded literal word matching. `GET /api/tracks?ids=a,b&limit=500` accepts up to 500 IDs per read; the MCP server splits longer selections into bounded reads. `GET /api/albums?filter=&cursor=&limit=100` returns readable albums with a stable ID cursor. `GET /api/albums/:id` returns an accessible album and up to 2000 playable track rows. Private entries and hidden item counts are omitted. Lyrics and peaks are excluded from these compact reads.

Artwork PUT also accepts a standalone `original` PNG, JPEG or WebP under 5 MB. It is stored without server resizing; the URL's response carries the actual MIME type. Existing browser-resized inputs remain unchanged.

Upload completion accepts `keepPrivate:true` so an assistant can override inherited public defaults for new tracks. Existing duplicate rows are returned unchanged. Visibility accepts applyToTracks as an alias for alsoMyTracks.

## Audit and Undo

API library actions carry actor=api and token_name; browser actions carry the device label. Album sync exposes last_actor/last_actor_name for assistant attribution in Fresh uploads. `GET /api/changes?actor=web|api` filters the caller's feed, including generic admin notices addressed to them.

Undo is strict by default. `POST /api/changes/:id/undo` or the batch endpoint accepts `skipConflicts:true` after reviewing a 409 conflict. It retains newer rows and any dependent rows that cannot safely be restored, guards referenced parents and applies the remaining changes atomically. The result reports partial/skipped; the original action records an undo note. If nothing can be restored it still returns 409. No admin may use Undo to publish someone else's music. Expired operation snapshots are pruned in bounded batches after 30 days; summaries remain.

## UI operation

Visible labelled file/folder inputs, artwork file/paste/drop, metadata previews, text statuses and in-page dialogs remain available. Stable hooks include upload-files, upload-folder, art-file, bulk-apply, accept-all-guesses, visibility-toggle and track/album rows. Direct routes include /bulk?ids=a,b, /review/:batchId and the existing /bulk-edit and /review?batch= aliases. body.dataset.busy is always a boolean string and counts concurrent sync/upload/edit work.

The complete CLI usage is in tools/README.md. No additional tests were run at the owner's request.
