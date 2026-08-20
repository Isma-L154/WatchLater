import { describe, expect, it } from 'vitest';
import { homeReset } from './home-reset.svelte';

/**
 * The signal exists because the logo and the search it clears live on opposite
 * sides of a layout boundary. What matters is that every press is distinct —
 * a flag would collapse two "start over" clicks into one.
 */
describe('homeReset', () => {
	it('reports a distinct value for every request', () => {
		const start = homeReset.requested;

		homeReset.request();
		expect(homeReset.requested).toBe(start + 1);

		homeReset.request();
		expect(homeReset.requested).toBe(start + 2);
	});

	it('changes on a second press, so a repeat is not swallowed', () => {
		homeReset.request();
		const first = homeReset.requested;
		homeReset.request();

		expect(homeReset.requested).not.toBe(first);
	});
});
