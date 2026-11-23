# Recommendations, autoplay & search (all on-device)

Everything runs in `recs.worker.ts` and `search.worker.ts`. The worker reads the IndexedDB library and the user's own plays, likes and moments. No server compute, and nothing leaves the server. The landing page promises "Mixes without surveillance".

## Signals

| Signal | Source | Weight idea |
|---|---|---|
| Completed play | `plays.completed` | +1.0 |
| Partial play ≥ 30 s | `plays.ms_played` | +0.4 |
| Skip < 30 s | `plays.skipped` | −0.8 (−1.2 if skipped within 10 s) |
| Like | `likes` | +3.0 |
| Moment saved | `moments` | +1.5 |
| Added to playlist | `playlist_items` | +1.0 |
| Recency | `exp(−age_days / 30)` multiplier on play signals | |

**Track affinity** `aff(t)` is the decayed sum of the signals above. **Artist affinity** is the sum of its tracks' affinity, damped by `sqrt(trackCount)`.

**Co-listen graph:** plays in the same listening session count as co-occurrence. A session is a gap of 30 min or less. Edges connect artist↔artist and track↔track, weighted by `1 / distance-in-session`. Edges are only built when the listening wasn't auto-generated (exclude `context = autoplay|radio` with weight 0.3).

**Content similarity** (cold start and tie-breaks):
- same album artist: 1
- same genre (normalised): 0.6
- year within 5 years: 0.4
- BPM within ±8: 0.3
- same folder root: 0.5
- same uploader: 0.2

## Home rows (M1 `9:168`, D1 `22:171`)

- **Jump back in:** the last played context, with the waveform hero and the resume position. Shows its moments.
- **Quick tiles** (desktop 2×4, mobile 2×3): Liked songs, top playlists, Daily Mixes, recent albums.
- **Made for you:**
  - **Daily Mix 1–4:** cluster artists with label propagation on the co-listen + similarity graph, then keep the top 4 clusters by affinity. Each mix has 50 tracks: 70% known (affinity > 0), 30% discovery (same cluster, low or no plays). Regenerated daily, deterministic per day: `seed = YYYYMMDD + userId`, RNG `mulberry32`.
  - **On Repeat:** the top 30 tracks by plays in the last 30 days.
  - **Rediscover:** high lifetime affinity, no plays in 90 days or more.
  - **Fresh from your uploads:** the latest upload batches.
  - Mix covers use the generated-cover algorithm with the mix name. Tint comes from the cluster's top artist.
- **Fresh uploads:** feed cards per upload batch, SoundCloud-style, each with an album waveform. Card text: "Halden · 11 tracks · added 2 min ago from Pixel 9" and "organised by Claude · 14:02" when an assistant did it.
- **Recently played**, then **Because you played <artist>** (radio from the top artist of the week).

Empty or cold library (under 20 plays): Daily Mixes become "Shuffle by folder" and "Albums you haven't played". The row subtitle says "Mixes get better as you listen".

## Autoplay / radio scoring (`recs.radio(seed, n)`)

```
score(c) = 0.30·artistSim(seed,c) + 0.20·coListen(seed,c) + 0.15·contentSim(seed,c)
         + 0.20·norm(aff(c)) + 0.15·explore(c)
         − 1.00·[played in last 2 h] − 0.40·[same artist as either of last 2 queued]
         − 0.60·skipRate(c)
explore(c) = 1 if c never played, else 0   (sample ε = 0.15 of picks from top-200 by contentSim only)
```

- Candidate pool: tracks the user can play (own + public), excluding the current queue.
- Pick by weighted sampling from the top 100, with temperature 0.7. That keeps it fresh but on-theme.
- Autoplay appends 10 and refills when 3 are left. Each autoplay track shows a "Because you played X" hint in the Queue (M6 `11:557`).
- **Radio** (a menu item on a track, artist or album): an endless queue built from that seed, using the same function.
- **Smart shuffle:** shuffles the context, then reorders so the same artist isn't adjacent where possible. With "smart" on, it injects 1 recommendation every 5 tracks, marked with the sparkles icon.

## Smart playlists (P1)

JSON rules evaluated client-side, e.g. `{"all":[{"field":"genre","op":"is","value":"Ambient"},{"field":"plays","op":">","value":3}]}`. Fields: artist, album, genre, year, added, plays, lastPlayed, liked, visibility, folder, uploader, duration, bpm, codec.

## Search (`search.worker.ts`, MiniSearch)

- Index fields and boosts: `title` 3, `artist` 2, `album` 2, `albumArtist` 1.5, `folder` 1, `genre` 1, `momentLabels` 1.
- Options: `prefix: true`, `fuzzy: 0.2`, `combineWith: 'AND'`. The query is normalised (lowercase, accents and punctuation stripped).
- Grouped results (M2 `10:314`): **Top result** (big card, play button), **Songs** (4, then **See all**), **Albums**, **Artists**, **Folders**, **Moments** ("the drop · 2:41").
- Filter chips: Songs · Albums · Artists · Folders · Moments · Downloaded · Private.
- The empty query shows recent searches and browse-by-genre tiles (generated covers).
- Desktop: `/` focuses search and `↑↓⏎` moves through results.
- The index rebuilds incrementally on sync deltas. 20k tracks index in under 300 ms on a mid phone.
