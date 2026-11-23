# Wavehaus Worker — 1.0

Wavehaus 1.0 includes browser setup/recovery, revocable device sessions, resumable uploads, private library sync, streaming, search/mixes, playlists, bulk editing and 30-day Undo, visibility/access controls, scoped assistant tokens and MCP tools. Offline downloads, lyrics, moments and A–B loops run in the PWA. The Pages demo uses a separate browser-local backend.

Use Node 24+ locally; there is no Node server to manage.

Production assets default to `/`. In the source repository, set `APP_BASE=/music/` before `npm run package` for a subpath; keep the same base on later releases and open `/music/setup`. Visitor websites are outside Wavehaus.

Upload parts are staged as immutable R2 objects keyed by their hash, then streamed through temporary R2 multipart completion and verified before promotion to the permanent content key. This prevents competing retries from replacing an accepted chunk. Staging temporarily uses extra R2 storage and operations; successful completion/abort removes the parts. Native streaming WebCrypto verifies the full object without a whole-file allocation. D1 completion leases renew at most every 30 seconds, keeping large-file assembly within the Free plan's per-invocation query budget.

1. Run `npm ci --prefix server-worker`, then `cd server-worker`.
2. Run `npx wrangler login` and `npx wrangler d1 create wavehaus`. Put the returned database ID in `wrangler.toml`.
3. Run `npx wrangler r2 bucket create wavehaus-media`. D1 and R2 persist across deployments.
4. Generate a random secret of at least 32 bytes and save it with `npx wrangler secret put APP_SECRET`.
5. Run `npm run deploy`. It applies forward-only D1 migrations before deploying the Worker and included PWA assets. Open the deployed URL at `/setup` and save the recovery codes.

Workers Paid ($5/month) is recommended: PBKDF2-SHA256 at 100,000 iterations can exceed the Free plan CPU allowance. Advanced Free-plan users can set `PBKDF2_ITERATIONS` below 100,000 as a Worker variable, accepting weaker hashing; the app shows a warning. Successful sign-in upgrades a hash when the configured count changes.

For local development in the source repo use `npm run dev:worker`. Its generated `.dev.vars` is private and excluded from releases. For this archive use `npx wrangler d1 migrations apply wavehaus --local`, create `.dev.vars` containing `APP_SECRET=<your-random-secret>`, then `npx wrangler dev`.

Update by replacing code and assets while keeping your database ID, bucket name and secrets. Never delete the D1 database or R2 bucket to update. Migrations are idempotent; settings use INSERT OR IGNORE defaults. Keep a D1 export/Time Travel recovery point before upgrades.

Last-resort owner recovery: `npx wrangler secret put RESET_OWNER`, open `/setup/reset`, then remove the secret with `npx wrangler secret delete RESET_OWNER`. Each reset string can be used once even before removal.

Both archives include tools/mcp.mjs and built companion files. Configure WAVEHAUS_URL and WAVEHAUS_TOKEN locally; see tools/README.md. This CLI is optional and never runs on the PHP host.

The 1.0 release was packaged and published without additional testing at the owner’s request. Device background playback and browser-specific behavior remain unverified beyond the historical results in the source repository.
