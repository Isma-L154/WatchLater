import type { RequestHandler } from './$types';

/**
 * The sitemap, which for this app is one URL.
 *
 * That is not an oversight, it is the shape of the thing: everything else is
 * either private (a list), a redirect (sign-in) or a proxy (the API). Listing
 * them would spend crawl budget to have each one rejected. A one-entry sitemap
 * still earns its place — it is what Search Console accepts for a submission,
 * and it carries the canonical host, which settles for the crawler whether
 * `/` and `/index.html` are the same page.
 *
 * Built from the request origin so a move to a custom domain needs no edit here.
 */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

export const GET: RequestHandler = ({ url }) => {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${url.origin}/</loc>
		<changefreq>daily</changefreq>
		<priority>1.0</priority>
	</url>
</urlset>
`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': CACHE_CONTROL
		}
	});
};
