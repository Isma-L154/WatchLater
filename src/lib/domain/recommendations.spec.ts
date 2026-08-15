import { describe, expect, it } from 'vitest';
import { buildRails, pickSeeds, seedState, type SeedCandidate } from './recommendations';
import { mediaKey } from './media';
import type { MediaResult } from '../types';

const seed = (over: Partial<SeedCandidate> & { title: string; tmdbId: number }): SeedCandidate => ({
	mediaType: 'tv',
	watched: false,
	seasonsSeen: 0,
	episodesIntoSeason: 0,
	addedAt: new Date('2026-01-01'),
	watchedAt: null,
	...over
});

const result = (tmdbId: number, over: Partial<MediaResult> = {}): MediaResult => ({
	tmdbId,
	mediaType: 'movie',
	title: `Title ${tmdbId}`,
	posterPath: `/poster-${tmdbId}.jpg`,
	releaseDate: '2025-01-01',
	overview: null,
	voteAverage: 7,
	...over
});

/** Enough to clear `MIN_RAIL_ITEMS` without spelling out six literals each time. */
const results = (ids: number[]) => ids.map((id) => result(id));

describe('pickSeeds', () => {
	it('prefers a finished title over one merely saved, however recent', () => {
		const rows = [
			seed({ tmdbId: 1, title: 'Saved today', addedAt: new Date('2026-08-14') }),
			seed({
				tmdbId: 2,
				title: 'Finished last month',
				watched: true,
				watchedAt: new Date('2026-07-10'),
				addedAt: new Date('2026-01-01')
			})
		];

		expect(pickSeeds(rows, 1).map((s) => s.title)).toEqual(['Finished last month']);
	});

	/**
	 * A show being watched right now is the strongest statement of current taste
	 * there is, and it has no `watchedAt` to sort by.
	 */
	it('treats a part-watched show as engaged', () => {
		const rows = [
			seed({ tmdbId: 1, title: 'Untouched', addedAt: new Date('2026-08-14') }),
			seed({
				tmdbId: 2,
				title: 'Halfway in',
				episodesIntoSeason: 4,
				addedAt: new Date('2026-02-01')
			})
		];

		expect(pickSeeds(rows, 1).map((s) => s.title)).toEqual(['Halfway in']);
	});

	it('orders engaged titles by how recently they were watched', () => {
		const rows = [
			seed({ tmdbId: 1, title: 'Older', watched: true, watchedAt: new Date('2026-03-01') }),
			seed({ tmdbId: 2, title: 'Newer', watched: true, watchedAt: new Date('2026-08-01') })
		];

		expect(pickSeeds(rows, 2).map((s) => s.title)).toEqual(['Newer', 'Older']);
	});

	// A list nobody has watched anything from still deserves suggestions.
	it('falls back to the most recently added', () => {
		const rows = [
			seed({ tmdbId: 1, title: 'Old', addedAt: new Date('2026-01-01') }),
			seed({ tmdbId: 2, title: 'New', addedAt: new Date('2026-08-01') })
		];

		expect(pickSeeds(rows, 1).map((s) => s.title)).toEqual(['New']);
	});

	it('handles an empty list', () => {
		expect(pickSeeds([])).toEqual([]);
	});
});

describe('buildRails', () => {
	const silo = seed({ tmdbId: 100, title: 'Silo', watched: true });
	const severance = seed({ tmdbId: 200, title: 'Severance' });

	it('builds a rail from a seed and its suggestions', () => {
		const rails = buildRails([{ seed: silo, items: results([1, 2, 3, 4, 5]) }], new Set());

		expect(rails).toHaveLength(1);
		expect(rails[0].seedTitle).toBe('Silo');
		expect(rails[0].seedState).toBe('watched');
		expect(rails[0].items).toHaveLength(5);
	});

	// The point of the feature: suggest what is *not* already there.
	it('drops titles already on the list', () => {
		const saved = new Set([mediaKey({ tmdbId: 2, mediaType: 'movie' })]);
		const rails = buildRails([{ seed: silo, items: results([1, 2, 3, 4, 5]) }], saved);

		expect(rails[0].items.map((i) => i.tmdbId)).toEqual([1, 3, 4, 5]);
	});

	/**
	 * A tmdb id is only unique within its media type, so a saved *show* must not
	 * suppress the film that happens to share its id.
	 */
	it('matches saved titles on media type as well as id', () => {
		const saved = new Set([mediaKey({ tmdbId: 2, mediaType: 'tv' })]);
		const rails = buildRails([{ seed: silo, items: results([1, 2, 3, 4]) }], saved);

		expect(rails[0].items.map((i) => i.tmdbId)).toEqual([1, 2, 3, 4]);
	});

	it('never repeats a title across two rails', () => {
		const rails = buildRails(
			[
				{ seed: silo, items: results([1, 2, 3, 4]) },
				{ seed: severance, items: results([3, 4, 5, 6, 7, 8]) }
			],
			new Set()
		);

		expect(rails[0].items.map((i) => i.tmdbId)).toEqual([1, 2, 3, 4]);
		expect(rails[1].items.map((i) => i.tmdbId)).toEqual([5, 6, 7, 8]);
	});

	it('drops a rail left too thin to be worth a heading', () => {
		const rails = buildRails(
			[
				{ seed: silo, items: results([1, 2, 3, 4]) },
				// Every suggestion is already spoken for by the first rail.
				{ seed: severance, items: results([1, 2, 3, 4]) }
			],
			new Set()
		);

		expect(rails).toHaveLength(1);
	});

	// A poster-less tile in a wall of artwork reads as a broken image.
	it('drops titles with no poster', () => {
		const items = [...results([1, 2, 3, 4]), result(5, { posterPath: null })];
		const rails = buildRails([{ seed: silo, items }], new Set());

		expect(rails[0].items.map((i) => i.tmdbId)).toEqual([1, 2, 3, 4]);
	});

	it('deduplicates repeats within a single response', () => {
		const rails = buildRails([{ seed: silo, items: results([1, 1, 2, 3, 4]) }], new Set());
		expect(rails[0].items.map((i) => i.tmdbId)).toEqual([1, 2, 3, 4]);
	});

	it('caps a rail and the number of rails', () => {
		const many = results(Array.from({ length: 30 }, (_, i) => i + 1));
		const rails = buildRails(
			[
				{ seed: silo, items: many },
				{ seed: severance, items: results([100, 101, 102, 103]) },
				{ seed: seed({ tmdbId: 300, title: 'Third' }), items: results([200, 201, 202, 203]) }
			],
			new Set()
		);

		expect(rails).toHaveLength(2);
		expect(rails[0].items).toHaveLength(8);
	});

	it('returns nothing when every lookup came back empty', () => {
		expect(buildRails([{ seed: silo, items: [] }], new Set())).toEqual([]);
	});
});

describe('seedState', () => {
	it('distinguishes finished, in-progress and merely saved', () => {
		expect(seedState(seed({ tmdbId: 1, title: 'Done', watched: true }))).toBe('watched');
		expect(seedState(seed({ tmdbId: 2, title: 'Mid', episodesIntoSeason: 3 }))).toBe('watching');
		expect(seedState(seed({ tmdbId: 3, title: 'Mid', seasonsSeen: 1 }))).toBe('watching');
		expect(seedState(seed({ tmdbId: 4, title: 'Untouched' }))).toBe('saved');
	});
});
