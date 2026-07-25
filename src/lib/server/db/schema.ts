import { integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

/**
 * A single movie or TV show saved to the user's "Watch Later" list.
 *
 * TMDB is the source of truth for media metadata, but we persist a lightweight,
 * display-ready snapshot here so the list renders instantly without an extra
 * round-trip to the TMDB API on every page load.
 */
export const watchlistItem = sqliteTable(
	'watchlist_item',
	{
		// Internal, app-generated identifier (stable regardless of TMDB changes).
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),

		// TMDB identity. The pair (tmdbId, mediaType) uniquely identifies a title,
		// preventing the same movie/show from being saved twice.
		tmdbId: integer('tmdb_id').notNull(),
		mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),

		// Cached metadata snapshot from TMDB.
		title: text('title').notNull(),
		posterPath: text('poster_path'),
		releaseDate: text('release_date'),
		overview: text('overview'),
		voteAverage: real('vote_average'),

		// User state.
		watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [unique('uq_tmdb_media').on(t.tmdbId, t.mediaType)]
);

export type WatchlistItem = typeof watchlistItem.$inferSelect;
export type NewWatchlistItem = typeof watchlistItem.$inferInsert;
