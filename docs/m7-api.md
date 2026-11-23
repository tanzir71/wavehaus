# M7 privacy and access API

All writes require `X-Wavehaus: 1`. Production APIs require a session except health, config and the auth/setup endpoints. Anonymous media and artwork remain unavailable.

## Visibility

`POST /api/visibility` accepts `targets: [{type:"track"|"album"|"playlist", id}, {type:"folder", path}]`, `visibility`, optional `dryRun`, `syncFuture`, `alsoMyTracks`, and `expectedRevs`. It returns affected counts, skippedNotOwned, ownPlaylistTracks, collateral public containers, revisions and changeId.

Album targets apply to all live children. Folder paths match the caller's uploads below that folder and can establish a persistent future-upload default. Playlist targets change the list; alsoMyTracks defaults on for Public and off for Private and affects only the caller's tracks. syncFuture defaults off for playlists. A listener can change its playlist visibility but cannot publish tracks. Liked songs is not a valid target; copy it into a manual playlist instead.

Private transitions emit opaque hidden IDs and purge client relationships/audio. Republishing bumps related playlist item and artist revisions, including during Undo. Revision-only system work is excluded from Undo snapshots. Admin takedowns never publish another member's data; they are non-undoable by the admin and create a generic Activity notice for each affected uploader.

## Registration

- `GET /api/auth/challenge` → `{algorithm, salt, difficulty, expires, t, signature}`; five-minute signed challenge.
- `POST /api/auth/register` → `{username,password,deviceLabel,inviteCode?,email?,displayName?,pow:{salt,nonce,signature},hp:"",t}`. SHA-256(salt + decimal nonce) must have difficulty leading zero bits. Minimum fill time: three seconds. Returns `{user,recoveryCodes}` and a session, or `{pending:true,requestId}` when referrals require approval. Pending requests never retain passwords.
- `POST /api/auth/request-access` → `{name,contact?,note?,referralCode?,pow,hp,t}`. Returns a pending request. Email is optional; provided email addresses use a small bundled disposable-domain list.

Registration: three attempts per hour per IP; requests: three per day; challenge issuance: 30 per 15 minutes. Salt claims are one-use. PHP honours proxy IP headers only for configured trusted proxies; Workers uses the Cloudflare-provided client IP. Rate identities are HMACs. No external verification service is used.

## Members and invitations

- `GET/POST /api/invites`; creation accepts admin-only optional role, uses (1–100), expiresDays (1–30). Members create a single-use, seven-day referral using their allowance. Closed mode permits only admin invitations.
- `DELETE /api/invites/:id` revokes unused access.
- `GET /api/admin/users`; `PATCH /api/admin/users/:id` accepts role, quotaBytes (null unlimited), status and invitesLeft. Admins cannot edit owners/admins or grant admin; owners can manage admins. Disabled accounts lose sessions and pairing codes.
- `GET /api/admin/requests`; `POST /api/admin/requests/:id/approve|deny`. Approval returns a one-time link to copy; nothing is emailed. Original referral attribution survives approval.
- `POST /api/admin/ownership` accepts `{userId,password}` from the owner. Ownership transfers atomically; the old owner becomes an admin.
- Settings validation includes registration/default roles, private upload locking, quotas, referral allowances/approval, proof difficulty, maximum file size and trusted proxy.

Schema 8 adds folder rules, approval-invite references and change recipients; old library and audit rows are retained. Static disposable-domain values are bundled with code so release archives continue to exclude all private data directories.
