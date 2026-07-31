import { backfillSeasonCounts, loadWatchlist, watchlistActions } from '$lib/server/watchlist';
import type { Actions, PageServerLoad } from './$types';

/**
 * My List: the saved titles and everything that can be done to them.
 *
 * Private by definition — with no session we return an empty list rather than
 * querying at all, and the page renders its signed-out state instead.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { items: [] };

	// Repair-on-read: shows saved before season tracking existed have no season
	// count, which silently disables the tracker for them. See the function for
	// why this lives on the read path.
	const items = await backfillSeasonCounts(await loadWatchlist(locals.user.id));
	return { items };
};

export const actions: Actions = watchlistActions;
