# Reference repos & prior art (Codex: read these before writing auth, settings or migrations)

## 1. Tack (the owner's project): port, don't reinvent

The owner's earlier project **Tack** already solves, in production:

- **Login / register:** sign-in, sign-up, invite codes, the session cookie and device handling.
- **Recovery codes:** account recovery without email: generation, hashing, one-time use, regeneration.
- **Spam hardening** on public sign-up: rate limits, bot traps and whatever else Tack uses.
- **Settings that survive redeploys:** settings in the DB, data outside the code folder, a migrations runner that only adds.

**Where:** the `tack` repository in the owner's workspace or GitHub account. The design session couldn't read it (it isn't visible to that session's GitHub access). Codex has access. If it isn't in your workspace, ask the owner for the path or URL before starting milestone M1.

**What to do:**
1. Read Tack's auth, settings and migration code first. Useful search terms: `register`, `login`, `recovery`, `backup code`, `invite`, `referral`, `honeypot`, `rate`, `throttle`, `lockout`, `password_hash`, `session`, `csrf`, `migrat`, `schema_version`, `settings`.
2. **Port Tack's implementation** into `server-php/lib/auth.php`, `ratelimit.php`, `settings.php` and `migrate.php`, and mirror it in `server-worker/src/auth.ts`. Adapt names to the Wavehaus schema (`schema.sql`: `users`, `sessions`, `recovery_codes`, `invites`, `access_requests`, `rate_limits`, `settings`, `schema_migrations`) and to the endpoints in `API.md`.
3. **Port Tack's login/register UI flow** (screens, steps, error copy) into the M11 Sign in / invite / recovery screens (`21:1095`), restyled with Wavehaus tokens. Keep Tack's wording for errors and recovery when it's good. It's already battle-tested.
4. **If Tack and `AUTH.md` disagree:**
   - `AUTH.md`'s hard constraints win: no third-party auth, no required email, works on PHP shared hosting **and** Cloudflare Workers, private by default, registration modes closed / invite / request / open.
   - Otherwise prefer Tack's proven approach and update `AUTH.md` to match.
   - Note every deviation in the table below.
5. Fill in this table as you port (it keeps the next agent honest):

| Wavehaus concern | Tack source path(s) | Ported to | Deviations |
|---|---|---|---|
| Login + sessions | `backend/index.php` login transaction; `backend/bootstrap.php` password/hash helpers | `server-php/lib/auth.php`, `server-worker/src/auth.ts` | PHP keeps Argon2id/bcrypt + rehash. DB device sessions replace Tack's PHP session; __Host cookie, sliding expiry, hash-only tokens. Worker mirrors the transaction using conditional atomic D1 batches and WebCrypto PBKDF2. |
| Register (open / invite / request / referral) | `backend/index.php` register; `backend/signup.php` invite/quota validation | `server-php/lib/access.php`, `server-worker/src/access.ts`, demo/access.ts and routes/Join.tsx | M7 ports transaction-scoped invite reservations and duplicate checks. Roles, referrals and approval links follow Wavehaus. No Turnstile or required email. |
| Recovery codes | `backend/index.php` recovery transaction; `src/auth/AuthForm.tsx` saved-code step | Same auth files; `app/src/ui/RecoveryCodes.tsx` | Ten SHA-256 Crockford codes replace Tack's single password-hashed recovery secret. Single-use claim and session/pair revocation are atomic. |
| Spam hardening (rate limit, honeypot, PoW/other) | `backend/bootstrap.php` HMAC identities and fixed-window limits; `backend/signup.php` signup defenses | `server-php/lib/ratelimit.php`, `server-worker/src/ratelimit.ts` | Account + IP lockout doubles from 15 min to 24 h. M7 uses self-hosted signed, expiring SHA-256 PoW, one-use salt claims, a honeypot and minimum fill time in place of Tack Turnstile. No external API. |
| Settings in DB + defaults via migrations | `backend/bootstrap.php` SQLite-backed server configuration | `server-php/lib/settings.php`, `server-worker/src/settings.ts`, `migrations/0002_defaults.sql` | Only storage/secrets are outside the DB. INSERT OR IGNORE preserves existing settings on upgrade. |
| Migrations runner + backup before migrate | `backend/bootstrap.php` private-dir discovery, flock, BEGIN IMMEDIATE and VACUUM INTO | `server-php/lib/bootstrap.php`, `lib/migrate.php`; Worker deploy script | PHP retains five consistent snapshots. D1 uses Wrangler migrations and atomic batches; D1 export/Time Travel replaces filesystem backups. |
| Login/register/recovery UI | `src/auth/AuthForm.tsx` form state, strength helper, copy/download/print and saved checkbox | `app/src/routes/Auth.tsx`, `app/src/ui/RecoveryCodes.tsx`, `routes/SettingsSecurity.tsx` | Preact and Wavehaus tokens; no provider or required email. M7 adds Join and request-access forms with the same saved-code step and accessible verification state. |

Source checkout: `C:/Users/tanzir/Desktop/project_priority/project-priority` (read-only). The original handover remains unchanged under `handover/`.

## 2. Other owner context

- **Hosting:** everything the owner runs is a minimal stack on Namecheap shared hosting, so treat cPanel + PHP + SQLite as the primary target and Cloudflare as the second (`DEPLOY.md`).
- **Domain** used in the designs: `music.tanziro.com` (Brave intent URLs, setup copy). Make it configurable and never hard-code it.
- **Landing footer:** credit "A tanziro.com project", linking to https://tanziro.com.

## 3. Libraries we depend on (read their docs, pin versions)

- music-metadata (tag parsing in the browser): https://github.com/Borewit/music-metadata
- MiniSearch (client-side search): https://github.com/lucaong/minisearch
- idb-keyval: https://github.com/jakearchibald/idb-keyval
- Preact + Signals: https://preactjs.com/ · https://preactjs.com/guide/v10/signals/
- Geist fonts (OFL): https://github.com/vercel/geist-font

## 4. Prior art to read, not copy (see `RESEARCH.md`)

- Navidrome: no built-in upload by design. Good reference for Subsonic-style library modelling. https://www.navidrome.org/docs/faq/
- Koel: PHP/Laravel, admin upload. Good reference for a PHP streaming controller. https://docs.koel.dev/
- Ampache: PHP + MySQL with user uploads (`upload_access_level`). It's the closest prior art on shared hosting; read how it scopes upload catalogs per user. https://github.com/ampache/ampache
- Funkwhale: per-user libraries and visibility levels. A useful comparison for `VISIBILITY.md`. https://docs.funkwhale.audio/
- ALTCHA: a self-hosted proof-of-work pattern, used as inspiration for `pow.worker.ts` if Tack has no PoW. https://altcha.org/

## 5. Platform docs to keep open

- Media Session: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- Web Share Target: https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target
- Audio Session (Safari 17+): https://w3c.github.io/audio-session/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- R2 multipart: https://developers.cloudflare.com/r2/objects/multipart-objects/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- GitHub Pages with Actions (milestone previews): https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages, using `actions/upload-pages-artifact` and `actions/deploy-pages`
- Origin Private File System (demo backend blobs): https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- LiteSpeed internal redirect (`X-LiteSpeed-Location`) and Apache `mod_xsendfile`: check the host's docs. Fall back to PHP streaming when they're absent.
