import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Renders the repository banner from `docs/brand/banner.html`.
 *
 * The banner is drawn rather than painted: it is built from the same palette,
 * typeface and film mark the app itself uses, so it stays right when the brand
 * moves. Regenerate with `npm run brand`.
 *
 * Deliberately contains no recognisable characters. Posters here are archetypes
 * — a spaceship, a crown, a silhouette in a hat — because "films and TV" reads
 * perfectly well from those, and putting somebody else's characters on a public
 * repository is a legal problem rather than a design one.
 */
const SIZE = { width: 1280, height: 640 };

/** Inlined as data URIs: the render must not depend on a network or a font cache. */
function font(path) {
	return `data:font/woff2;base64,${readFileSync(path).toString('base64')}`;
}

const html = readFileSync('docs/brand/banner.html', 'utf8')
	.replace(
		'__OUTFIT__',
		font('node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2')
	)
	.replace(
		'__WORK_SANS__',
		font('node_modules/@fontsource-variable/work-sans/files/work-sans-latin-wght-normal.woff2')
	);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.locator('#banner').screenshot({ path: 'docs/brand/nextsode-banner.png' });
await browser.close();

const bytes = readFileSync('docs/brand/nextsode-banner.png').length;
console.log(
	`docs/brand/nextsode-banner.png — ${SIZE.width}x${SIZE.height}, ${Math.round(bytes / 1024)}KB`
);
