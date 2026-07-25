import { env } from '$env/dynamic/private';
import type { MediaResult, MediaType } from '$lib/types';

/**
 * Server-only TMDB client. This module lives under `$lib/server`, so SvelteKit
 * guarantees it can never be bundled into client code — the access token stays
 * on the server at all times.
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/** Raw TMDB item. Movies expose `title`/`release_date`; TV uses `name`/`first_air_date`. */
interface TmdbRawResult {
	id: number;
	media_type?: string;
	title?: string;
	name?: string;
	poster_path?: string | null;
	release_date?: string;
	first_air_date?: string;
	overview?: string;
	vote_average?: number;
}

interface TmdbPaginatedResponse {
	results: TmdbRawResult[];
}

/** Perform an authenticated GET against the TMDB API and parse the JSON body. */
async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
	const token = env.TMDB_ACCESS_TOKEN;
	if (!token) throw new Error('TMDB_ACCESS_TOKEN is not set');

	const url = new URL(`${TMDB_BASE_URL}${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`TMDB request failed with status ${response.status}`);
	}

	return response.json() as Promise<T>;
}

/** Convert a raw TMDB item into our normalized, media-type-agnostic shape. */
function normalize(raw: TmdbRawResult, mediaType: MediaType): MediaResult {
	return {
		tmdbId: raw.id,
		mediaType,
		title: raw.title ?? raw.name ?? 'Untitled',
		posterPath: raw.poster_path ?? null,
		releaseDate: raw.release_date ?? raw.first_air_date ?? null,
		overview: raw.overview ?? null,
		voteAverage: raw.vote_average ?? null
	};
}

/**
 * Search movies and TV shows in a single request via TMDB multi-search.
 * People and any unknown media types are filtered out.
 */
export async function searchMulti(query: string): Promise<MediaResult[]> {
	const data = await tmdbFetch<TmdbPaginatedResponse>('/search/multi', {
		query,
		include_adult: 'false',
		language: 'en-US',
		page: '1'
	});

	return data.results
		.filter(
			(raw): raw is TmdbRawResult & { media_type: MediaType } =>
				raw.media_type === 'movie' || raw.media_type === 'tv'
		)
		.map((raw) => normalize(raw, raw.media_type));
}

/**
 * Fetch this week's trending movies and TV shows. Used to populate the home
 * screen with content before the user has searched for anything.
 */
export async function getTrending(): Promise<MediaResult[]> {
	const data = await tmdbFetch<TmdbPaginatedResponse>('/trending/all/week', {
		language: 'en-US'
	});

	return data.results
		.filter(
			(raw): raw is TmdbRawResult & { media_type: MediaType } =>
				raw.media_type === 'movie' || raw.media_type === 'tv'
		)
		.map((raw) => normalize(raw, raw.media_type));
}
