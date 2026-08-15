import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { watchlistItem } from '../db/schema';

/**
 * Reading a list. No writes here, and nothing that reaches for TMDB.
 */

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

export type WatchlistRow = Awaited<ReturnType<typeof loadWatchlist>>[number];

/**
 * How many titles are saved, for the navigation badge.
 *
 * Archived rows are excluded — the badge counts the list you are working with,
 * and including things you deliberately tidied away would defeat the point of
 * tidying them away.
 */
export async function countWatchlist(userId: string): Promise<number> {
	const [row] = await getDb()
		.select({ total: sql<number>`count(*)` })
		.from(watchlistItem)
		.where(and(eq(watchlistItem.userId, userId), isNull(watchlistItem.archivedAt)));
	return Number(row?.total ?? 0);
}
