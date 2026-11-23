# Wavehaus

Your music, at home. A self-hosted music streaming PWA that installs from the browser, with the Brave route for screen-off listening.

[Project site](https://tanzir71.github.io/wavehaus/) · [Browser demo](https://tanzir71.github.io/wavehaus/app/) · [Download 1.0](https://github.com/tanzir71/wavehaus/releases/tag/v1.0.0) · [Docs](https://tanzir71.github.io/wavehaus/docs/)

## Wavehaus 1.0

- Original-file uploads from files, folders, drag/drop or Android sharing; resumable chunks, local tags/art/waveforms, duplicate detection and import review.
- Waveform playback, persistent queue, Media Session, sleep timer, radio, daily mixes and smart shuffle. Search and recommendations stay on the device.
- Private-by-default tracks/albums/folders/playlists, member access modes, referrals, quotas, recovery codes and revocable device sessions.
- Bulk tags/rename/artwork, attributed Activity and guarded 30-day Undo. Assistants can use accessible browser controls or scoped API tokens and the packaged MCP server.
- Offline downloads with byte-range seeking, storage/persistence controls, embedded/LRC lyrics, private moments and A–B loops.

The Pages demo generates twelve original tracks across three albums. Its accounts, uploads and media stay in that browser. Initial credentials are `demo` / `wavehaus-demo`; production has its own owner setup and secure HTTP-only sessions. Clearing browser site data removes demo originals and downloads.

## Deploy

Download either archive from [GitHub Releases](https://github.com/tanzir71/wavehaus/releases/latest).

**Shared hosting:** PHP 8.1+ with PDO SQLite, mbstring, openssl and fileinfo; Apache/LiteSpeed with HTTPS and .htaccess. Upload/extract the zip, preserve a private writable data directory outside the web root, then open `/setup`. No Node, Composer, shell or database server is needed on the host. [Installation guide](https://tanzir71.github.io/wavehaus/docs/shared-hosting/).

**Cloudflare:** Workers + D1 + R2. Use Node 24 locally, `npm ci` in server-worker, set the database/bucket bindings and APP_SECRET, then `npm run deploy`. Keep the existing bindings and secrets on updates. [Installation guide](https://tanzir71.github.io/wavehaus/docs/cloudflare/).

Production defaults to `/`. Build with `APP_BASE=/music/` for a subpath and keep the same base on upgrades. The project landing stays on GitHub Pages; a server owner's visitor website is outside this project. Public music is available to signed-in members, without anonymous streaming.

## Run and build

Use Node 24:

```sh
npm ci
npm run dev:demo
```

`npm run dev` starts Vite plus PHP. `npm run dev:worker` starts Vite plus Wrangler after `npm ci --prefix server-worker`. Local data/secrets stay outside the public directory and Git.

```sh
npm run build
npm run build:pages
npm run package
```

Build outputs are app/dist and landing/dist; Pages assembles site/ at `/wavehaus/` with demo `/app/`. Packaging creates both versioned server zips in dist/. Upload and music-metadata are lazy; the initial JavaScript budget is enforced during builds. No dependencies were added beyond the approved list and pinned deployment tooling. [Dependency decisions](docs/DEPENDENCIES.md).

Existing lint/test/API/e2e commands remain in package.json for future use. **The owner explicitly disabled further testing for this implementation.** Publication runs builds only; current browser/device behavior and Lighthouse targets are unverified. Historical measured results remain in [progress](docs/PROGRESS.md).

## Listening and assistants

On Android Brave, enable Settings → Media → Background play and install from the browser menu. The in-app Background play guide includes Android/iPhone shortcut methods and an optional device check. iPhone background playback remains best effort; device/codec support varies. Wavehaus does not transcode.

Download albums/playlists/tracks before going offline. Copies are scoped to this browser/account and its last authenticated session expiry. Sign-out removes downloads; connected clients refresh permissions. A disconnected client learns sharing changes after reconnecting. Downloads are separate from backups.

[Assistant setup and tools](tools/README.md) · [Offline/lyrics/moments](docs/m9-listening.md) · [Deployment and upgrade operations](docs/operations.md).

The original handover is preserved unchanged in [handover/](handover/). P2 work such as crossfade, ReplayGain and expiring external share links remains outside the 1.0 milestones.

MIT licensed. Geist fonts retain the OFL; icon and photography credits accompany the assets. No copyrighted demo audio is committed.
