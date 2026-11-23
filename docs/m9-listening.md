# Offline and listening tools

Downloads are explicit full original-audio responses in `wh-audio-v1`. A maximum of two requests run at once. The queue is cancellable and retries are user initiated. The browser storage meter includes all site data; the downloaded total counts audio copies. Persistence remains a browser decision.

The service worker slices full blobs for normal, suffix and open byte ranges, returns 206/416 with length/range headers, and supports HEAD/If-Range. Cached media is scoped to the last authenticated account and its session expiry. When a network permission check returns 401/403/404 the copy is refused and removed; temporary network failures allow the unexpired offline copy. A disconnected device cannot learn about server-side revocations until it reconnects. Signing out clears downloads, cached art and the offline session snapshot. Visibility sync purges hidden tracks.

Offline boot restores a cached user/config snapshot only after a network failure and only within the previously authenticated session expiry. No password, session cookie or API token is stored in that snapshot. Original demo media remains separate from downloads. Downloads are not a backup of a production server.

Lyrics accept embedded plain text, millisecond SYLT and matching .lrc sidecars. Timestamped lines support repeated timestamps, decimal fractions and offsets. Plain lyrics remain readable. Follow playback can be disabled; tapping a line seeks. MPEG-frame SYLT remains plain text.

Moments are private per user. GET/POST /api/moments and GET/PATCH/DELETE /api/moments/:id are implemented on PHP, Worker and demo. GET supports trackId and an ID cursor, at most 500 rows. POST takes trackId, atMs and optional label (200 characters); PATCH accepts atMs/label and optional expectedRev; DELETE also accepts expectedRev. Track readability and duration bounds are checked. Writes allocate sync revisions and add an Activity summary. Moment actions do not offer journal Undo; edit/delete controls are available directly.

Now Playing supports hold-to-save and a keyboard-accessible Save moment action. Loop A/B handles can be dragged or changed with arrow keys (Shift for larger steps) and numeric controls. Loop checks use timeupdate while hidden and requestAnimationFrame while visible. Track changes reset the loop.

Only packaging/publication builds were run. Browser, automated and device behavior remains unverified at the owner's request.
