# Wavehaus

Your music, at home. A self-hosted music streaming PWA that installs from the browser and supports screen-off playback through Brave.

[Project site](https://tanzir71.github.io/wavehaus/) · [Try the app](https://tanzir71.github.io/wavehaus/app/) · [Changelog](https://tanzir71.github.io/wavehaus/changelog/)

## M0 preview

The browser demo generates twelve original tracks across three albums. You can play, scrub, browse, like, queue and upload music. Demo uploads and listening data stay in that browser. Clearing site data removes them.

The project site includes the hosting docs, background-play guide and comparison. Production PHP/Worker packages begin with M1; the server folders in M0 contain migration/deployment skeletons. See [implementation progress](docs/PROGRESS.md) for remaining milestones and verification boundaries.

## Run locally

Use Node 24:

```sh
npm ci
npm run dev:demo
```

```sh
npm run lint
npm test
npm run test:api
npm run build:pages
npm run e2e
```

`npm run build` produces `app/dist` (production base `/app/`) and `landing/dist`. `npm run build:pages` assembles `site/` under the `/wavehaus/` base. `npm run preview` serves it locally. The Upload route and tag parser load separately from the initial app.

## Background play

Open the app in Brave on Android, enable **Settings → Media → Background play**, then install from the browser menu. In Wavehaus, open **Settings → Background play** and run the 30-second screen-off test. Physical-device acceptance is recorded separately from Android viewport emulation.

## Implementation source

[AGENTS.md](AGENTS.md) defines the build rules. The supplied handover, including design exports, brand assets, tokens and API/schema specifications, is preserved in [handover](handover/). The instance homepage and anonymous Showcase are scheduled for M3; they are distinct from the project marketing site.

Runtime dependencies: Preact, Signals, idb-keyval, MiniSearch and lazy-loaded music-metadata. Plain CSS, a hand-written service worker and original generated audio. [Dependency decisions](docs/DEPENDENCIES.md).

MIT licensed. Geist fonts retain the OFL; icon and photography credits are included with the assets.
