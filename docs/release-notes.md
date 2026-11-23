Wavehaus M2 adds resumable uploads on PHP, Worker/R2 and the browser demo. Tags, covers, waveforms and large-file hashes are processed in browser workers. Files and analysis survive reloads; immutable chunks and full-file verification prevent corrupt or duplicate imports.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Upload a folder with `cover.png` and an LRC sidecar. Leave New uploads on Private.
2. Reload during upload, resume, then open the album and play a track.
3. Re-add a file to check duplicate handling; try the Public confirmation and Keep screen awake switch.

Both server packages now include uploads, artwork, private library sync and authenticated streaming. Production defaults to `/`; source builds accept `APP_BASE=/music/`. The Pages demo keeps `/wavehaus/app/` and starts as `demo`, with initial password `wavehaus-demo`. Demo files and accounts stay in that browser.

The owner's scope correction keeps visitor websites outside Wavehaus and requires sign-in for media/artwork. Migration 0004 removes the unused visitor schema while preserving released migration history and music data. Worker uploads use temporary R2 staging before multipart assembly, adding temporary storage and operations so racing retries cannot replace an accepted part.

Validation includes the shared API/auth suite on all adapters, exact media ranges, artwork, six-format folder import, second-session sync and simulated share-target POST. A valid 300 MiB generated FLAC passed throttled reload/resume on both servers without resending confirmed chunks. Fresh and M1-upgraded PHP/D1 schemas match; independent ZIP checks and two code overwrites preserve accounts, settings, sessions, secrets, media and player state. Home, Now Playing, Upload, sign-in and Settings accessibility measured 100.

Physical Android share-sheet delivery and screen-lock playback remain unverified. Upload support preserves original formats; the installed Chromium cannot play ALAC. M3 hardens playback, M5 completes the Brave route, and M7 adds member registration/visibility management. This is a milestone preview, not the final 1.0 release. See `docs/m2-verification.md` and `docs/PROGRESS.md` for evidence and limits.
