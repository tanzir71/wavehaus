# M4 editing additions

The API in the handover remains the base contract. M4 adds these optional fields and responses without changing the upload/media contract.

- `PATCH /api/tracks`: `expectedRevs`, `expectedAlbumRevs`, `dryRun`, `publishConfirmed`, `mergeExisting` (default true), and `targetAlbumId` for an exact uploader-owned album destination. Dry runs return per-track previews, impact counts and related album revisions. Moving private tracks into a public album requires publication confirmation.
- `PATCH /api/albums/:id` edits the live album's tracks and header together. `POST /api/albums/merge` accepts `intoId` and `fromIds`, plus the dry-run/publication/revision controls.
- `PUT /api/albums/art` accepts one set of resized image files and JSON text fields `albumIds` and `expectedRevs`. Single-album artwork URLs remain available. Optional `changeId` appends generated or chosen artwork to the same Undo action. Immutable old image keys are retained.
- Upload completion's album accepts a 64-character hexadecimal `importKey`. The server derives a separate storage/group key while retaining the album's canonical identity. This preserves imports made with existing-album merging disabled.
- `POST /api/visibility` supports track and album targets in M4. It returns impact, related public-container counts and revisions; `dryRun` does not write. `syncFuture` controls the album default. Playlist/folder targets are added in M7.
- `POST /api/changes/undo` accepts action `ids` for Undo import. Single-action Undo remains available. Activity pages use a compound timestamp/ID cursor and report `operationCount` and `undoAvailable`.

Metadata selections are bounded at 2000 tracks. Undo accepts up to 2000 actions, 10000 recorded operations and 16 MiB of compact journal data. Writes check actor permissions, row revisions and relevant album membership counts atomically. Conflicts leave the action unchanged. Soft deletion and Undo retain original audio and previous artwork; storage collection is handled separately.
