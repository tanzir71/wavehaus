# Physical background-play matrix

No physical-device run has been observed yet. These are not replaced by Android viewport emulation.

24 Nov 2026: the owner explicitly waived all further testing. This matrix stays unverified; no device run is requested. M5 implements the optional in-app check as a product feature without running it during development.

| Device / route | Result |
|---|---|
| Android Brave, installed PWA, Background play on | Owner reports the native-preload follow-up worked, 24 Nov 2026; previous failure was on Brave 1.99.57 |
| Android Brave, home-screen shortcut | Unverified |
| Android Chrome | Unverified |
| iPhone Brave, option A (default browser; Open as Web App off) | Unverified |
| iPhone Brave, option B (Shortcuts Open URLs) | Unverified |
| iPhone Safari standalone | Unverified, best effort |

Automated M0 evidence: the demo uses one persistent audio element, serves generated originals through the service worker with 206 byte ranges, plays and seeks in Chromium, and reports zero installability errors. The in-app test records wall time, media progress and time spent hidden; it cannot report a pass without a background interval.

24 Nov 2026 recovery regression: PHP browser checks cover guest autoplay into a second public song, resuming an interrupted stream on the same element, single-line mobile Sign in at 360/390/412 px and separation of player action groups. Headless Chromium keeps tabs visible, so the browser test explicitly simulates the hidden/visible lifecycle; this does not verify Android Brave screen-lock behavior. Unit checks cover silent/hung requests, retained retry positions, stale Play failures and Media Session buffering state.

The Android follow-up replaces the discarded byte-range warmup with native next-track preloading. A PHP browser regression loads the successor, disconnects the network across the boundary, verifies playback and persistent element identities, then reconnects and verifies that the queue survives. Repeated transition checks exercise twenty songs across the native roles. The owner subsequently confirmed that this fix worked on their phone; the agent did not directly observe that physical-device run.
