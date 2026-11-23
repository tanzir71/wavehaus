# M3 implementation decisions

Player state can also include `sections`: canonical context IDs, remaining context, user-added tracks, prepared autoplay, recent history with its queue source, current track/source, and context name/type. This preserves queue order and shuffle behavior across reloads. State is validated before replacement; malformed input leaves the previous snapshot intact. Server snapshots are bounded to 2,000 IDs per queue section (100 autoplay/history entries).

Play events accept a client-generated ULID. Retries insert each event once, and all adapters return the actual insertion count. A play for a track that is no longer accessible is ignored, so a privacy change does not prevent other queued events from syncing. Read history is always restricted to the signed-in user's events and uses a timestamp-plus-ID cursor.

The handover suggests `sendBeacon` for pagehide. Beacon supports POST and does not let the app add the required `X-Wavehaus` header; player state uses PUT. The implementation uses `fetch` with `keepalive` and the normal CSRF header, while preserving state locally. This follows the [Beacon API's guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) and the [keepalive request API](https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive). No CSRF exception or anonymous write route is added.

The hard single-audio requirement in TASKS.md takes precedence over PLAYBACK.md's optional second-element preloader. One permanent element plays every track; a bounded same-origin range request warms the next resource while playing (except with Save Data). Restoring a paused player does not fetch audio. The next URL is resolved before `ended`; source assignment and `play()` precede deferred logging and persistence.

The full queue stays in account/backend/base-scoped IndexedDB. A 2,000-entry cloud window preserves the current track, recent history, manual additions and upcoming context. Pagehide sends state only below 48 KiB and a plays batch only below 12 KiB, retaining local data when a request cannot be sent. Older server timestamps cannot replace newer state. Slow restoration cannot replace a newer user selection.

M3 autoplay prepares up to ten tracks locally and excludes queued, unsupported and recently played tracks; M6 replaces this initial catalog selection with the full radio ranking worker. Queue order, source and context survive reloads. Manual additions have distinct occurrence keys, so the same track can be queued more than once.

The Figma M5 reference uses an accent play button despite the older DESIGN.md component table describing a white one. M3 follows the rendered frame and design-context component. The shuffle icon now inherits its control's color so its off state no longer looks selected. Artwork remains dynamic generated/user artwork in the app; landing reference photographs are not bundled as app defaults.

Header/path validation for optional offloading is covered locally. The Apache integration requires the optional Apache test server/module in CI; these are test infrastructure, with no new client dependency or required runtime module on shared hosts. LiteSpeed's protected context must be checked on the selected host; PHP streaming remains the default.
