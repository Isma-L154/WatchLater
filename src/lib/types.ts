/**
 * Shared, client-safe types. These contain no secrets and can be imported by
 * both server and browser code (unlike anything under `$lib/server`).
 */

export type MediaType = 'movie' | 'tv';

/**
 * The signed-in user, as exposed to the UI. Deliberately a narrow subset of the
 * database row — no timestamps, no provider ids, nothing the browser can't see.
 */
export interface SessionUser {
	id: string;
	name: string;
	email: string;
	avatarUrl: string | null;
}

/**
 * A normalized, media-type-agnostic representation of a movie or TV show.
 * This is the shape our own API returns, decoupling the UI from TMDB's raw
 * response format (which differs between movies and TV shows).
 */
export interface MediaResult {
	tmdbId: number;
	mediaType: MediaType;
	title: string;
	posterPath: string | null;
	releaseDate: string | null;
	overview: string | null;
	voteAverage: number | null;
}

/** A single cast member, as shown in the detail view. */
export interface CastMember {
	name: string;
	character: string;
	profilePath: string | null;
}

/** Rich details for a single title, backing the detail modal. */
export interface MediaDetails {
	tmdbId: number;
	mediaType: MediaType;
	title: string;
	overview: string | null;
	tagline: string | null;
	genres: string[];
	releaseDate: string | null;
	runtimeMinutes: number | null;
	/** TV only: number of seasons. */
	seasons: number | null;
	/**
	 * TMDB production status ("Released", "Post Production", "In Production",
	 * "Planned", "Returning Series"…). Used to explain *why* a title has no
	 * release date yet.
	 */
	productionStatus: string | null;
	voteAverage: number | null;
	backdropPath: string | null;
	posterPath: string | null;
	cast: CastMember[];
	/** YouTube video key for the trailer, if one exists. */
	trailerKey: string | null;
}
