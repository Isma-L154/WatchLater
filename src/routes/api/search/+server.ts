import { error, json } from '@sveltejs/kit';
import { searchMulti } from '$lib/server/tmdb';
import type { RequestHandler } from './$types';

/**
 * Longest query we forward to TMDB.
 *
 * The endpoint is public, so the query string is attacker-controlled. Without a
 * cap, a single request could push an arbitrarily large string into an outbound
 * TMDB URL; no real search is anywhere near this long.
 */
const MAX_QUERY_LENGTH = 120;

/**
 * How long a search result may be reused.
 *
 * TMDB's catalogue barely moves minute to minute, and the access token is shared
 * by every visitor — so an uncached endpoint lets anyone burn the whole app's
 * rate limit in a loop. Letting Cloudflare's edge cache absorb repeated queries
 * is both the cheapest abuse mitigation available on a free tier and a
 * straight latency win for common searches.
 */
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * GET /api/search?q=<query>
 *
 * Server-side proxy to TMDB multi-search. The browser calls this endpoint
 * instead of TMDB directly, which keeps the access token off the client.
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
	if (!query) return json({ results: [] });

	try {
		const results = await searchMulti(query);
		return json({ results }, { headers: { 'cache-control': CACHE_CONTROL } });
	} catch (err) {
		console.error('TMDB search failed:', err);
		error(502, 'Failed to reach the movie database. Please try again.');
	}
};
