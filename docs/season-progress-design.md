# Design proposal — Season progress for TV shows

> **Status: proposed, not implemented.** This document is the plan; no code in
> the repository implements it yet.

## Problem

`watched` is a boolean. For a film that is the whole truth. For a six-season
show it is a lie by omission: "halfway through season 3" collapses into either
_To Watch_ or _Watched_, and both are wrong. The list stops reflecting reality,
which is precisely when people stop trusting it.

## Goal

Track TV progress **at season granularity** — not episodes. Episode tracking
means a large amount of extra data, an extra TMDB request per season, and a lot
of checkbox tapping for a level of precision nobody asked for. Seasons are the
unit people actually remember ("I'm on season 3").

Derived requirement: when the last season is marked as seen, the show flips to
`watched` automatically. Progress and status must never disagree.

## Recommended model: seasons seen as a count

Two extra columns on `watchlist_item`:

| Column          | Type      | Meaning                                                          |
| --------------- | --------- | ---------------------------------------------------------------- |
| `seasons_seen`  | `integer` | How many seasons the user has finished. `0` for a new entry.     |
| `total_seasons` | `integer` | TMDB's `number_of_seasons`, cached at save time. Null for films. |

Both are nullable and default to `NULL` on movies, so nothing about the existing
movie flow changes.

### Why a count and not a set of season numbers

The obvious alternative is a `watchlist_season` join table (one row per watched
season), or a JSON array like `[1,2,4]`. That models "I watched seasons 1, 2 and
4 but skipped 3".

That is not how people watch television. Series are consumed in order, so
progress is genuinely one-dimensional, and a single integer captures it. The
count buys:

- **No extra table, no join, no N+1.** The list query stays exactly as it is.
- **A trivial progress calculation** — `seasonsSeen / totalSeasons`.
- **A cheap +1 interaction**, which is the action people actually perform.

The cost is that non-contiguous viewing cannot be represented. That is an
acceptable trade for a personal watchlist, and if it ever matters the count
migrates cleanly into a join table later (`seasons_seen = N` becomes rows
`1..N`) — nothing has to be thrown away.

### Deriving `watched`

`watched` stays as the single source of truth for the status filter, and the
server keeps it consistent on every progress change:

```
watched = totalSeasons != null && seasonsSeen >= totalSeasons
```

This must be enforced **server-side, in the action** — never only in the UI —
so the invariant survives a stale tab or a replayed form post. Two consequences
worth stating explicitly:

- Marking the final season complete flips the show to _Watched_. This is the
  behaviour that was asked for.
- Using "Unwatch" on a completed show resets `seasons_seen` to
  `totalSeasons - 1`. Sending it back to `0` would throw away real information,
  and leaving it at `totalSeasons` would contradict the flag.

### Keeping `total_seasons` fresh

A running show gains seasons after it is saved, which would leave a show stuck
at "5 / 5 · Watched" when season 6 airs. The snapshot is refreshed whenever the
detail modal is opened (it already fetches `number_of_seasons`): if TMDB reports
more seasons than we cached, update the row and re-derive `watched`. A show that
was complete correctly reappears in _To Watch_.

This is lazy and free — no cron job, no background sync, and the correction
happens exactly when the user is looking at the title.

## Interaction design

The current single button becomes a small stepper on TV cards only. Movie cards
are untouched.

```
┌──────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░  3/5   │   ← 2px progress bar + count
│  ─ │  Season 3  │  +      │   ← decrement / label / increment
└──────────────────────────┘
```

- **`+`** is the primary action, and the one-tap path for "I finished another
  season". **`−`** exists to undo a misclick.
- The progress bar is a 2px rule in the card's accent colour — enough to read
  the shape of the list at a glance without adding visual weight to every card.
- At `0/5` the label reads _Not started_; at `5/5` the card takes the existing
  _Watched_ treatment, so the completed state stays visually identical to a
  watched film.
- The detail modal gets the roomier control: a row of season pills (`S1 S2 S3…`)
  where tapping a season marks everything up to it as seen. This is the fast
  path for "I'm actually on season 4", without a stepper's four taps.
- **Shows with a single season** render the plain _Watched_ button. A stepper
  from 0 to 1 is pure friction.

The watchlist gains an _In Progress_ lens next to _Upcoming_
(`seasonsSeen > 0 && !watched`), which is the view most likely to answer "what
was I in the middle of?"

## Implementation sketch

1. **Schema** — add `seasons_seen` / `total_seasons`, generate the migration.
   Both nullable, so the migration is a plain `ADD COLUMN` with no table rebuild
   (unlike the accounts migration).
2. **`src/lib/progress.ts`** — a pure module beside `release.ts`:
   `getProgress(item)` → `{ seasonsSeen, totalSeasons, percent, label, state }`
   where state is `notStarted | inProgress | complete`. Unit-tested with no DB
   and no component involved, matching how `release.ts` and `watchlist.ts` are
   tested today.
3. **`setProgress` action** in `+page.server.ts` — takes an absolute target
   season (not a delta, so a double submit is idempotent), clamps it to
   `0..totalSeasons`, derives `watched`, and writes both in one statement.
   Scoped by `ownedRow(id, userId)` like every other mutation.
4. **`add` action** — persist `total_seasons` from the submitted form data for
   TV entries.
5. **UI** — a `SeasonStepper.svelte` component used by both the card and the
   modal; extend `applyWatchlistView` / `countByStatus` with the `inProgress`
   bucket.

## Open question for review

Should a show whose _available_ seasons are all watched, but which is still
running (TMDB `status: "Returning Series"`), display as _Watched_ or as
_Caught up_? "Caught up" is more accurate and pairs naturally with the
unreleased badge already built, but it introduces a fourth status. Worth
deciding before implementation starts, since it affects the filter tabs.
