import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { watchlistItem } from '$lib/server/db/schema';
import { getTrending } from '$lib/server/tmdb';
import { watchlistActions } from '$lib/server/watchlist';
import type { MediaResult, SavedEntry } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/**
 * Discover: what to watch next.
 *
 * Trending is public — browsing works signed out — but the saved-state overlay
 * is not. We fetch only the columns needed to answer "is this already on my
 * list, and how far in am I?", never the full rows: the poster, overview and
 * rating are already in the TMDB payload this page renders.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [saved, trending] = await Promise.all([loadSavedIndex(locals.user?.id), loadTrending()]);
	return { saved, trending };
};

/**
 * The list as a lookup keyed by `"<tmdbId>:<mediaType>"`.
 *
 * Built on the server so the browser receives a ready-to-use index rather than
 * rebuilding it on every render. Every saved title has to be in it — search runs
 * client-side, so there is no way to know up front which ids a visitor will need
 * an answer for.
 *
 * That means the payload grows with the list, so it carries the six columns the
 * badge and the detail sheet actually read and nothing else: no overview, no
 * poster path, no timestamps. At a realistic couple of hundred titles that is a
 * few KB.
 */
async function loadSavedIndex(userId: string | undefined): Promise<Record<string, SavedEntry>> {
	if (!userId) return {};

	const rows = await getDb()
		.select({
			id: watchlistItem.id,
			tmdbId: watchlistItem.tmdbId,
			mediaType: watchlistItem.mediaType,
			watched: watchlistItem.watched,
			seasonsSeen: watchlistItem.seasonsSeen,
			totalSeasons: watchlistItem.totalSeasons,
			airedSeasons: watchlistItem.airedSeasons
		})
		.from(watchlistItem)
		.where(eq(watchlistItem.userId, userId));

	return Object.fromEntries(
		rows.map((row) => [
			`${row.tmdbId}:${row.mediaType}`,
			{
				id: row.id,
				watched: row.watched,
				seasonsSeen: row.seasonsSeen,
				totalSeasons: row.totalSeasons,
				airedSeasons: row.airedSeasons
			}
		])
	);
}

/**
 * The first page of trending, rendered with the document.
 *
 * Further pages are fetched on demand from `/api/trending` when the visitor asks
 * for them, so the initial paint never pays for titles below the fold.
 *
 * Best-effort: a TMDB outage should degrade the page, not break it.
 */
async function loadTrending(): Promise<{ items: MediaResult[]; hasMore: boolean }> {
	try {
		const { results, hasMore } = await getTrending(1);
		return { items: results, hasMore };
	} catch (err) {
		console.error('Failed to load trending titles:', err);
		return { items: [], hasMore: false };
	}
}

// Discover needs `add` (and `remove`, so the detail modal can undo it), but the
// full set is re-exported: form actions resolve against the current route, and
// the modal is the same component on both pages.
export const actions: Actions = watchlistActions;
