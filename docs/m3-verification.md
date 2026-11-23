# M3 verification

The playback controller owns one permanent audio element; UI routes do not own
its lifetime. Unit checks cover synchronous source/play ordering before event
logging, paused restore without a media load, stale restoration/play promises,
bounded 1/2/4/8-second recovery, interruption intent, unsupported-format cycles,
seek-safe listening counters, repeat and sleep behavior. Queue checks cover
duplicate occurrences, manual priority, shuffle and section restoration.

Local evidence:

- TypeScript and Worker TypeScript pass. There are 50 passing unit checks.
- Demo/PHP/Worker each pass 25 API checks, with one explicit backend-specific
  skip. State replacement is validated and timestamp-ordered; play retries are
  idempotent and history pagination does not lose timestamp ties.
- Each real HTTP server passed four ordinary browser checks: account/pairing,
  uploads, artwork/lyrics and private second-device sync. The unchanged 300 MiB
  upload checks run in CI; they were not repeated in these ordinary local runs.
- Android and desktop browser checks verify album context, two manual additions,
  reordering, reload, retained paused position through the idle save interval,
  no media request during restore, keyboard seek and end-of-track sleep taking
  precedence over repeat-one.
- Twenty distinct original one-second WAVs were uploaded and played at an
  accelerated native rate on each viewport. All nineteen measured transitions
  were below 300 ms and the DOM retained one audio element. This verifies browser
  sequencing, not physical screen-lock behavior or gapless codec padding.
- A real original ALAC fixture failed in the installed Chromium and skipped to
  the next queued WAV. The automated codec case applies when Chromium does not
  advertise ALAC support. Unsupported formats do not become skip feedback.
- Lighthouse 13.6 accessibility measured 100 on Home, Now Playing and Queue.
  Visible queue labels were also aligned with their accessible names after the
  supplementary label-in-name audit flagged the old labels.
- Initial JavaScript remains below 90 KiB gzip: approximately 66 KiB for demo
  and 55 KiB for production, with upload analysis still lazy.
- Twelve PHP offload path/header checks pass. Default PHP streaming retains the
  shared range contract. The first CI run passed the API and browser server checks through actual
  Apache `mod_xsendfile`, including byte ranges and HEAD; see `media-offload.md` for host configuration and the LiteSpeed limit.

Packaging and the full final CI run are checked before tagging the release.
The detached Worker archive is type-checked independently of the repository's
frontend source. Both archives are checked for safe redeploy behavior.

Physical Android Brave/Chrome screen-lock checks, iPhone checks and a real
LiteSpeed context are unverified. These remain explicit device/host checks.
M6 owns full radio ranking; M9 owns A–B and moment editing.
