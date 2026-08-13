import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import {
	archiveExpired,
	loadWatchlist,
	refreshSeasonData,
	watchlistActions,
	type WatchlistRow
} from '$lib/server/watchlist';
import { normalizeArchiveWindow } from '$lib/domain/archive';
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
	if (!locals.user) return { items: [] as WatchlistRow[], autoArchiveDays: null };

	const [row] = await getDb()
		.select({ autoArchiveDays: user.autoArchiveDays })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);
	const autoArchiveDays = normalizeArchiveWindow(row?.autoArchiveDays);

	/**
	 * Two pieces of upkeep, both on the read path so there is no scheduled job to
	 * own. Season data is resolved first because archiving reads it: a show that
	 * just gained a season must stop being eligible *before* the archive rule
	 * looks at it, or being caught up would tidy away the very title whose next
	 * season is now airing.
	 */
	const items = await archiveExpired(
		await refreshSeasonData(await loadWatchlist(locals.user.id)),
		autoArchiveDays
	);

	return { items, autoArchiveDays };
};

export const actions: Actions = watchlistActions;
