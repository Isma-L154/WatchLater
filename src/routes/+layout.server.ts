import { isGoogleAuthConfigured } from '$lib/server/oauth';
import { countWatchlist } from '$lib/server/watchlist';
import type { LayoutServerLoad } from './$types';

/**
 * Shell-level data: who is signed in, whether sign-in is even possible on this
 * deployment, and how many titles are saved.
 *
 * The count belongs here rather than on a page because the navigation badge is
 * part of the shell — it has to be right on Discover too, where the list itself
 * is never loaded. It is a single indexed `count(*)`, not a second fetch of the
 * list.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		authAvailable: isGoogleAuthConfigured(),
		watchlistCount: locals.user ? await countWatchlist(locals.user.id) : 0
	};
};
