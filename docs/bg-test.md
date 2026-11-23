# Physical background-play matrix

No physical-device run has been observed yet. These are not replaced by Android viewport emulation.

24 Nov 2026: the owner explicitly waived all further testing. This matrix stays unverified; no device run is requested. M5 implements the optional in-app check as a product feature without running it during development.

| Device / route | Result |
|---|---|
| Android Brave, installed PWA, Background play on | Unverified |
| Android Brave, home-screen shortcut | Unverified |
| Android Chrome | Unverified |
| iPhone Brave, option A (default browser; Open as Web App off) | Unverified |
| iPhone Brave, option B (Shortcuts Open URLs) | Unverified |
| iPhone Safari standalone | Unverified, best effort |

Automated M0 evidence: the demo uses one persistent audio element, serves generated originals through the service worker with 206 byte ranges, plays and seeks in Chromium, and reports zero installability errors. The in-app test records wall time, media progress and time spent hidden; it cannot report a pass without a background interval.
