import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from './db';
import { user, watchlistItem } from './db/schema';
import { getDetails } from './tmdb';
import {
	clampSeasons,
	deriveWatched,
	normalizeAiredSeasons,
	normalizeTotalSeasons
} from '$lib/domain/progress';
import { isDueForArchive, normalizeArchiveWindow, type ArchiveWindow } from '$lib/domain/archive';
import { resolveEpisodeTarget } from '$lib/domain/episodes';
import type { MediaType } from '$lib/types';
import type { Actions } from '@sveltejs/kit';

/**
 * Everything that reads or writes a watchlist lives here.
 *
 * Both surfaces need it: Discover saves titles and My List edits them, and a
 * SvelteKit form action only exists on the route it is declared in. Rather than
 * keeping two drifting copies, each `+page.server.ts` re-exports this one set.
 */

/** Returned by every action when the caller has no session. */
const UNAUTHENTICATED = { message: 'Please sign in first.' };

/**
 * Ceiling on how many titles one account may store.
 *
 * Far above any realistic watchlist, but it stops a signed-in account from
 * growing the shared database without bound — the free Turso tier is a finite
 * resource shared by every user of the deployment.
 */
const MAX_ITEMS_PER_USER = 5000;

/**
 * How many rows one page load may re-resolve (see `refreshSeasonData`).
 *
 * Each repair costs a TMDB request, and they run in parallel, so this is the cap
 * on how long a load can be held up by work the visitor never asked for. Lists
 * converge over a couple of visits, which is fine for background upkeep.
 */
const BACKFILL_BATCH_SIZE = 8;

/**
 * Written to `totalSeasons` when TMDB answered but had no usable season count.
 *
 * Zero is a safe marker because a real count is always at least 1 (see
 * `normalizeTotalSeasons`), and it is inert everywhere downstream: `isTrackable`
 * needs more than one season, so the entry simply keeps the plain watched
 * toggle. Its only job is to say "already checked, don't ask again".
 */
const NO_SEASON_DATA = 0;

/**
 * The signed-in user's list, newest first.
 *
 * Archived rows are included: they are a view the UI can switch to, not deleted
 * data, and splitting them into a second query would mean two round-trips for
 * one screen. Every default view filters them out — see `domain/watchlist`.
 */
export async function loadWatchlist(userId: string) {
	return getDb()
		.select()
		.from(watchlistItem)
		.where(eq(watchlistItem.userId, userId))
		.orderBy(desc(watchlistItem.addedAt));
}

/**
 * How many titles are saved, for the navigation badge.
 *
 * Archived rows are excluded — the badge is a count of the list you are working
 * with, and including things you deliberately tidied away would defeat the
 * point of tidying them away.
 */
export async function countWatchlist(userId: string): Promise<number> {
	const [row] = await getDb()
		.select({ total: sql<number>`count(*)` })
		.from(watchlistItem)
		.where(and(eq(watchlistItem.userId, userId), isNull(watchlistItem.archivedAt)));
	return Number(row?.total ?? 0);
}

/**
 * The `watchedAt` value to store alongside a new watched state.
 *
 * Preserves an existing timestamp when something is already watched, so
 * re-deriving the flag — which the season refresh does on every visit — cannot
 * silently push the archive countdown back to the start.
 */
function watchedStamp(nextWatched: boolean, current: Date | null, now = new Date()): Date | null {
	if (!nextWatched) return null;
	return current ?? now;
}

/**
 * Archive watched entries whose window has elapsed, returning the patched list.
 *
 * Runs on read, like the season refresh, so there is no scheduled job to operate
 * — and no way for the rule to fire against a list nobody is looking at. The
 * eligibility rules, including the one that spares any show with a season still
 * to come, live in `domain/archive` where they are unit-tested.
 */
export async function archiveExpired(
	items: WatchlistRow[],
	window: ArchiveWindow | null
): Promise<WatchlistRow[]> {
	if (window === null) return items;

	const now = new Date();
	const due = items.filter((item) => isDueForArchive(item, window, now));
	if (due.length === 0) return items;

	const ids = due.map((item) => item.id);
	await getDb()
		.update(watchlistItem)
		.set({ archivedAt: now })
		.where(inArray(watchlistItem.id, ids));

	const archived = new Set(ids);
	return items.map((item) => (archived.has(item.id) ? { ...item, archivedAt: now } : item));
}

export type WatchlistRow = Awaited<ReturnType<typeof loadWatchlist>>[number];

/** Today as `YYYY-MM-DD` in UTC, matching how TMDB writes air dates. */
function todayIso(now: Date = new Date()): string {
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
		.toISOString()
		.slice(0, 10);
}

/**
 * Which rows need a trip to TMDB, and why.
 *
 * Two cases, both resolved the same way. A show with no `airedSeasons` has never
 * been resolved — either it predates season tracking or its save-time lookup
 * failed. A show whose next season's air date has passed is stale in the way
 * that matters most: that season is watchable now, and until we notice, the
 * viewer is told they are still caught up.
 */
function needsSeasonRefresh(item: WatchlistRow, today: string): boolean {
	if (item.mediaType !== 'tv') return false;
	if (item.airedSeasons === null) return true;
	return item.nextSeasonAirDate !== null && item.nextSeasonAirDate <= today;
}

/**
 * Resolve season data for shows that need it, and return the list with those
 * rows patched.
 *
 * Doing this on read rather than in a migration or a cron job is what keeps the
 * feature self-maintaining: it covers entries saved before the columns existed,
 * entries whose save-time lookup failed, and — the ongoing case — shows that
 * have since premiered a new season. When that last one resolves, `airedSeasons`
 * rises above `seasonsSeen`, `deriveWatched` turns false, and the show reappears
 * in "To watch" without anybody doing anything.
 *
 * The two ways a lookup can come back empty are deliberately *not* treated the
 * same. A network or API failure leaves the row untouched so the next visit
 * retries; a successful response that simply has no usable season list writes
 * the `NO_SEASON_DATA` sentinel, which stops the repair. Without that
 * distinction a single title TMDB has no seasons for would re-trigger the full
 * batch of lookups on every page load, forever.
 */
export async function refreshSeasonData(items: WatchlistRow[]): Promise<WatchlistRow[]> {
	const today = todayIso();
	const pending = items
		.filter((item) => needsSeasonRefresh(item, today))
		.slice(0, BACKFILL_BATCH_SIZE);
	if (pending.length === 0) return items;

	const resolved = await Promise.all(
		pending.map(async (item) => ({ id: item.id, info: await resolveSeasonInfo(item.tmdbId) }))
	);

	const db = getDb();
	const patches = new Map<string, Partial<WatchlistRow>>();

	await Promise.all(
		resolved.map(async ({ id, info }) => {
			if (!info) return;

			const source = items.find((item) => item.id === id);
			if (!source) return;

			/**
			 * Progress is re-derived here rather than left alone, because a newly
			 * aired season changes the answer: someone marked "watched" at 3 of 3
			 * is no longer watched once a fourth is out. The seen count itself is
			 * never touched — they did watch those seasons.
			 */
			const seasonsSeen = clampSeasons(source.seasonsSeen, info.airedSeasons);
			const watched = deriveWatched(seasonsSeen, info.airedSeasons);
			const patch = {
				totalSeasons: info.totalSeasons,
				airedSeasons: info.airedSeasons,
				nextSeasonNumber: info.nextSeasonNumber,
				nextSeasonAirDate: info.nextSeasonAirDate,
				seasonsSeen,
				/**
				 * The bookmark only survives if the season counter did. A downward
				 * clamp means TMDB corrected the season list, so "six episodes into
				 * the next one" now points at a season that no longer exists.
				 */
				episodesIntoSeason: seasonsSeen === source.seasonsSeen ? source.episodesIntoSeason : 0,
				watched,
				watchedAt: watchedStamp(watched, source.watchedAt)
			};

			patches.set(id, patch);
			await db.update(watchlistItem).set(patch).where(eq(watchlistItem.id, id));
		})
	);

	if (patches.size === 0) return items;

	// Patch the in-memory copy too, so the change shows up on this render rather
	// than only after the visitor happens to reload.
	return items.map((item) => (patches.has(item.id) ? { ...item, ...patches.get(item.id) } : item));
}

export const watchlistActions = {
	/** Save a movie/TV show. Duplicates are silently ignored via the unique index. */
	add: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const tmdbId = toPositiveInt(form.get('tmdbId'));
		const mediaType = String(form.get('mediaType') ?? '') as MediaType;
		const title = clip(form.get('title'), 300);

		if (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv') || !title) {
			return fail(400, { message: 'Invalid item data.' });
		}

		const db = getDb();

		/**
		 * One query answers both guards: how full the list is, and whether this
		 * title is already on it. Checking for the duplicate up front also avoids
		 * spending a TMDB request on a save that would be discarded anyway.
		 */
		const [stats] = await db
			.select({
				total: sql<number>`count(*)`,
				duplicates: sql<number>`sum(case when ${watchlistItem.tmdbId} = ${tmdbId} and ${watchlistItem.mediaType} = ${mediaType} then 1 else 0 end)`
			})
			.from(watchlistItem)
			.where(eq(watchlistItem.userId, locals.user.id));

		if (Number(stats?.duplicates ?? 0) > 0) return { added: false };
		if (Number(stats?.total ?? 0) >= MAX_ITEMS_PER_USER) {
			return fail(400, { message: 'Your watchlist is full.' });
		}

		await db
			.insert(watchlistItem)
			.values({
				userId: locals.user.id,
				tmdbId,
				mediaType,
				title,
				posterPath: clip(form.get('posterPath'), 200),
				releaseDate: clip(form.get('releaseDate'), 10),
				overview: clip(form.get('overview'), 2000),
				voteAverage: toRating(form.get('voteAverage')),
				...(await seasonInfoForSave(mediaType, tmdbId))
			})
			// Backstop for two concurrent saves of the same title: the unique index
			// is the real guarantee, the check above is just the cheap fast path.
			.onConflictDoNothing();

		return { added: true };
	},

	/** Remove an item from the list. */
	remove: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = clip(form.get('id'), 64);
		if (!id) return fail(400, { message: 'Missing id.' });

		await getDb().delete(watchlistItem).where(ownedRow(id, locals.user.id));
		return { removed: true };
	},

	/**
	 * Toggle the watched/unwatched state of an item.
	 *
	 * For a season-tracked show this also moves the counter to the matching end,
	 * so progress and status can never contradict each other. Stepping back from
	 * "complete" lands on the previous season rather than zero: the user has
	 * still seen those seasons, and discarding that would be data loss.
	 */
	toggleWatched: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = clip(form.get('id'), 64);
		if (!id) return fail(400, { message: 'Missing id.' });

		const db = getDb();
		const [item] = await db
			.select({
				watched: watchlistItem.watched,
				watchedAt: watchlistItem.watchedAt,
				totalSeasons: watchlistItem.totalSeasons,
				airedSeasons: watchlistItem.airedSeasons
			})
			.from(watchlistItem)
			.where(ownedRow(id, locals.user.id))
			.limit(1);
		if (!item) return fail(404, { message: 'Item not found.' });

		const watched = !item.watched;
		// Only aired seasons can be ticked off, so "mark watched" lands on the last
		// broadcast season rather than on an announced one.
		const ceiling = item.airedSeasons ?? item.totalSeasons;
		await db
			.update(watchlistItem)
			.set({
				watched,
				watchedAt: watchedStamp(watched, item.watchedAt),
				/**
				 * The toggle speaks in whole seasons, so it lands the position on a
				 * season boundary and the bookmark goes with it. Left behind, it would
				 * claim episodes of a season the toggle just moved past — and a show
				 * marked watched would still be advertising a next episode.
				 */
				episodesIntoSeason: 0,
				...(ceiling ? { seasonsSeen: watched ? ceiling : Math.max(ceiling - 1, 0) } : {})
			})
			.where(ownedRow(id, locals.user.id));

		return { toggled: true, watched };
	},

	/**
	 * Choose how long a watched title stays before it is archived, or turn the
	 * whole thing off.
	 *
	 * Anything that is not one of the offered windows is stored as null — "off" —
	 * rather than rejected, because the failure mode of a bad value here is
	 * someone's list being tidied on a schedule they never picked.
	 */
	setAutoArchive: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const days = normalizeArchiveWindow(form.get('days'));

		await getDb().update(user).set({ autoArchiveDays: days }).where(eq(user.id, locals.user.id));
		return { autoArchiveDays: days };
	},

	/** Bring an archived title back onto the list. */
	restore: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = clip(form.get('id'), 64);
		if (!id) return fail(400, { message: 'Missing id.' });

		/**
		 * The watched clock restarts on restore. Otherwise a title pulled back
		 * would still be weeks overdue and get archived again on the very next
		 * page load — which reads as the restore having silently failed.
		 */
		await getDb()
			.update(watchlistItem)
			.set({ archivedAt: null, watchedAt: new Date() })
			.where(ownedRow(id, locals.user.id));

		return { restored: true };
	},

	/** Reset the archive countdown for a title without changing anything else. */
	keepLonger: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = clip(form.get('id'), 64);
		if (!id) return fail(400, { message: 'Missing id.' });

		await getDb()
			.update(watchlistItem)
			.set({ watchedAt: new Date() })
			.where(ownedRow(id, locals.user.id));

		return { kept: true };
	},

	/**
	 * Move the bookmark to "watched through season S, episode E".
	 *
	 * Absolute like `setSeasons`, so a double tap or a replayed request is
	 * idempotent. The season is always re-read from TMDB: episode counts and air
	 * dates are exactly the bounds the request is validated against, and a client
	 * does not get to define its own ceiling.
	 */
	setEpisode: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = clip(form.get('id'), 64);
		const season = Number(form.get('season'));
		const episode = Number(form.get('episode'));

		if (!id) return fail(400, { message: 'Missing id.' });
		if (!Number.isInteger(season) || season < 1) return fail(400, { message: 'Invalid season.' });

		const db = getDb();
		const [item] = await db
			.select({
				tmdbId: watchlistItem.tmdbId,
				mediaType: watchlistItem.mediaType,
				watchedAt: watchlistItem.watchedAt,
				airedSeasons: watchlistItem.airedSeasons,
				totalSeasons: watchlistItem.totalSeasons
			})
			.from(watchlistItem)
			.where(ownedRow(id, locals.user.id))
			.limit(1);

		if (!item) return fail(404, { message: 'Item not found.' });
		if (item.mediaType !== 'tv') return fail(400, { message: 'Only TV shows track episodes.' });

		const details = await safeDetails(item.tmdbId, season);
		if (!details) return fail(502, { message: 'Could not reach TMDB. Please try again.' });

		const airedSeasons = normalizeAiredSeasons(details.airedSeasons) ?? item.airedSeasons;
		if (!airedSeasons || season > airedSeasons) {
			return fail(400, { message: 'That season has not aired yet.' });
		}

		const target = resolveEpisodeTarget(
			season,
			episode,
			details.episodeCounts[season] ?? null,
			details.season?.airedCount ?? null
		);

		const watched =
			deriveWatched(target.seasonsSeen, airedSeasons) && target.episodesIntoSeason === 0;

		await db
			.update(watchlistItem)
			.set({
				seasonsSeen: target.seasonsSeen,
				episodesIntoSeason: target.episodesIntoSeason,
				airedSeasons,
				totalSeasons: normalizeTotalSeasons(details.seasons) ?? item.totalSeasons,
				nextSeasonNumber: details.upcomingSeason?.number ?? null,
				nextSeasonAirDate: details.upcomingSeason?.airDate ?? null,
				watched,
				watchedAt: watchedStamp(watched, item.watchedAt)
			})
			.where(ownedRow(id, locals.user.id));

		return {
			seasonsSeen: target.seasonsSeen,
			episodesIntoSeason: target.episodesIntoSeason,
			airedSeasons,
			season,
			episodesWatched: target.episodesIntoSeason,
			seasonComplete: target.seasonsSeen >= season
		};
	},

	/**
	 * Set how many seasons of a show have been watched.
	 *
	 * The target is absolute rather than a delta, so a double submit or a replayed
	 * request is idempotent. The season *count* is always resolved server-side —
	 * the client sends only "how far I got", never the bounds it is measured
	 * against.
	 */
	setSeasons: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = clip(form.get('id'), 64);
		const requested = Number(form.get('seasons'));
		if (!id) return fail(400, { message: 'Missing id.' });

		const db = getDb();
		const [item] = await db
			.select({
				tmdbId: watchlistItem.tmdbId,
				mediaType: watchlistItem.mediaType,
				watchedAt: watchlistItem.watchedAt,
				totalSeasons: watchlistItem.totalSeasons,
				airedSeasons: watchlistItem.airedSeasons
			})
			.from(watchlistItem)
			.where(ownedRow(id, locals.user.id))
			.limit(1);

		if (!item) return fail(404, { message: 'Item not found.' });
		if (item.mediaType !== 'tv') return fail(400, { message: 'Only TV shows track seasons.' });

		/**
		 * Re-read from TMDB in exactly two situations: when nothing is stored (an
		 * entry that predates air-date tracking), and when this change would use up
		 * every aired season — the one moment where being stale is visible, because
		 * a season may have premiered since we last looked.
		 *
		 * Every other tap is a pure database write with no external call.
		 */
		const stored = item.airedSeasons;
		const shouldRefresh = stored === null || requested >= stored;
		const fresh = shouldRefresh ? await resolveSeasonInfo(item.tmdbId) : null;

		const airedSeasons = fresh?.airedSeasons ?? stored;
		if (!airedSeasons) return fail(400, { message: 'No season data available for this title.' });

		/**
		 * The clamp is the guard that matters: it is measured against *aired*
		 * seasons, so a request to tick off an announced season silently lands on
		 * the last one that actually exists instead of being honoured.
		 */
		const seasonsSeen = clampSeasons(requested, airedSeasons);
		const watched = deriveWatched(seasonsSeen, airedSeasons);

		// Only a fresh lookup may touch the descriptive columns — writing them from
		// a skipped one would blank the row with nulls it never learned.
		await db
			.update(watchlistItem)
			.set({
				seasonsSeen,
				// Same reasoning as the toggle: this control names a season, so the
				// stored position is that season's boundary and nothing finer.
				episodesIntoSeason: 0,
				airedSeasons,
				watched,
				watchedAt: watchedStamp(watched, item.watchedAt),
				...(fresh && {
					totalSeasons: fresh.totalSeasons,
					nextSeasonNumber: fresh.nextSeasonNumber,
					nextSeasonAirDate: fresh.nextSeasonAirDate
				})
			})
			.where(ownedRow(id, locals.user.id));

		return {
			seasonsSeen,
			airedSeasons,
			totalSeasons: fresh?.totalSeasons ?? item.totalSeasons
		};
	}
} satisfies Actions;

/**
 * Look up a show's season count so it is stored from TMDB, not from the browser.
 *
 * Search and trending responses don't carry it, so this costs one extra request
 * — but only for TV, and only once per title in a list's lifetime. A failure is
 * non-fatal: the entry is simply saved without season tracking, which the next
 * page load will try to repair.
 */
/** Everything the row stores about a show's seasons. */
interface SeasonInfo {
	totalSeasons: number | null;
	airedSeasons: number | null;
	nextSeasonNumber: number | null;
	nextSeasonAirDate: string | null;
}

/** No season data at all — nothing to track, nothing to come. */
const NO_SEASONS: SeasonInfo = {
	totalSeasons: NO_SEASON_DATA,
	airedSeasons: NO_SEASON_DATA,
	nextSeasonNumber: null,
	nextSeasonAirDate: null
};

/**
 * Ask TMDB how many of a show's seasons exist, how many have aired, and when the
 * next one lands.
 *
 * Returns null when the request itself failed, versus a `NO_SEASON_DATA`-filled
 * record when TMDB answered but had nothing usable — the distinction the refresh
 * relies on to choose between "try again later" and "record this and stop".
 */
/** Details for a show, or null when TMDB could not be reached. */
async function safeDetails(tmdbId: number, season: number | null = null) {
	try {
		return await getDetails('tv', tmdbId, 'US', season);
	} catch (err) {
		console.error('Failed to read details for tv/%d:', tmdbId, err);
		return null;
	}
}

async function resolveSeasonInfo(tmdbId: number): Promise<SeasonInfo | null> {
	try {
		const details = await getDetails('tv', tmdbId);
		const totalSeasons = normalizeTotalSeasons(details.seasons);
		const airedSeasons = normalizeAiredSeasons(details.airedSeasons);
		if (totalSeasons === null || airedSeasons === null) return NO_SEASONS;

		return {
			totalSeasons,
			airedSeasons,
			nextSeasonNumber: details.upcomingSeason?.number ?? null,
			nextSeasonAirDate: details.upcomingSeason?.airDate ?? null
		};
	} catch (err) {
		console.error('Failed to read season data for tv/%d:', tmdbId, err);
		return null;
	}
}

/**
 * Season data for a title being saved. Movies have none, and a failed lookup is
 * non-fatal: the entry is stored without it and the read path repairs it.
 */
async function seasonInfoForSave(mediaType: MediaType, tmdbId: number): Promise<SeasonInfo> {
	if (mediaType !== 'tv') {
		return {
			totalSeasons: null,
			airedSeasons: null,
			nextSeasonNumber: null,
			nextSeasonAirDate: null
		};
	}
	return (
		(await resolveSeasonInfo(tmdbId)) ?? {
			totalSeasons: null,
			airedSeasons: null,
			nextSeasonNumber: null,
			nextSeasonAirDate: null
		}
	);
}

/**
 * Match a row by id *and* owner.
 *
 * The id alone would be enough to find the row, which is exactly the problem:
 * item ids travel through the browser as form fields, so every mutation is
 * scoped by the session's user id as well. Someone else's id simply matches
 * nothing.
 */
function ownedRow(id: string, userId: string) {
	return and(eq(watchlistItem.id, id), eq(watchlistItem.userId, userId));
}

/**
 * Normalize a form value to a trimmed string, or null when empty.
 *
 * The length cap matters: these fields are attacker-controlled (the form is just
 * HTTP), and without a bound a single request could write megabytes into the
 * row. The limits are generous multiples of what TMDB actually returns.
 */
function clip(value: FormDataEntryValue | null, maxLength: number): string | null {
	const text = value == null ? '' : String(value).trim();
	return text === '' ? null : text.slice(0, maxLength);
}

function toPositiveInt(value: FormDataEntryValue | null): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** TMDB ratings are 0–10; anything else is discarded rather than stored. */
function toRating(value: FormDataEntryValue | null): number | null {
	const parsed = Number(value);
	if (value == null || String(value).trim() === '' || !Number.isFinite(parsed)) return null;
	return parsed >= 0 && parsed <= 10 ? parsed : null;
}
