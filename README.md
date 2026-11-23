# Wavehaus

Your music, at home. A self-hosted music streaming PWA that installs from the browser and supports screen-off playback through Brave.

[Project site](https://tanzir71.github.io/wavehaus/) · [Try the app](https://tanzir71.github.io/wavehaus/app/) · [Changelog](https://tanzir71.github.io/wavehaus/changelog/)

## M2 preview

The browser demo generates twelve original tracks across three albums. You can play, scrub, browse, like, queue and upload music. Demo uploads and listening data stay in that browser. Clearing site data removes them.

The preview also has sign-in, recovery codes, device pairing and settings. The demo starts as `demo` with initial password `wavehaus-demo`; its accounts and pairing are simulated in that browser. PHP and Worker releases use real secure HTTP-only cookies and support owner setup, recovery and device sessions. Both servers now support resumable uploads, artwork, private library sync and authenticated streaming. Playback hardening continues in M3. See [implementation progress](docs/PROGRESS.md) for remaining milestones and verification boundaries.

## Run locally

Use Node 24:

```sh
npm ci
npm run dev:demo
```

For PHP development install PHP 8.1+ with pdo_sqlite, mbstring, openssl and fileinfo, then run `npm run dev`. For Worker development run `npm ci --prefix server-worker` and `npm run dev:worker`. Local stores live in `.data/`; local secrets are excluded from Git.

```sh
npm run lint
npm test
npm run test:api
npm run build
npm run test:php
npm run test:worker
npm run build:pages
npm run e2e
```

`npm run build` produces `app/dist` (production base `/`) and `landing/dist`. Set `APP_BASE` to a path such as `/music/` before building to serve the app under that path. `npm run build:pages` keeps the demo at `/wavehaus/app/` and assembles the project site under `/wavehaus/`. `npm run preview` serves it locally. The Upload route and tag parser load separately from the initial app.

`npm run package` builds both server zips in `dist/`. Install/update instructions are included in each archive. `python tests/package/redeploy.py` independently validates the zips and verifies two application overwrites against a disposable PHP store; it needs only Python's standard library. `BASE_URL=… npm run test:api` targets an HTTP backend (use a disposable database and TEST_USERNAME/TEST_PASSWORD for an existing fixture account).

## Background play

Open the app in Brave on Android, enable **Settings → Media → Background play**, then install from the browser menu. In Wavehaus, open **Settings → Background play** and run the 30-second screen-off test. Physical-device acceptance is recorded separately from Android viewport emulation.

## Implementation source

[AGENTS.md](AGENTS.md) defines the build rules. The supplied handover, including design exports, brand assets, tokens and API/schema specifications, is preserved in [handover](handover/). A visitor website is outside this project's scope. Music and artwork require a signed-in session in P0.

Runtime dependencies: Preact, Signals, idb-keyval, MiniSearch and lazy-loaded music-metadata. Plain CSS, a hand-written service worker and original generated audio. [Dependency decisions](docs/DEPENDENCIES.md).

MIT licensed. Geist fonts retain the OFL; icon and photography credits are included with the assets.
