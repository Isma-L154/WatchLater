import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaDetailsRequest } from './details.svelte';
import { PersonRequest } from './person.svelte';

/**
 * Both stores guard against the same thing: two lookups in flight at once, and
 * the network answering them out of order. It is not an edge case in either
 * place — cast faces sit a single tap apart, and advancing a season refetches
 * the sheet you are already looking at — so "the newest request wins" is the
 * contract, not an optimisation.
 */

/** A fetch whose responses are resolved by the test, in whatever order it likes. */
function deferredFetch() {
	const pending: { resolve: (body: unknown) => void; reject: (reason?: unknown) => void }[] = [];

	const fetchMock = vi.fn(
		() =>
			new Promise((resolve, reject) => {
				pending.push({
					resolve: (body) => resolve({ ok: true, json: async () => body } as Response),
					reject
				});
			})
	);

	vi.stubGlobal('fetch', fetchMock);
	return { pending, fetchMock };
}

/** Let the awaited chain inside the store settle before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.unstubAllGlobals());

const query = { tmdbId: 1, mediaType: 'movie' as const, country: 'US', season: null };

describe('MediaDetailsRequest', () => {
	it('keeps the answer to the question currently being asked', async () => {
		const { pending } = deferredFetch();
		const request = new MediaDetailsRequest();

		void request.load({ ...query, tmdbId: 1 });
		void request.load({ ...query, tmdbId: 2 });

		// Second answer first, then the stale one — the order that breaks a store
		// without a guard.
		pending[1].resolve({ tmdbId: 2, title: 'Newest' });
		await flush();
		pending[0].resolve({ tmdbId: 1, title: 'Stale' });
		await flush();

		expect(request.details?.title).toBe('Newest');
		expect(request.loading).toBe(false);
	});

	it('does not let a superseded failure surface as this request failing', async () => {
		const { pending } = deferredFetch();
		const request = new MediaDetailsRequest();

		void request.load({ ...query, tmdbId: 1 });
		void request.load({ ...query, tmdbId: 2 });

		pending[1].resolve({ tmdbId: 2, title: 'Newest' });
		await flush();
		pending[0].reject(new Error('the abandoned request went wrong'));
		await flush();

		expect(request.failed).toBe(false);
		expect(request.details?.title).toBe('Newest');
	});

	it('reports a real failure', async () => {
		const { pending } = deferredFetch();
		const request = new MediaDetailsRequest();

		void request.load(query);
		pending[0].reject(new Error('offline'));
		await flush();

		expect(request.failed).toBe(true);
		expect(request.loading).toBe(false);
		expect(request.details).toBeNull();
	});
});

describe('PersonRequest', () => {
	it('shows the person whose face was tapped last', async () => {
		const { pending } = deferredFetch();
		const request = new PersonRequest();

		void request.load(11);
		void request.load(22);

		pending[1].resolve({ id: 22, name: 'Second', profilePath: null, knownFor: null, credits: [] });
		await flush();
		pending[0].resolve({ id: 11, name: 'First', profilePath: null, knownFor: null, credits: [] });
		await flush();

		expect(request.person?.name).toBe('Second');
	});

	it('asks by person id', async () => {
		const { fetchMock } = deferredFetch();
		const request = new PersonRequest();

		void request.load(3223);
		expect(fetchMock).toHaveBeenCalledWith('/api/person/3223');
	});

	it('cannot be repopulated by a late answer after being dismissed', async () => {
		const { pending } = deferredFetch();
		const request = new PersonRequest();

		void request.load(11);
		request.cancel();

		pending[0].resolve({
			id: 11,
			name: 'Too late',
			profilePath: null,
			knownFor: null,
			credits: []
		});
		await flush();

		expect(request.person).toBeNull();
		expect(request.loading).toBe(false);
		expect(request.failed).toBe(false);
	});
});
