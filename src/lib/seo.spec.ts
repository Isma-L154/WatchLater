import { describe, expect, it } from 'vitest';
import { schemaScript, serializeSchema } from './seo';

describe('serializeSchema', () => {
	it('produces JSON a parser reads back unchanged', () => {
		const schema = { '@type': 'WebApplication', name: 'WatchLater' };
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
