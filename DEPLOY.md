# Deploy & update

There are three targets:
- **A. GitHub Pages**: the milestone preview, in demo mode.
- **B. Shared hosting**: production.
- **C. Cloudflare**: production.

They all serve the same PWA build. Production releases come out as two zips from `npm run package`, attached to every GitHub Release.

## A. GitHub Pages preview (every milestone)

**One-time setup (Codex does this in M0):**
1. `gh repo create tanzir71/wavehaus --public --license mit`, then push the monorepo, with the handover in `/handover`.
2. In the repo, go to Settings → Pages → Build and deployment and set Source to **GitHub Actions**.
3. Add `.github/workflows/pages.yml`:

```yaml
name: pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build:pages        # landing → site/, app (VITE_BACKEND=demo, base /wavehaus/app/) → site/app/
      - run: cp site/index.html site/404.html   # landing 404; the app has its own SPA fallback inside /app/
      - uses: actions/upload-pages-artifact@v3
        with: { path: site }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.d.outputs.page_url }}" }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

**Preview URLs:**
- Landing and subpages: `https://tanzir71.github.io/wavehaus/` (`/docs/…`, `/background-play`, `/self-hosted-spotify-alternative`, `/changelog`).
- App, demo mode: `https://tanzir71.github.io/wavehaus/app/`. Install it from Brave on Android to test background play on the preview.

**App SPA fallback on Pages:** `site/app/404.html` is a copy of the app's `index.html`. The router reads `location.pathname` relative to the base.

**Per milestone:**
1. Merge to `main`. The preview deploys automatically.
2. Tag `v0.N.0`. `release.yml` builds and attaches the shared-hosting and Worker zips.
3. Update `CHANGELOG.md`, which also feeds the L5 Changelog page.
4. Post the preview URLs and "what to try" in the PR.

**Custom domain (optional, later):** add `CNAME` with e.g. `wavehaus.tanziro.com`, then set the landing base to `/` and the app base to `/app/`.

## B. Shared hosting (Namecheap Stellar/cPanel, any PHP 8.1+ host)

**Requirements:**
- PHP 8.1+ with `pdo_sqlite`, `fileinfo`, `mbstring` and `openssl`. `sodium` is optional.
- Apache or LiteSpeed with `.htaccess` (`mod_rewrite`) and HTTPS (AutoSSL).
- No shell, Composer, Node or MySQL needed.

**First install (about 5 minutes, no terminal):**
1. cPanel → **Domains**: create `music.yourdomain.com` (or use a folder). Note the document root, e.g. `~/music.yourdomain.com`.
2. cPanel → **File Manager**: upload `wavehaus-shared-hosting-vX.Y.Z.zip` into the document root and **Extract**.
3. Create the data folder **outside** the web root: `~/wavehaus-data` (File Manager → + Folder).
   - If the host doesn't allow that, the app falls back to `./data-<random>/` with a deny-all `.htaccess`. Setup shows which one it used.
4. Open `https://music.yourdomain.com/setup`. It checks the requirements (PHP version, extensions, data dir writable, `upload_max_filesize`, `post_max_size`, `memory_limit`) and shows each red item with the exact fix.
5. Create the owner account and **save the recovery codes**. Done. Open it on your phone and follow the Background play guide.

**Recommended PHP settings** (cPanel → **Select PHP Version** → Options, or `.user.ini` in the app root, which the release includes):
```
upload_max_filesize = 64M
post_max_size = 72M
memory_limit = 256M
max_execution_time = 300
```
Chunks adapt to whatever limit is reported, down to 2 MB, so small limits still work, just slower.

**What's in the zip:**
```
index.php            front controller (routes /api, /media, /art, /setup, else serves app shell)
.htaccess            rewrite → index.php; deny lib/, migrations/; caching for /assets
.user.ini            PHP limits (above)
lib/*.php            db, auth, router, uploads, media, ratelimit, migrate (no Composer)
migrations/*.sql
app/                 built PWA (index.html, assets/*, sw.js, manifest)
data.example/        README only — real data lives in ~/wavehaus-data
VERSION
```

**Updating (safe):**
1. Download the new zip, upload it and **Extract → overwrite** in the app folder. `~/wavehaus-data` is never touched.
2. Open the app. The first request backs up `wavehaus.sqlite` to `wavehaus-data/backups/`, then runs any pending migrations, with a lock so it happens once.
3. Settings → Updates shows the new version and schema version.

**Rollback:** re-extract the previous zip. If a migration ran, restore the matching backup from `backups/` (owner-only Download/Restore in Settings → Updates, P1).

**Media streaming performance:**
- On LiteSpeed (Namecheap), PHP hands files to the web server with `X-LiteSpeed-Location`, so PHP isn't tied up while streaming.
- On Apache with `mod_xsendfile`, it uses `X-Sendfile`.
- Otherwise it falls back to PHP streaming in 256 KB chunks.
- Check the plan's inode and disk limits: a 50 GB library needs a plan that allows it.

**Backups:** download `wavehaus-data` with cPanel → Backup → Home Directory, or just that folder. SQLite is a single file.

## C. Cloudflare (Workers + R2 + D1)

**Requirements:** a Cloudflare account and Node 18+ locally (for `wrangler`). The CLI is needed only to deploy.
- **Workers Paid ($5/mo) is recommended.** Password hashing (PBKDF2) needs more than the Free plan's 10 ms CPU per request. Everything else fits Free.
- R2 bills storage beyond the free allowance and has no egress fees. Check current pricing and limits at developers.cloudflare.com.
- Worker request bodies are capped at 100 MB (plan-dependent), so the server reports 90 MB as the chunk maximum and uses R2 multipart uploads.

**First install:**
```bash
unzip wavehaus-worker-vX.Y.Z.zip && cd wavehaus-worker   # (later: an `npm create wavehaus` starter, P2)
npx wrangler login
npx wrangler d1 create wavehaus        # paste database_id into wrangler.toml
npx wrangler r2 bucket create wavehaus-media
npx wrangler secret put APP_SECRET     # 32+ random bytes
npm run deploy                         # = wrangler d1 migrations apply wavehaus --remote && wrangler deploy
```
Then open `https://<worker>.<account>.workers.dev/setup`, or add a custom domain under Workers → Settings → Domains.

**`wrangler.toml` (shape):**
```toml
name = "wavehaus"
main = "src/index.ts"
compatibility_date = "2026-11-01"
assets = { directory = "../app/dist", not_found_handling = "single-page-application", run_worker_first = ["/api/*", "/media/*", "/art/*", "/setup*", "/share-target", "/pair*", "/join/*"] }
[[d1_databases]]
binding = "DB"
database_name = "wavehaus"
database_id = "…"
migrations_dir = "../migrations"
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "wavehaus-media"
```

**Updating:** `git pull` (or extract the new zip), then `npm run deploy`. D1 and R2 persist. Migrations are applied before the new code goes live. At runtime the Worker returns `503 migrations_pending` if the schema is behind.

## D. Local development

- `npm i && npm run dev`: Vite on :5173 proxies `/api`, `/media` and `/art` to `php -S localhost:8080 -t server-php/public` (data in `./.data`).
- `npm run dev:worker` uses `wrangler dev` with local D1 and R2 instead.
- `BASE_URL=http://localhost:8080 npm run test:api` runs the same contract suite against either backend.
- `npm run dev:demo` runs the app with the in-browser demo backend and no server. `npm run build:pages && npx serve site` reproduces the Pages preview locally.

## Portfolio website pair

`npm run build:website -- --out <staging-directory>` builds the PHP/PWA payload
with APP_BASE=/wavehaus/app/. The website owns /wavehaus and packages this app
inside its single verified Namecheap ZIP. After authorized source commits run
`npm run sync:website -- --website <website-checkout>`; use `--check` from either
checkout to verify the source pin and archive. WAVEHAUS_WEBSITE_DIR supplies the
destination. Updates overwrite public files in place and retain ~/wavehaus-data
or an existing deny-all data-<random> directory. Never re-run owner setup.
Nested PHP installs use __Secure-wh_session with Path matching APP_BASE; root
installs retain __Host-wh_session. The public /background-play guide works
before sign-in; /join/request opens the Request access form.
