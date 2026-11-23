Wavehaus M9 adds offline listening, synced lyrics, saved moments and A–B loops.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Download an album or playlist and manage its copies in Downloads or Storage & backups.
2. Open Now Playing with embedded lyrics or a matching LRC sidecar for a synced lyrics view.
3. Save a moment on the waveform and set A/B handles to repeat a section.

Both server archives include moments CRUD and migration 10. Downloads use account-scoped Cache API storage and full-response byte ranges, with permission checks when connected and local session expiry when offline. A disconnected device receives visibility changes on reconnection.

As requested, only builds needed for packaging/publication were run. No tests, browser checks, Lighthouse runs or device checks were performed.
