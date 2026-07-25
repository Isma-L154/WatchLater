import { error, json } from '@sveltejs/kit';
import { getDetails } from '$lib/server/tmdb';
import type { RequestHandler } from './$types';

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
		throw error(400, 'Invalid media type or id.');
	}

	try {
		const details = await getDetails(type, tmdbId);
		return json(details);
	} catch (err) {
		console.error('TMDB details failed:', err);
		throw error(502, 'Failed to load title details. Please try again.');
	}
};
