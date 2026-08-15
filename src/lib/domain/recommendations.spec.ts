import { describe, expect, it } from 'vitest';
import { buildRails, dayNumber, pickSeeds, seedState, type SeedCandidate } from './recommendations';
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

describe('dayNumber', () => {
	// 23:30 in Bogota on the 14th is already the 15th in UTC. The viewer's
	// midnight is the one the rows turn over on, so this is still day 14.
	it('uses the viewer’s calendar date, not the server’s', () => {
		const instant = new Date('2026-08-15T04:30:00Z');
		expect(dayNumber(instant, 'America/Bogota')).toBe(
			dayNumber(new Date('2026-08-14T18:00:00Z'), 'America/Bogota')
		);
		expect(dayNumber(instant, 'UTC')).toBe(dayNumber(instant, 'America/Bogota') + 1);
	});

	it('advances by exactly one across local midnight', () => {
		const before = dayNumber(new Date('2026-08-15T04:59:00Z'), 'America/Bogota');
		const after = dayNumber(new Date('2026-08-15T05:01:00Z'), 'America/Bogota');
		expect(after).toBe(before + 1);
	});

	it('falls back to UTC for an unusable zone rather than throwing', () => {
		const instant = new Date('2026-08-15T12:00:00Z');
		expect(dayNumber(instant, 'Not/AZone')).toBe(dayNumber(instant, 'UTC'));
	});
});

describe('pickSeeds — daily rotation', () => {
	const engaged = (n: number) =>
		Array.from({ length: n }, (_, i) =>
			seed({
				tmdbId: i + 1,
				title: `Show ${i + 1}`,
				watched: true,
				watchedAt: new Date(2026, 0, 30 - i)
			})
		);

	it('shows a different set of seeds the next day', () => {
		const rows = engaged(6);
		const today = pickSeeds(rows, 3, 0).map((s) => s.title);
		const tomorrow = pickSeeds(rows, 3, 1).map((s) => s.title);

		expect(today).not.toEqual(tomorrow);
		expect(today).toEqual(['Show 1', 'Show 2', 'Show 3']);
		expect(tomorrow).toEqual(['Show 2', 'Show 3', 'Show 4']);
	});

	it('is stable within the same day', () => {
		const rows = engaged(6);
		expect(pickSeeds(rows, 3, 100)).toEqual(pickSeeds(rows, 3, 100));
	});

	it('cycles back round rather than running out', () => {
		const rows = engaged(6);
		expect(pickSeeds(rows, 3, 6).map((s) => s.title)).toEqual(
			pickSeeds(rows, 3, 0).map((s) => s.title)
		);
	});

	/**
	 * The limitation worth stating: with no more engaged titles than rails, every
	 * day draws on the same shows and only their order moves.
	 */
	it('only reorders when there is nothing else to rotate to', () => {
		const rows = engaged(2);
		const today = pickSeeds(rows, 3, 100).map((s) => s.title);
		const tomorrow = pickSeeds(rows, 3, 101).map((s) => s.title);

		expect(new Set(today)).toEqual(new Set(tomorrow));
		expect(today).not.toEqual(tomorrow);
	});

	// Rotation must never walk off the engaged pool into untouched saves.
	it('never rotates an untouched title ahead of an engaged one', () => {
		const rows = [
			...engaged(4),
			seed({ tmdbId: 90, title: 'Never watched', addedAt: new Date('2026-08-14') })
		];

		for (let day = 0; day < 12; day++) {
			expect(pickSeeds(rows, 3, day).map((s) => s.title)).not.toContain('Never watched');
		}
	});

	it('still falls back to untouched saves when nothing is engaged', () => {
		const rows = [
			seed({ tmdbId: 1, title: 'Saved A', addedAt: new Date('2026-08-01') }),
			seed({ tmdbId: 2, title: 'Saved B', addedAt: new Date('2026-08-02') })
		];
		expect(pickSeeds(rows, 3, 7).map((s) => s.title)).toEqual(['Saved B', 'Saved A']);
	});
});
