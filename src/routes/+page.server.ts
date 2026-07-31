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
 * Built on the server so the browser receives a ready-to-use index instead of
 * rebuilding it on every render, and so a large list costs one small payload
 * rather than the whole watchlist a second time.
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
			totalSeasons: watchlistItem.totalSeasons
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
				totalSeasons: row.totalSeasons
			}
		])
	);
}

/** Trending is best-effort: a TMDB outage should degrade the page, not break it. */
async function loadTrending(): Promise<MediaResult[]> {
	try {
		return await getTrending();
	} catch (err) {
		console.error('Failed to load trending titles:', err);
		return [];
	}
}

// Discover needs `add` (and `remove`, so the detail modal can undo it), but the
// full set is re-exported: form actions resolve against the current route, and
// the modal is the same component on both pages.
export const actions: Actions = watchlistActions;
