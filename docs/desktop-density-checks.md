# v1.1.0 desktop density review

The owner is handling browser and device acceptance manually. Further Playwright runs were stopped at their request on 24 November 2026.

## What to review

Open https://tanzir71.github.io/wavehaus/app/ and compare with the updated D1–D6 frames in `design/desktop/`.

- At 1440 × 900: Home, an album, Upload, Bulk edit, Settings → Access & members, and Settings → AI assistants.
- Resize to 1100 and 1280: keep the 232 px sidebar, four quick-tile columns, six mix columns, compact controls and no horizontal overflow. Mix covers shrink to fit narrower desktops and stop at 168 px.
- Select an album's tracks and open Edit tracks to see 42 px bulk rows and the 340 px editor. Use the keyboard to check focus rings and file-picker access.
- On Assistants, both method cards should share one height and the Try asking box should contain all its text.
- Compare 412 × 915 and 900 × 1100 with 1.0. Check the player, Jump back in, Now Playing, waveform heights, and upload-list items retain their previous sizes.

The demo contains generated music and dynamic recommendations, so its content differs from the static Figma examples. Storage copy remains truthful to the active backend rather than showing a fictional track count or hosting plan.

## Checks completed before the manual handoff

- Production packaging and Pages builds succeeded. Both v1.1.0 archives were generated. Initial JavaScript: 64.4 KB gzip production, 77.6 KB demo (90 KB budget).
- Unit suite: 170 passed across 15 files.
- Density E2E: 3 passed, 1 intentionally skipped (desktop-only checks in the Android project). Checks cover 1100/1280/1440, mobile/tablet geometry, artwork, control sizes, overflow, equal-height methods and prompt growth.
- A captured comparison passed all 17 pixel checks (seven pages at each mobile/tablet size, plus three protected desktop listening areas). Subsequent capture runs also showed intermittent mobile Home/Upload differences; automated screenshot acceptance is not claimed. Final visual acceptance belongs to the owner's manual review.

## Existing validation failures

The full suites are **not** reported as green:

- The older E2E suite stopped after five failures: upload tests expect Done statuses while mobile navigates to Review import; queue tests expect actions outside the Track options menu; the changelog expected only five releases. The release-link assertion was updated for v1.1.0. No upload or playback behavior was changed.
- Demo API contract run: 24 passed, 3 failed, 1 skipped. Failures were the old schema-6 assertion (current schema is 10), a grouped-import Undo returning 409, and queue expectations omitting smart-shuffle defaults. Backend implementation and contract expectations were left unchanged by this visual pass.
- TypeScript checking reports errors in existing demo access/journal, collection, background-play, join, lyrics and upload-import code. No errors were reported in the density component edits.
- Physical Android Brave/Chrome, iPhone playback and Lighthouse were not remeasured.

## Optional automated visual check

`scripts/check-density.mjs` captures local artifacts in ignored `.work/density/`. Use the same browser build for both captures:

1. Build/serve the 1.0 Pages app, then run `npm run check:density -- --baseline`.
2. Build/serve v1.1, then run `npm run check:density`.

`DENSITY_URL` selects the served app URL; `PLAYWRIGHT_CHANNEL=msedge` uses an installed Edge browser. The default is Playwright Chromium. Baselines stay local to avoid cross-platform font-rasterization differences. Desktop listening areas are compared at identical widths, isolated from fixed chrome; dates and generated IDs are fixed for the capture only.

The new tests remain available in `tests/e2e/density.spec.ts` for a future automated run. They are not added to the publication workflows.
