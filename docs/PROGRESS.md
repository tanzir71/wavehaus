# Wavehaus implementation

Source of truth: the unmodified files in `/handover`.

## Milestones

- M0 — Implementation and local functional checks complete; publishing the preview and measuring all documentation pages.
- M1–M10 — Pending, in the order defined in `/handover/TASKS.md`.

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
- M1 adds production setup/auth and the first PHP/Worker zips. M2–M10 remain pending.
- Owner-supplied homepage/Showcase additions were incorporated into the handover snapshot. They ship in M3, with the app at `/app/` and the separate project site on Pages.
