# API contract (both backends)

Base: same origin as the PWA. JSON in/out (`application/json; charset=utf-8`) except media/art/upload parts.
Auth: session cookie `__Host-wh_session` **or** `Authorization: Bearer wh_live_…` (API tokens, scoped).
Mutations require header `X-Wavehaus: 1` (cookie auth). Errors: `{ "error": { "code": "rate_limited", "message": "…", "retryAfter": 900 } }` with proper HTTP status.
Every list endpoint is cursor-paginated: `?cursor=…&limit=…` → `{ items, nextCursor }`.
Contract tests in `/tests/api` assert every endpoint below against `BASE_URL`.

## Meta & setup
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok, version, schema, backend: "php"|"worker", needsSetup }` — public |
| GET | `/api/config` | public: `{ serverName, registrationMode, maxChunkBytes, maxFileBytes, powDifficulty, features }` |
| POST | `/api/setup` | only when no users exist: `{ username, password, serverName }` → owner + `{ recoveryCodes: [10] }` (shown once) |
| POST | `/api/setup/reset` | last-resort owner reset; only when `RESET_OWNER` is set in `config.php` / Worker secret: `{ resetString, newPassword }` → revokes all owner sessions, new recovery codes (see `AUTH.md`) |

## Auth (see `AUTH.md`)
| Method | Path | Body / result |
|---|---|---|
| POST | `/api/auth/login` | `{ username, password, deviceLabel }` → sets cookie, `{ user }`. Rate-limited per IP + per username |
| POST | `/api/auth/logout` | revokes current session |
| POST | `/api/auth/recover` | `{ username, recoveryCode, newPassword }` → consumes code, revokes all sessions, logs in |
| GET | `/api/auth/me` | `{ user, session, settings: { role-visible subset } }` |
| POST | `/api/auth/pair` (signed in) | → `{ code: "482913", qrUrl: "https://host/pair#<secret>", expiresAt }` |
| POST | `/api/auth/pair/claim` | `{ code }` or `{ secret }`, `deviceLabel` → new session on the claiming device |
| GET | `/api/auth/challenge` | proof-of-work challenge `{ algorithm:"SHA-256", salt, difficulty, expires, signature }` |
| POST | `/api/auth/register` | `{ username, password, inviteCode?, pow:{salt,nonce,signature}, hp:"" , t }` → per registration mode |
| POST | `/api/auth/request-access` | `{ name, contact?, note?, referralCode?, pow, hp, t }` |
| GET/DELETE | `/api/sessions`, `/api/sessions/:id` | list / revoke own sessions |
| POST | `/api/auth/recovery-codes` | regenerate (requires password) → 10 new codes, old ones invalid |
| GET/POST/DELETE | `/api/tokens`, `/api/tokens/:id` | API tokens: create returns raw token once |

## Library
| Method | Path | Notes |
|---|---|---|
| GET | `/api/library?since=<rev>&limit=2000` | `{ rev, items: { tracks:[], albums:[], artists:[], playlists:[], playlistItems:[], likes:[], moments:[] }, hidden: { tracks:[ids], albums:[ids], playlists:[ids] }, more }`. Returns only rows visible to the caller, tombstones included. `hidden` lists rows that became invisible to the caller since `since`; the client deletes them like tombstones (`VISIBILITY.md`) |
| PATCH | `/api/tracks` | bulk metadata: `{ ids:[…], set:{ title?, artist?, albumArtist?, album?, year?, genre?, trackNo?, discNo? } , perId?: { "<id>": { title, trackNo } } }` → `{ changeId, updated }`. Owner only. Admins may edit metadata but never stream others' private tracks. Visibility goes through `/api/visibility` |
| POST | `/api/tracks/:id/peaks` | `{ peaks: base64 }` — backfill from any member who can play it |
| DELETE | `/api/tracks` | `{ ids }` soft delete (tombstone); file GC when no live track references sha256 |
| PATCH | `/api/albums/:id` | `{ title?, artistName?, year? }` (visibility goes through `/api/visibility`) |
| PUT | `/api/albums/:id/art` | multipart `art600` + `art96` (webp) or `generated512` (png) → `{ artSource }` |
| POST | `/api/albums/:id/art/from-url` | P1, optional: `{ url }` server fetch with SSRF guard (https only, public IPs only, image/*, ≤ 5 MB) |
| POST | `/api/albums/merge` | `{ intoId, fromIds }` |
| CRUD | `/api/playlists`, `/api/playlists/:id/items` | add `{ trackIds, afterPosition? }`, reorder `{ trackId, position }` |
| PUT/DELETE | `/api/likes/:trackId` | |
| POST | `/api/plays` | batch of up to 100 `{ plays:[{ id?, trackId, startedAt, msPlayed, completed, skipped, context, deviceLabel }] }` → `{ ok, recorded }`. Optional client ULID `id` makes retries idempotent; unavailable tracks are ignored. Pagehide uses fetch keepalive with the CSRF header |
| GET | `/api/plays` | own play history, `{ items, nextCursor }`; `limit` 1–500. The opaque cursor orders by timestamp and ID, preserving simultaneous plays |
| CRUD | `/api/moments` | `{ trackId, atMs, label? }` |
| GET/PUT | `/api/player-state` | `{ queue:[trackId], index, positionMs, shuffle, repeat, autoplay, updatedAt }` |
| POST | `/api/visibility` | **Bulk privacy** (`VISIBILITY.md`): `{ targets:[{type:'track'|'album'|'playlist', id} | {type:'folder', path}], visibility:'private'|'public', applyToTracks?: bool, syncFuture?: bool, dryRun?: bool }` → `{ changeId?, tracksUpdated, albumsUpdated, playlistsUpdated, skippedNotOwned, alsoIn:{ publicPlaylists, publicAlbums } }`. `dryRun` returns counts only (the sheet calls it on open). Albums always apply to their tracks. Playlists only when `applyToTracks`, and only the caller's own tracks. Admins may target others' items with `private` only (takedown); `public` returns 403. Liked songs returns 400 |
| GET | `/api/changes?limit=50` | activity log (own) |
| POST | `/api/changes/:id/undo` | reverts ops if rows unchanged since; else `409 { conflicts }` |

## Media
| Method | Path | Notes |
|---|---|---|
| GET/HEAD | `/media/:trackId` | Range-capable stream. `403` if private and caller ≠ owner. Sets `Content-Type` from stored mime |
| GET | `/art/:albumId/:size.webp` | `96` / `600`; `/art/:albumId/generated-512.png`. `Cache-Control: private, max-age=31536000, immutable` (URL includes `?v=<rev>`) |

## Uploads (resumable)
| Method | Path | Body / result |
|---|---|---|
| POST | `/api/uploads/check` | `{ items:[{ quickHash, size }] }` → `{ duplicates:[quickHash], quotaLeft }` |
| POST | `/api/uploads` | `{ filename, size, sha256, mime }` → `{ uploadId, chunkBytes, partsReceived:[] }` (idempotent on `sha256+user`) |
| PUT | `/api/uploads/:id/parts/:n` | raw bytes (`application/octet-stream`), `Content-Length` ≤ chunkBytes; `n` from 1. Idempotent. Returns `{ received:n }` |
| GET | `/api/uploads/:id` | `{ partsReceived, status }` (resume after reload/background kill) |
| POST | `/api/uploads/:id/complete` | `{ metadata: TrackInput, album: AlbumInput, peaks?, visibility }` → `{ track, album, changeId }`. Server re-verifies size + sha256, magic bytes, quota |
| DELETE | `/api/uploads/:id` | abort, delete parts |

`TrackInput` = the tags/organise result from the client (title, artist, albumArtist, album, trackNo, discNo, year, genre, bpm, durationMs, codec, container, bitrate, sampleRate, bitDepth, channels, replaygain, lyrics, lyricsSynced, originalName, originalPath, organiseSource). `AlbumInput` = `{ title, artistName, year, folderPath, artSource, existingAlbumId? }`.

## Admin (owner/admin)
| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/api/admin/settings` | registration mode, upload permission, quotas, invites per member, spam settings, library rules |
| GET/PATCH | `/api/admin/users`, `/api/admin/users/:id` | role, quota, status, invitesLeft |
| GET/POST | `/api/admin/requests`, `/api/admin/requests/:id/{approve,deny}` | approve creates a one-time invite or account |
| GET/POST/DELETE | `/api/invites` | members create invites if `invites_left > 0` (referrals) |

## Status codes used
200, 201, 204, 206 (media), 304, 400 (validation), 401 (no session), 403 (not allowed / private track), 404, 409 (conflict/undo), 413 (too large / quota), 415 (unsupported type), 429 (rate limited, `Retry-After`), 503 (migrations pending).
