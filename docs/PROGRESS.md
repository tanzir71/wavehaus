# Wavehaus implementation

Source of truth: the unmodified files in `/handover`.

## Milestones

- M0 — Shipped: PR #1 merged, tag/release `v0.0.0`, CI and Pages green. The live preview was checked for playback, installability and deep routing.
- M1 — Implemented and locally verified; milestone PR/release and Pages deployment pending.
- M2–M10 — Pending, in the order defined in `/handover/TASKS.md`.

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
- M2–M10 remain pending. M1 production music endpoints intentionally remain unavailable until M2/M3.
- Owner-supplied homepage/Showcase additions were incorporated into the handover snapshot. They ship in M3, with the app at `/app/` and the separate project site on Pages.

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
