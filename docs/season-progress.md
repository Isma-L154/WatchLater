# Season progress for TV shows

How multi-season shows are tracked, and why the design landed where it did.
Supersedes the original proposal; this describes what is actually implemented.

## Problem

`watched` is a boolean. For a film that is the whole truth. For a six-season
show it is a lie by omission: "halfway through season 3" collapses into either
_To Watch_ or _Watched_, and both are wrong.

## What we track

Two columns on `watchlist_item`:

| Column          | Type      | Meaning                                                    |
| --------------- | --------- | ---------------------------------------------------------- |
| `seasons_seen`  | `integer` | Seasons finished. Defaults to `0`, meaningless for movies. |
| `total_seasons` | `integer` | TMDB's count, snapshotted on save. Null for movies.        |

Season granularity, not episodes: episodes would mean an extra TMDB request per
season and a lot of tapping for precision nobody asked for. Seasons are the unit
people actually remember ("I'm on season 3").

### Why a counter, not a join table

A `watchlist_season` table (or a JSON array like `[1,2,4]`) would model "watched
1, 2 and 4 but skipped 3". That is not how series are watched — progress is
genuinely one-dimensional, so a single integer captures it and buys:

- no extra table, no join, no N+1 — the list query is unchanged;
- a trivial percentage for the progress bar;
- a one-tap `+`, which is the action people actually perform.

If non-contiguous viewing ever matters, the counter migrates cleanly
(`seasons_seen = N` becomes rows `1..N`). Nothing has to be thrown away.

## The invariant

```
watched = totalSeasons != null && seasonsSeen >= totalSeasons
```

`deriveWatched()` in [`src/lib/domain/progress.ts`](../src/lib/domain/progress.ts) owns this,
and the server applies it on **every** write — never the UI alone — so a stale
tab or a replayed form post cannot leave progress and status disagreeing.

Two consequences, both deliberate:

- Marking the final season complete flips the show to _Watched_.
- Stepping back from complete lands on `totalSeasons - 1`, not zero. Those
  seasons really were watched; discarding that would be data loss. `Unwatch` on
  a tracked show does the same.

## Where the season count comes from

Always the server, never the browser. The client sends only "how far I got"; it
cannot inflate the bounds it is measured against.

- **On save.** `add` fetches the count from TMDB for TV entries. Search and
  trending responses don't carry it, so this costs one extra request — but only
  for TV, and only once per title.
- **On completion.** `setSeasons` re-checks with TMDB when the change would
  finish the show. This is the one moment being wrong is visible: a series that
  has since returned must not be marked as finished. A show at 5/5 that gains a
  sixth season becomes 5/6 and reappears in _Watching_.
- **On first tracking.** Entries saved before this feature existed have no
  count; the first `setSeasons` resolves and stores one.

Every other tap is a pure database write with no external call.

This also answers the question the original proposal left open — whether a
still-running but fully-watched show should read _Watched_ or _Caught up_. It
needs no fourth status: the completion check keeps the count honest, so such a
show simply stops being complete when a new season lands.

## Interaction

Movies and single-season shows keep the plain watched toggle — a stepper from 0
to 1 is pure friction. Multi-season shows get:

- **On the card** — a 2px progress bar (sky while in progress, emerald when
  complete) over a `−  3/5  +` stepper. Both buttons submit an _absolute_ target
  season, so a double-tap is idempotent.
- **In the detail modal** — a row of season pills; tapping season _n_ marks
  everything up to it as seen, and tapping the season you are already on steps
  back, so the row doubles as its own undo.
- **In the toolbar** — a _Watching_ lens (`seasonsSeen > 0 && !watched`), shown
  only when something is actually in progress.

## Files

| File                                            | Role                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| `src/lib/domain/progress.ts`                    | Pure logic: state, clamping, the invariant.     |
| `src/lib/domain/progress.spec.ts`               | Unit tests for all of the above.                |
| `src/lib/components/media/SeasonStepper.svelte` | The card control.                               |
| `src/lib/components/media/WatchlistCard.svelte` | Chooses stepper vs. plain watched toggle.       |
| `src/routes/+page.server.ts`                    | `setSeasons` / `toggleWatched` actions.         |
| `drizzle/0002_polite_gorgon.sql`                | The migration (plain `ADD COLUMN`, no rebuild). |
