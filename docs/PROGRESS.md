# Wavehaus implementation

Owner instruction, 24 Nov 2026: finish implementation without further testing. CI now builds release packages and Pages only. Existing test files and historical results are retained; no further automated, browser or physical-device tests are requested.

Source of truth: the unmodified files in `/handover`.

## Milestones

- M0 — Shipped: PR #1 merged, tag/release `v0.0.0`, CI and Pages green. The live preview was checked for playback, installability and deep routing.
- M1 — Shipped: PR #2 merged, tag/release `v0.1.0`, both server archives published and Pages green. Settings, Security and pairing were checked on the deployed preview.
- M2 — Shipped: PR #3 merged, tag/release `v0.2.0`, both archives published, CI and Pages green. A real file upload, private album and playback were checked on the deployed preview.
- Landing correction — Shipped: PR #4, v0.2.1 and Pages verified at 412 and 1920 px. See `landing-fix-verification.md`.
- M3 — Shipped: PR #5, tag/release `v0.3.0`, PR CI, Pages and release checks green. Queue restoration, generated Media Session artwork and installability were checked on the live preview.
- M4 — Shipped: PR #6, v0.4.0, release archives and Pages published.
- M5 — Shipped: PR #7, v0.5.0, release archives and Pages published.
- M6 — Implemented: worker search, library views, playlist CRUD/reorder/Undo, daily recommendations, radio/autoplay and smart shuffle. Publishing v0.6.0.
- M7–M10 — Pending, in the order defined in `/handover/TASKS.md`.

## Verification boundaries

Automated Android viewport checks cannot prove screen-locked playback on a physical phone. Device checks will be recorded as unverified until observed. Lighthouse targets are measured, not assumed.

## Reference source

Tack located at `C:/Users/tanzir/Desktop/project_priority/project-priority`. Read-only reference; no changes to Tack are part of this task.

## M0 verification

- TypeScript: passed.
- Unit tests: 11 passed (full, partial, suffix, open-ended, invalid and HEAD media ranges).
- Browser-backed demo API contract: 8 passed.
- Playwright: 8 passed across Android 412×915 and desktop 1440×900, including upload → private library → playback → reload.
- Chromium CDP: no PWA installability errors on either viewport; no page errors during inspection.
- Lighthouse 13.6.0 mobile: L1 landing 100 performance / 100 accessibility / 100 best practices / 100 SEO; app Home and Now Playing accessibility 100.
- All 14 static subpages also measured 100/100/100/100 after correcting comparison heading order and underlining paragraph links. Scores are recorded in `m0-lighthouse.json`.
- Initial demo entry JavaScript: 41.9 KB gzip, plus a small module runtime. Upload and metadata parsers remain lazy and are excluded from shell precaching.
- Dependency audit: zero known vulnerabilities.

## Remaining acceptance

- Physical Brave/Chrome/iPhone screen-lock and OS share-target checks remain unverified; viewport emulation does not establish those results.
- M7–M10 remain pending. Production upload and authenticated media endpoints are implemented.
- The 23 November scope correction removes the visitor website and anonymous media access. Production builds default to `/` and support `APP_BASE`; Pages retains `/wavehaus/app/`.

## M1 verification

- Frontend and Worker TypeScript checks passed.
- Shared API/auth contract: 17 passing checks per adapter (demo, PHP and actual local Worker/D1). The one skipped check per target is explicitly backend-specific: seeded upload validation for demo, independent browser-session revocation for HTTP servers.
- PHP and Worker: Android and desktop browser flows passed, using real Secure/HttpOnly `__Host-` cookies, a separately paired browser and session revocation.
- Pages demo: 10 browser checks passed across Android and desktop, including saved-code gating, device pairing UI, sign-out clearing playback, and stored-media denial after sign-out. Two server-only tests are exercised separately by the backend runners.
- One-use owner reset was tested with competing requests on Worker and the packaged PHP server.
- Both ZIPs passed independent standard-library ZIP validation. Two overwrites preserved the owner, settings, sessions, secret, media and player state. Private routing, password rehash on login and random fallback-data discovery also passed.
- Lighthouse 13.6.0: Home, Now Playing, sign-in and Settings accessibility 100; no zero-score audits. Chromium reported no PWA installability errors. Results: `m1-lighthouse.json`.
- Initial entry JavaScript: 48.8 KB gzip in demo; about 41.5 KB in production. Upload/music-metadata and auth screens load as separate chunks.
- Tack port mapping and explicit M7 registration/spam-hardening deferrals are recorded in `REFERENCES.md`.
- Linux CI passed the full suite, including the independent package/redeploy test. The PHP reset config also passed with OPcache timestamp validation disabled. The updated changelog measured 100/100/100/100.

## M2 verification

- 23 unit checks and 23 shared API/auth checks per adapter passed. The one skipped API check per target is explicitly backend-specific.
- Both HTTP backends passed browser tag/artwork/lyrics and second-session sync checks, plus a 300 MiB throttled reload/resume test with exact SHA and no confirmed-chunk retransmission.
- Six-format folder import and duplicate override passed on Android and desktop Pages emulation. The share-target handler passed simulated POST intake; physical OS sharing is unverified.
- Fresh/upgraded/legacy SQLite and D1 schemas match, with preserved data and foreign keys. Both release archives passed safe overwrite checks.
- Home, Now Playing, Upload, sign-in and Settings accessibility measured 100. Initial JS including static imports is about 55 KiB gzip in demo and 44 KiB in production.
- Details and boundaries: [M2 verification](m2-verification.md).
