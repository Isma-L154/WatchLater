import type { RequestHandler } from './$types';

/**
 * The public surface, which is short: the home page and the two legal ones.
 *
 * Everything else is private (a list), a redirect (sign-in) or a proxy (the
 * API), and listing those would spend crawl budget to have each one rejected.
 *
 * Built from the request origin so a move to a custom domain needs no edit here.
 */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

/** Path, how often it is worth re-reading, and its weight relative to the rest. */
const PAGES: ReadonlyArray<{ path: string; changefreq: string; priority: string }> = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/terms', changefreq: 'yearly', priority: '0.3' },
	{ path: '/privacy', changefreq: 'yearly', priority: '0.3' }
];

export const GET: RequestHandler = ({ url }) => {
	const entries = PAGES.map(
		({ path, changefreq, priority }) => `	<url>
		<loc>${url.origin}${path}</loc>
		<changefreq>${changefreq}</changefreq>
		<priority>${priority}</priority>
	</url>`
	).join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': CACHE_CONTROL
		}
	});
};
