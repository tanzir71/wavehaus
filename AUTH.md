# Auth, access, spam hardening & safe redeploys

There are no third-party auth providers, email is not required, and nothing is hosted outside the server. This follows the pattern the owner already uses in Tack: recovery codes instead of email resets, layered spam hardening, and settings stored in the DB so they survive every redeploy.

**Implementation source:** port the login, register, recovery-code, rate-limit, settings and migration code from the owner's **Tack** repo rather than writing it fresh. `REFERENCES.md` says what to look for, how to adapt it, and has the port table to fill in. This file defines the required behaviour. Where Tack differs, the hard constraints here win (no email, no third-party auth, PHP + Workers). Anything else follows Tack, with the deviation noted.

## First run (`/setup`)

1. `GET /api/health` returns `needsSetup: true` when the `users` table is empty. The PWA then routes to `/setup`. Any other route redirects there too.
2. The owner fills in server name, username and password (min 10 chars; strength meter, no composition rules).
3. The server creates the owner, then 10 **recovery codes**, and returns them once.
4. The screen shows the codes in Geist Mono, 2 columns, with **Copy**, **Download .txt** and **Print**. The checkbox "I saved these somewhere safe" must be ticked before **Continue**.
5. **PHP only:** `/setup` also writes `DATA_DIR/config.php` with `APP_SECRET` (32 random bytes, hex). If the data dir isn't writable, it shows the exact path to create, chmod 755.
6. **Setup locking:** once a user exists, `/api/setup` returns 404 forever. Recovery goes through the reset procedure below.

## Passwords

- **PHP:** `password_hash($pw, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT)`, then `password_verify`. Call `password_needs_rehash` on login.
- **Worker:** WebCrypto PBKDF2-SHA256, 100,000 iterations (the Workers maximum), 16-byte salt. Stored as `pbkdf2$sha256$100000$<b64salt>$<b64hash>`. Compare in constant time.
  - **CPU note:** hashing costs tens of ms of CPU. Workers Free allows 10 ms of CPU per request, so login can fail intermittently there. Recommend Workers Paid ($5/mo) in `DEPLOY.md`. A config `PBKDF2_ITERATIONS` lets Free users lower it at their own risk; warn in the UI if it's below 100k.
- Any upgraded or rehashed hash is written back on successful login.

## Sessions

- The token is 32 random bytes (base64url). Root installs use `__Host-wh_session` (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 180 days). Nested PHP installs use `__Secure-wh_session` with Path equal to APP_BASE, e.g. `/wavehaus/app/`, to isolate neighboring apps. The DB stores only `sha256(token)`.
- Expiry slides: `last_seen_at` and `expires_at` update at most once every 10 min per session.
- `deviceLabel` is required at sign-in. It's pre-filled from the UA ("Pixel 9 · Brave", "Windows · Edge") and can be edited. Assistants' browsers should be named, e.g. "Claude's browser". That label attributes every change in the activity log.
- Settings → Devices lists sessions (label, last seen, "this device") with **Sign out** for each and **Sign out everywhere else**.
- Changing the password revokes all other sessions.

## Recovery codes

- 10 codes in the format `XXXX-XXXX-XX`: Crockford base32, 50 bits each. They're stored as `sha256(normalised code)` and are single use.
- The sign-in screen has a tab: **Forgot password → Use a recovery code**. Enter username + code + new password. This consumes the code, revokes all sessions and signs in.
- Settings → Security shows "7 of 10 recovery codes left". At 3 or fewer, show a warning banner on Settings. **Regenerate** requires the current password and invalidates all old codes.
- **Last-resort owner reset (proof of server access):**
  - PHP: add `define('RESET_OWNER', 'some-long-string');` to `config.php`, then open `/setup/reset`. Enter that string and a new password. The flag is removed automatically after use. If the file isn't writable, the screen asks you to delete the line.
  - Worker: `wrangler secret put RESET_OWNER`, then the same flow. Afterwards, `wrangler secret delete RESET_OWNER`.

## Pairing a new device (QR / 6-digit code)

- On a signed-in device: Settings → Devices → **Add a device**. `POST /api/auth/pair` returns a 6-digit code and a QR for `https://<host>/pair#<128-bit secret>`. The secret sits in the fragment, so it's never logged by servers. Both expire in 5 min and are single use.
- On the new device:
  - Scan the QR with the camera. The PWA reads `location.hash` and claims it.
  - Or tap **Use a code from another device** on the sign-in screen and type the 6 digits.
- The code allows 5 attempts per code, then it's burned. The 6-digit claim is also rate-limited per IP.
- Implementation detail: the five-attempt bucket uses the submitted code's hash. A mistyped six-digit number cannot identify which pending pairing it was intended for; the separate ten-attempt IP limit bounds that guessing. A valid code or QR is consumed atomically on its first successful claim.
- This is the fastest way to get the phone signed in after setting up on desktop. M11 (`21:1095`) shows it.

## Roles & permissions

| | owner | admin | uploader | listener |
|---|---|---|---|---|
| Listen to own uploads | ✓ | ✓ | ✓ | — |
| Listen to **public** tracks | ✓ | ✓ | ✓ | ✓ |
| Listen to others' **private** tracks | — | — | — | — |
| Upload / organise own files | ✓ | ✓ | ✓ (if `members_can_upload`) | — |
| Playlists, likes, moments (own) | ✓ | ✓ | ✓ | ✓ |
| Create invites (referrals) | ✓ | ✓ | if `invites_left > 0` | if `invites_left > 0` |
| Members, requests, settings | ✓ | ✓ (not owner/admins) | — | — |
| API tokens | ✓ | ✓ | ✓ (own scopes ⊆ role) | read only |

There is exactly one owner. Ownership can be transferred in Settings and requires the password.

## Registration modes (`settings.registration_mode`)

Configured in **Settings → Access & members** (D5 `27:1046`). The modes are a segmented control.

| Mode | Sign-up page | Who gets in |
|---|---|---|
| **Closed** (default) | hidden | Only people an admin invites (one-time invite links) |
| **Invite only** | needs an invite code | Admin invites + member **referrals** (each member has `invites_per_member`, default 3) |
| **Request access** | invite code **or** "Request access" form | As above, plus a public request form. Admins approve or deny. Approving creates a one-time invite link to copy and send (no email needed) |
| **Open** | open | Anyone (with spam hardening). New users get `default_role` (`listener` or `uploader`) |

More options on the same screen:
- **Members can upload** (on/off)
- **Default visibility for new uploads** (Private, locked as the recommended setting)
- **Storage per member** (e.g. 10 GB, or unlimited)
- **Invites per member**
- **Referrals need approval** (a referred sign-up becomes a pending request)
- **Max file size**

Each invite has: code `WH-XXXX-XXXX`, link `https://<host>/join/<code>`, role, uses (1 by default), expiry (7 days by default) and creator. `users.invited_by` records the referral. Settings shows "Invited by Mira" and the referral tree depth (1 level only).

## Spam hardening (all self-hosted)

1. **Proof-of-work** on register and request-access.
   - `GET /api/auth/challenge` returns `{ salt, difficulty, expires, signature = HMAC(APP_SECRET, salt|difficulty|expires) }`.
   - The client (`pow.worker.ts`) finds `nonce` such that `sha256(salt + nonce)` has `difficulty` leading zero bits. The default is 18 bits, about 0.5–2 s on a phone.
   - The server verifies the HMAC, the expiry (5 min) and single use. A used salt is stored in `rate_limits` with key `pow:<salt>` until it expires.
2. **Honeypot.** A hidden `website` field must be empty. It's visually hidden and `aria-hidden`, but not `display:none`.
3. **Minimum fill time.** `t` is when the form rendered (signed inside the challenge). Reject if under 3 s.
4. **Rate limits** (`rate_limits` table, fixed windows, keys built from `HMAC(APP_SECRET, ip)`, never raw IPs):
   - Login: 5 per 15 min per (ip, username), then lockout doubling from 15 min up to 24 h.
   - Login: 30 per 15 min per IP across usernames.
   - Register: 3 per hour per IP. Request access: 3 per day per IP.
   - Pair claim: 10 per 15 min per IP.
   - API tokens: 600 requests per minute per token.
   - Responses are `429` with `Retry-After`. The UI shows "Too many attempts. Try again in 14 min."
5. **Username rules:** 3–32 characters of `[a-z0-9_.-]`, unique ignoring case. Reserved names: admin, owner, root, api, setup, wavehaus, support, system.
6. **Disposable email list:** only used if an email is provided. Ships as `server-*/data/disposable-domains.txt` (bundled, updated with releases).
7. **Uploads:** extension allow-list, magic-byte check, `max_file_bytes`, per-user quota, and an upload rate limit of 5 GB/hour for non-owners.
8. **Trusted proxy IP:** only honour `CF-Connecting-IP` / `X-Forwarded-For` when `settings.trusted_proxy` is set (e.g. `cloudflare`). Otherwise use `REMOTE_ADDR`.

## Visibility & access enforcement

Full rules, UI and acceptance tests are in **`VISIBILITY.md`**. The enforcement summary:
- `GET /api/library` returns rows `WHERE deleted=0 AND (owner_id = :me OR visibility = 'public')`. Playlists follow the same rule.
  - Rows that **became** invisible to the caller since `since` come back as `hidden: [ids]`, so other devices drop them.
- A public playlist shows only the items the viewer can play. It shows **no count, placeholder or duration** for the ones they can't, so nothing private leaks.
- `/media/:id` and `/art/:albumId/*`: `403` unless the caller is the owner, or the track is public (including signed-out guests). Album artwork is readable when the album or any live track in it is public.
- Only the uploader changes their own visibility. Admins can force-private (takedown), never publish.
- **Public listening works without an account.** Only GET library, search, track/album and public playlist reads plus media/artwork GET/HEAD allow guests. Settings, sessions, history, uploads, editing, deletion and all mutations still require a valid signed-in account. P2 share links remain public-only and read-only.
- Changing visibility is always logged in `changes`.

## Redeploys keep data (the Tack pattern)

- App code and data live in separate folders (`ARCHITECTURE.md`). Release zips never contain `data/`, `config.php` or `.sqlite`.
- Every setting lives in the `settings` table. New settings get defaults in a migration (`INSERT OR IGNORE`), so an update never resets choices.
- Migrations are forward-only, numbered, transactional, and recorded in `schema_migrations`.
  - PHP takes a backup before migrating and applies pending migrations on the first request under `flock(DATA_DIR/migrate.lock)`.
  - Worker applies them with `wrangler d1 migrations apply` in `npm run deploy`.
- Settings → Updates shows: current version, schema version, last backup, and "Download backup" (the SQLite file, owner only). P1 adds an "Export library JSON" button.
