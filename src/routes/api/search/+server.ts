import { error, json } from '@sveltejs/kit';
import { searchMulti } from '$lib/server/tmdb';
import type { RequestHandler } from './$types';

/**
 * GET /api/search?q=<query>
 *
 * Server-side proxy to TMDB multi-search. The browser calls this endpoint
 * instead of TMDB directly, which keeps the access token off the client.
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) return json({ results: [] });

	try {
		const results = await searchMulti(query);
		return json({ results });
	} catch (err) {
		console.error('TMDB search failed:', err);
		throw error(502, 'Failed to reach the movie database. Please try again.');
	}
};
