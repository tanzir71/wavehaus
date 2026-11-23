# M6 API additions

Authenticated members, including listeners, can create private playlists and edit only their own playlists. Track inclusion is limited to their own or currently public tracks. GET responses omit inaccessible tracks.

- `GET /api/playlists`: readable playlists.
- `POST /api/playlists`: `{name, description?}` → `{playlistId, changeId, updated}` (201).
- `GET /api/playlists/:id`: `{playlist, items}`; `/items` returns `{items, nextCursor}`.
- `PATCH /api/playlists/:id`: `{name?, description?, expectedRev?}`.
- `DELETE /api/playlists/:id`: `{expectedRev?}`; tombstones playlist/items, retains music.
- `POST /api/playlists/:id/items`: `{trackIds, afterPosition?, expectedRev?, changeId?}`. Repeated inclusion is idempotent. An optional existing changeId groups creation and additions into one Undo action.
- `PATCH /api/playlists/:id/items`: `{trackId, position, expectedRev?}`, or `{trackIds, expectedRev?}` for ordered positions. Positions can be fractional.
- `DELETE /api/playlists/:id/items`: `{trackId, expectedRev?}` or `{trackIds, expectedRev?}`.

Item mutations bump the parent revision. Stale revisions return 409. All writes use the existing CSRF header and change journal. Visibility uses its dedicated endpoint, extended in M7. Optional smart playlist `kind` and rules metadata are accepted for future clients; this milestone's UI creates manual playlists.

Search and recommendation workers receive metadata rather than audio. Daily mixes use a UTC-day/user seed. Radio excludes queued IDs and tracks played within two hours; low-history libraries fall back to folder mixes and unplayed albums. The performance acceptance target was not measured because the owner disabled further testing.
