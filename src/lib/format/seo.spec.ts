import { describe, expect, it } from 'vitest';
import { pageSchema, schemaScript, serializeSchema, siteSchema } from './seo';

describe('serializeSchema', () => {
	it('produces JSON a parser reads back unchanged', () => {
		const schema = { '@type': 'WebApplication', name: 'Nextsode' };
		expect(JSON.parse(serializeSchema(schema))).toEqual(schema);
	});

	/**
	 * The whole point: embedded in a page, an unescaped closing tag would end the
	 * script element early and turn everything after it into markup.
	 */
	it('leaves no literal closing tag in the output', () => {
		const output = serializeSchema({ name: '</script><img onerror=alert(1)>' });

		expect(output).not.toContain('</script>');
		expect(output).not.toContain('<');
		// Still the same string once parsed — escaped, not stripped.
		expect(JSON.parse(output).name).toBe('</script><img onerror=alert(1)>');
	});

	it('escapes a bracket wherever it appears', () => {
		expect(serializeSchema({ url: 'https://example.com/<' })).not.toContain('<');
	});
});

describe('schemaScript', () => {
	it('wraps the data in a typed script element', () => {
		const html = schemaScript({ '@type': 'WebApplication' });
		expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
		expect(html.endsWith('</script>')).toBe(true);
	});

	// Exactly one closing tag: the element's own, never one smuggled in by data.
	it('cannot be closed early by its own content', () => {
		const html = schemaScript({ name: '</script><script>alert(1)</script>' });
		expect(html.split('</script>')).toHaveLength(2);
	});
});

const ORIGIN = 'https://nextsode.example';

/** Pull one node out of the site graph by its schema.org type. */
function node(type: string): Record<string, unknown> {
	const graph = siteSchema(ORIGIN)['@graph'] as Record<string, unknown>[];
	const found = graph.find((entry) => entry['@type'] === type);
	if (!found) throw new Error(`no ${type} node in the site graph`);
	return found;
}

describe('siteSchema', () => {
	it('describes the site and the app as one graph', () => {
		const graph = siteSchema(ORIGIN)['@graph'] as Record<string, unknown>[];
		expect(graph.map((entry) => entry['@type'])).toEqual(['WebSite', 'WebApplication']);
	});

	it('names the site, which is what a result gets titled with', () => {
		// Without this Google infers a name from the domain or the title, which is
		// a guess about the product rather than a statement of it.
		expect(node('WebSite').name).toBe('Nextsode');
	});

	it('declares the forms people actually type', () => {
		expect(node('WebSite').alternateName).toContain('Nextsode Watchlist');
		expect(node('WebApplication').alternateName).toContain('Nextsode Movies and TV');
	});

	it('points both nodes at somewhere the name is corroborated', () => {
		const repo = 'https://github.com/Isma-L154/nextsode';
		expect(node('WebSite').sameAs).toEqual([repo]);
		expect(node('WebApplication').sameAs).toEqual([repo]);
	});

	it('ties the app to the site rather than leaving them unrelated', () => {
		expect(node('WebApplication').isPartOf).toEqual({ '@id': `${ORIGIN}/#website` });
	});

	it('gives every node a stable id built from the deployment origin', () => {
		expect(node('WebSite')['@id']).toBe(`${ORIGIN}/#website`);
		expect(node('WebApplication')['@id']).toBe(`${ORIGIN}/#app`);
	});

	it('follows the origin, so a custom domain rewrites itself', () => {
		const graph = siteSchema('https://nextsode.app')['@graph'] as Record<string, unknown>[];
		expect(graph.every((entry) => String(entry['@id']).startsWith('https://nextsode.app'))).toBe(
			true
		);
	});

	it('still says the app is free', () => {
		expect(node('WebApplication').offers).toEqual({
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		});
	});

	it('survives being embedded in HTML', () => {
		expect(() => JSON.parse(serializeSchema(siteSchema(ORIGIN)))).not.toThrow();
	});
});

describe('pageSchema', () => {
	const terms = pageSchema(ORIGIN, '/terms', 'Terms of Use — Nextsode', 'The terms.');

	it('carries the page its own identity', () => {
		expect(terms['@type']).toBe('WebPage');
		expect(terms['@id']).toBe(`${ORIGIN}/terms#page`);
		expect(terms.url).toBe(`${ORIGIN}/terms`);
		expect(terms.name).toBe('Terms of Use — Nextsode');
	});

	it('points back at the site, which is the only reason it is here', () => {
		expect(terms.isPartOf).toEqual({ '@id': `${ORIGIN}/#website` });
		expect(terms.about).toEqual({ '@id': `${ORIGIN}/#app` });
	});

	it('references the same site node the homepage defines', () => {
		const graph = siteSchema(ORIGIN)['@graph'] as Record<string, unknown>[];
		const website = graph.find((entry) => entry['@type'] === 'WebSite');
		expect((terms.isPartOf as { '@id': string })['@id']).toBe(website!['@id']);
	});
});
