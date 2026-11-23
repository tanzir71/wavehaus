# M3 implementation decisions

Player state can also include `sections`: canonical context IDs, remaining context, user-added tracks, prepared autoplay, recent history with its queue source, current track/source, and context name/type. This preserves queue order and shuffle behavior across reloads. State is validated before replacement; malformed input leaves the previous snapshot intact. Server snapshots are bounded to 2,000 IDs per queue section (100 autoplay/history entries).

Play events accept a client-generated ULID. Retries insert each event once, and all adapters return the actual insertion count. A play for a track that is no longer accessible is ignored, so a privacy change does not prevent other queued events from syncing. Read history is always restricted to the signed-in user's events and uses a timestamp-plus-ID cursor.

The handover suggests `sendBeacon` for pagehide. Beacon supports POST and does not let the app add the required `X-Wavehaus` header; player state uses PUT. The implementation uses `fetch` with `keepalive` and the normal CSRF header, while preserving state locally. This follows the [Beacon API's guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) and the [keepalive request API](https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive). No CSRF exception or anonymous write route is added.
