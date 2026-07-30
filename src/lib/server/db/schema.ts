import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

/**
 * A person who has signed in with Google.
 *
 * We deliberately store the bare minimum needed to render the account chip and
 * to recognise a returning visitor. No tokens from Google are persisted: the
 * OAuth access token is used once, during the callback, and then discarded.
 */
export const user = sqliteTable('user', {
	// Internal identifier, kept independent from Google's so the provider can be
	// swapped or extended later without rewriting every foreign key.
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),

	// Google's "sub" claim: stable forever, unlike the email address, which the
	// user can change. This is what we match on when someone signs in again.
	googleId: text('google_id').notNull().unique(),

	email: text('email').notNull(),
	name: text('name').notNull(),
	avatarUrl: text('avatar_url'),

	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * An active browser session.
 *
 * `id` is the SHA-256 hash of the opaque token handed to the browser — never the
 * token itself. A leaked database therefore cannot be replayed as a valid
 * cookie, the same reasoning behind hashing passwords.
 */
export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [index('idx_session_user').on(t.userId)]
);

/**
 * A single movie or TV show saved to a user's "Watch Later" list.
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

		// Owner of the entry. Every read and write is scoped by this column, which
		// is what keeps one person's list invisible to everybody else.
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),

		// TMDB identity. The triple (userId, tmdbId, mediaType) uniquely identifies
		// a title within a list, preventing the same show from being saved twice —
		// while still allowing two different users to save the same title.
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

		/**
		 * TV progress, tracked by season rather than by episode.
		 *
		 * A single counter is enough because series are watched in order, so
		 * progress is one-dimensional — no join table, no extra query on the list.
		 * `totalSeasons` is TMDB's count, snapshotted on save; it stays null for
		 * movies, which is what marks an entry as not season-trackable.
		 */
		seasonsSeen: integer('seasons_seen').notNull().default(0),
		totalSeasons: integer('total_seasons'),

		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [
		unique('uq_user_tmdb_media').on(t.userId, t.tmdbId, t.mediaType),
		index('idx_watchlist_user').on(t.userId)
	]
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type WatchlistItem = typeof watchlistItem.$inferSelect;
export type NewWatchlistItem = typeof watchlistItem.$inferInsert;
