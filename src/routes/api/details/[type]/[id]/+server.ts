import { error, json } from '@sveltejs/kit';
import { getDetails } from '$lib/server/tmdb';
import type { RequestHandler } from './$types';

/**
 * Details change rarely and are identical for every visitor, so they are safe to
 * cache at the edge. This keeps the shared TMDB token from being rate-limited by
 * anyone looping the endpoint, and makes a re-opened modal instant.
 */
const CACHE_CONTROL = 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400';

/**
 * GET /api/details/<movie|tv>/<id>
 *
 * Server-side proxy for a single title's full details (genres, cast, trailer).
 * Keeps the TMDB access token on the server.
 */
export const GET: RequestHandler = async ({ params }) => {
	const { type, id } = params;
	const tmdbId = Number(id);

	if ((type !== 'movie' && type !== 'tv') || !Number.isInteger(tmdbId) || tmdbId <= 0) {
		error(400, 'Invalid media type or id.');
	}

	try {
		const details = await getDetails(type, tmdbId);
		return json(details, { headers: { 'cache-control': CACHE_CONTROL } });
	} catch (err) {
		console.error('TMDB details failed:', err);
		error(502, 'Failed to load title details. Please try again.');
	}
};
