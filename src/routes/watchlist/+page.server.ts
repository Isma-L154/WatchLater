import {
	refreshSeasonData,
	loadWatchlist,
	watchlistActions,
	type WatchlistRow
} from '$lib/server/watchlist';
import type { Actions, PageServerLoad } from './$types';

/**
 * My List: the saved titles and everything that can be done to them.
 *
 * Private by definition — with no session we return an empty list rather than
 * querying at all, and the page renders its signed-out state instead.
 */
export const load: PageServerLoad = async ({ locals }) => {
	// Typed rather than a bare `[]`: an untyped empty array widens the union the
	// page sees to `never[]`, which breaks inference on every helper downstream.
	if (!locals.user) return { items: [] as WatchlistRow[] };

	/**
	 * Resolve-on-read: shows saved before air dates were tracked have no aired
	 * count (which silently disables the tracker), and shows whose next season has
	 * since premiered are stale in a way the viewer would notice. See the function
	 * for why this lives on the read path.
	 */
	const items = await refreshSeasonData(await loadWatchlist(locals.user.id));
	return { items };
};

export const actions: Actions = watchlistActions;
