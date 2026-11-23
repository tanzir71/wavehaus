Wavehaus M3 hardens playback and connects the core player screens to one persistent audio engine.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Start an album, add two tracks, reorder them in Queue and reload. Resume at the saved position.
2. Scrub the waveform or use arrow keys, toggle shuffle/repeat, and choose an end-of-track sleep timer.
3. On Android Brave with Background play enabled, lock the phone and check track advance and lock-screen artwork/controls.

The engine resolves the next source before ended, calls play synchronously, handles external pauses and retries network failures with bounded backoff. Local persistence keeps the full queue; a bounded cloud window preserves its sections and context. Listening events retry idempotently. Sleep offers 5/15/30/45/60 minutes or end of track, with a final fade on desktop/Android.

Now Playing and Queue follow the approved design, using generated/user covers in the actual app. Canvas waveforms support keyboard and pointer seeking, proportional album segments and saved moment markers. The mobile mini player uses the Mini geometry; desktop keeps its single-row player. The v0.2.1 landing mockup/footer corrections are retained.

PHP's authenticated range streamer remains the default. Optional X-Sendfile and protected LiteSpeed-context handoffs are configured in the private data directory; details ship in MEDIA-OFFLOAD.md in the PHP archive. No client dependency was added. Local validation includes 50 unit checks, 12 offload path/header checks, the API suite on all three adapters, server browser flows, paused restore, queue ordering, and twenty distinct original tracks with all nineteen measured browser transitions below 300 ms on one audio element. Home, Now Playing and Queue accessibility measured 100. See docs/m3-decisions.md and docs/m3-verification.md for evidence and limits.

Physical Android screen-lock playback and a real LiteSpeed context remain unverified. Viewport emulation does not establish those results. M3 autoplay uses an initial local selection; the full M6 radio-ranking worker comes later. A–B and moment editing remain M9. This is a milestone preview, not the final 1.0 release.
