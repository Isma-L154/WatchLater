import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './db';
import { watchlistItem } from './db/schema';
import { getDetails } from './tmdb';
import { clampSeasons, deriveWatched, normalizeTotalSeasons } from '$lib/domain/progress';
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
 * How many legacy rows one page load may repair (see `backfillSeasonCounts`).
 *
 * Each repair costs a TMDB request, and they run in parallel, so this is the cap
 * on how long a load can be held up by work the visitor never asked for. Lists
 * converge over a couple of visits, which is fine for a one-off migration.
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

/** The signed-in user's list, newest first. */
export async function loadWatchlist(userId: string) {
	return getDb()
		.select()
		.from(watchlistItem)
		.where(eq(watchlistItem.userId, userId))
		.orderBy(desc(watchlistItem.addedAt));
}

/** How many titles are saved, for the navigation badge. */
export async function countWatchlist(userId: string): Promise<number> {
	const [row] = await getDb()
		.select({ total: sql<number>`count(*)` })
		.from(watchlistItem)
		.where(eq(watchlistItem.userId, userId));
	return Number(row?.total ?? 0);
}

type WatchlistRow = Awaited<ReturnType<typeof loadWatchlist>>[number];

/**
 * Fill in `totalSeasons` for shows that were saved before season tracking
 * existed, and return the list with those rows patched.
 *
 * This is the difference between the feature working and the feature being
 * invisible: a null season count is what marks an entry as *not* trackable, so
 * every show added before the columns existed silently renders the plain
 * watched toggle — the tracker never appears, and the feature looks unbuilt.
 *
 * Repairing on read (rather than in a migration) means it also covers entries
 * whose save-time TMDB lookup failed, and it needs no deploy-time backfill job.
 *
 * The two ways a lookup can come back empty are deliberately *not* treated the
 * same. A network or API failure leaves the row null so the next visit retries;
 * a successful response that simply has no usable season count writes the
 * `NO_SEASON_DATA` sentinel, which stops the repair. Without that distinction a
 * single title TMDB has no seasons for would re-trigger the full batch of
 * lookups on every single page load, forever.
 */
export async function backfillSeasonCounts(items: WatchlistRow[]): Promise<WatchlistRow[]> {
	const pending = items
		.filter((item) => item.mediaType === 'tv' && item.totalSeasons === null)
		.slice(0, BACKFILL_BATCH_SIZE);
	if (pending.length === 0) return items;

	const resolved = await Promise.all(
		pending.map(async (item) => ({
			id: item.id,
			totalSeasons: await resolveSeasonCount(item.tmdbId)
		}))
	);

	// Group by value so a batch of shows costs one UPDATE per distinct season
	// count (usually two or three) instead of one per row.
	const byCount = new Map<number, string[]>();
	for (const { id, totalSeasons } of resolved) {
		if (totalSeasons === null) continue;
		const ids = byCount.get(totalSeasons) ?? [];
		ids.push(id);
		byCount.set(totalSeasons, ids);
	}
	if (byCount.size === 0) return items;

	const db = getDb();
	await Promise.all(
		[...byCount].map(([totalSeasons, ids]) =>
			db.update(watchlistItem).set({ totalSeasons }).where(inArray(watchlistItem.id, ids))
		)
	);

	// Patch the in-memory copy too, so the tracker shows up on this render rather
	// than only after the visitor happens to reload.
	const patched = new Map(resolved.map(({ id, totalSeasons }) => [id, totalSeasons]));
	return items.map((item) =>
		patched.has(item.id) ? { ...item, totalSeasons: patched.get(item.id)! } : item
	);
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
				totalSeasons: await fetchTotalSeasons(mediaType, tmdbId)
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
			.select({ watched: watchlistItem.watched, totalSeasons: watchlistItem.totalSeasons })
			.from(watchlistItem)
			.where(ownedRow(id, locals.user.id))
			.limit(1);
		if (!item) return fail(404, { message: 'Item not found.' });

		const watched = !item.watched;
		const total = item.totalSeasons;
		await db
			.update(watchlistItem)
			.set({
				watched,
				...(total ? { seasonsSeen: watched ? total : Math.max(total - 1, 0) } : {})
			})
			.where(ownedRow(id, locals.user.id));

		return { toggled: true, watched };
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
				totalSeasons: watchlistItem.totalSeasons
			})
			.from(watchlistItem)
			.where(ownedRow(id, locals.user.id))
			.limit(1);

		if (!item) return fail(404, { message: 'Item not found.' });
		if (item.mediaType !== 'tv') return fail(400, { message: 'Only TV shows track seasons.' });

		/**
		 * Ask TMDB for the season count in exactly two situations: when we have
		 * never stored one (an entry saved before season tracking existed), and
		 * when this change would complete the show — the one moment where being
		 * wrong is visible, because a still-running series that has since gained a
		 * season must not be marked as finished.
		 *
		 * Every other tap is a pure database write with no external call.
		 */
		const stored = item.totalSeasons;
		const completing = stored !== null && requested >= stored;
		const totalSeasons =
			stored === null || completing
				? ((await fetchTotalSeasons('tv', item.tmdbId)) ?? stored)
				: stored;

		if (!totalSeasons) return fail(400, { message: 'No season data available for this title.' });

		const seasonsSeen = clampSeasons(requested, totalSeasons);
		await db
			.update(watchlistItem)
			.set({ seasonsSeen, totalSeasons, watched: deriveWatched(seasonsSeen, totalSeasons) })
			.where(ownedRow(id, locals.user.id));

		return { seasonsSeen, totalSeasons };
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
async function fetchTotalSeasons(mediaType: MediaType, tmdbId: number): Promise<number | null> {
	if (mediaType !== 'tv') return null;
	const resolved = await resolveSeasonCount(tmdbId);
	// On the write path a sentinel and a failure are the same thing — both mean
	// "no tracking for now" — so it is stored as null and re-checked on read.
	return resolved === null || resolved === NO_SEASON_DATA ? null : resolved;
}

/**
 * Ask TMDB for a show's season count.
 *
 * Returns the count, `NO_SEASON_DATA` when TMDB answered but had nothing usable,
 * or null when the request itself failed — a distinction the backfill relies on
 * to decide between "record this and stop" and "try again later".
 */
async function resolveSeasonCount(tmdbId: number): Promise<number | null> {
	try {
		const details = await getDetails('tv', tmdbId);
		return normalizeTotalSeasons(details.seasons) ?? NO_SEASON_DATA;
	} catch (err) {
		console.error('Failed to read season count for tv/%d:', tmdbId, err);
		return null;
	}
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
