# Wavehaus Worker — M1

Owner setup, sign-in, recovery, devices and settings are implemented. Production music uploads/streaming arrive in M2/M3. The Pages demo already has generated music.

Use Node 24+ locally; there is no Node server to manage.

1. Run `npm ci --prefix server-worker`, then `cd server-worker`.
2. Run `npx wrangler login` and `npx wrangler d1 create wavehaus`. Put the returned database ID in `wrangler.toml`.
3. Run `npx wrangler r2 bucket create wavehaus-media`. D1 and R2 persist across deployments.
4. Generate a random secret of at least 32 bytes and save it with `npx wrangler secret put APP_SECRET`.
5. Run `npm run deploy`. It applies forward-only D1 migrations before deploying the Worker and included PWA assets. Open the deployed URL at `/setup` and save the recovery codes.

Workers Paid ($5/month) is recommended: PBKDF2-SHA256 at 100,000 iterations can exceed the Free plan CPU allowance. Advanced Free-plan users can set `PBKDF2_ITERATIONS` below 100,000 as a Worker variable, accepting weaker hashing; the app shows a warning. Successful sign-in upgrades a hash when the configured count changes.

For local development in the source repo use `npm run dev:worker`. Its generated `.dev.vars` is private and excluded from releases. For this archive use `npx wrangler d1 migrations apply wavehaus --local`, create `.dev.vars` containing `APP_SECRET=<your-random-secret>`, then `npx wrangler dev`.

Update by replacing code and assets while keeping your database ID, bucket name and secrets. Never delete the D1 database or R2 bucket to update. Migrations are idempotent; settings use INSERT OR IGNORE defaults. Keep a D1 export/Time Travel recovery point before upgrades.

Last-resort owner recovery: `npx wrangler secret put RESET_OWNER`, open `/setup/reset`, then remove the secret with `npx wrangler secret delete RESET_OWNER`. Each reset string can be used once even before removal.
