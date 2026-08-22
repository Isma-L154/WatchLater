import { describe, expect, it, vi } from 'vitest';
import { redirectRetiredHost } from './hooks.server';

/**
 * The redirect off the retired host.
 *
 * It exists so the address this site used to live at keeps working — for the
 * page Google has indexed, and for anyone whose bookmark predates the move. It
 * is also the kind of rule that is easy to write too broadly: matching every
 * `.workers.dev` host would send preview deployments to production, which no
 * test would notice until somebody tried to review one.
 */
const RETIRED = 'https://nextsode.ilsproj.workers.dev';
const CANONICAL = 'https://nextsode.cloudils.com';

/** A request through the real hook chain, with the rest of it stubbed out. */
async function request(href: string, method = 'GET') {
	const resolve = vi.fn(async () => new Response('the app', { status: 200 }));
	// The hook alone, not the whole `sequence`: composing them needs SvelteKit's
	// request store, and what is under test here is one rule.
	const response = await redirectRetiredHost({
		event: { url: new URL(href), request: new Request(href, { method }) },
		resolve
	} as never);
	return { response: response as Response, resolve };
}

describe('the retired host', () => {
	it('sends a visitor to the same page on the new one', async () => {
		const { response } = await request(`${RETIRED}/watchlist`);

		expect(response.status).toBe(301);
		expect(response.headers.get('location')).toBe(`${CANONICAL}/watchlist`);
	});

	it('keeps the query string', async () => {
		// A calendar event links back with `?title=`, and those links are years
		// old by design.
		const { response } = await request(`${RETIRED}/?title=movie-27205`);

		expect(response.headers.get('location')).toBe(`${CANONICAL}/?title=movie-27205`);
	});

	it('never reaches the rest of the app', async () => {
		const { resolve } = await request(`${RETIRED}/`);

		// A request to the old host has no business touching the database.
		expect(resolve).not.toHaveBeenCalled();
	});

	it('preserves the method for anything that is not a plain read', async () => {
		// 301 turns a POST into a GET. Someone with the old page still open and a
		// form to submit would have their save silently dropped.
		const { response } = await request(`${RETIRED}/?/add`, 'POST');

		expect(response.status).toBe(308);
	});

	it('uses 301 for reads, which is the code search engines act on', async () => {
		for (const method of ['GET', 'HEAD']) {
			const { response } = await request(`${RETIRED}/`, method);
			expect(response.status).toBe(301);
		}
	});
});

describe('every other host', () => {
	it('serves the app on the canonical host', async () => {
		const { response, resolve } = await request(`${CANONICAL}/`);

		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalled();
	});

	it('leaves preview deployments alone', async () => {
		// Previews are versioned subdomains of workers.dev. Matching on the suffix
		// rather than the exact host would bounce every one of them to production.
		const { response, resolve } = await request('https://a1b2c3-nextsode.ilsproj.workers.dev/');

		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalled();
	});

	it('leaves local development alone', async () => {
		const { resolve } = await request('http://localhost:5173/');

		expect(resolve).toHaveBeenCalled();
	});
});
