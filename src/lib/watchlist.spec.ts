import { describe, expect, it } from 'vitest';
import { applyWatchlistView, countByStatus, type WatchlistEntry } from './watchlist';

const items: WatchlistEntry[] = [
	{ title: 'The Matrix', mediaType: 'movie', watched: false, voteAverage: 8.2 },
	{ title: 'Breaking Bad', mediaType: 'tv', watched: true, voteAverage: 8.9 },
	{ title: 'Arrival', mediaType: 'movie', watched: true, voteAverage: 7.6 },
	{ title: 'Andor', mediaType: 'tv', watched: false, voteAverage: null }
];

const baseView = { status: 'all', type: 'all', sort: 'recent', query: '' };

describe('applyWatchlistView — filtering', () => {
	it('returns everything by default', () => {
		expect(applyWatchlistView(items, baseView)).toHaveLength(4);
	});

	it('filters by "to watch" status', () => {
		const result = applyWatchlistView(items, { ...baseView, status: 'toWatch' });
		expect(result.map((i) => i.title)).toEqual(['The Matrix', 'Andor']);
	});

	it('filters by "watched" status', () => {
		const result = applyWatchlistView(items, { ...baseView, status: 'watched' });
		expect(result.map((i) => i.title)).toEqual(['Breaking Bad', 'Arrival']);
	});

	it('filters by media type', () => {
		const result = applyWatchlistView(items, { ...baseView, type: 'tv' });
		expect(result.map((i) => i.title)).toEqual(['Breaking Bad', 'Andor']);
	});

	it('filters by a case-insensitive title query', () => {
		const result = applyWatchlistView(items, { ...baseView, query: 'ARR' });
		expect(result.map((i) => i.title)).toEqual(['Arrival']);
	});

	it('combines status, type and query', () => {
		const result = applyWatchlistView(items, {
			...baseView,
			status: 'toWatch',
			type: 'tv',
			query: 'and'
		});
		expect(result.map((i) => i.title)).toEqual(['Andor']);
	});
});

describe('applyWatchlistView — sorting', () => {
	it('preserves input order for "recent"', () => {
		const result = applyWatchlistView(items, baseView);
		expect(result.map((i) => i.title)).toEqual(['The Matrix', 'Breaking Bad', 'Arrival', 'Andor']);
	});

	it('sorts by rating (desc, nulls last)', () => {
		const result = applyWatchlistView(items, { ...baseView, sort: 'rating' });
		expect(result.map((i) => i.title)).toEqual(['Breaking Bad', 'The Matrix', 'Arrival', 'Andor']);
	});

	it('sorts by title (A–Z)', () => {
		const result = applyWatchlistView(items, { ...baseView, sort: 'title' });
		expect(result.map((i) => i.title)).toEqual(['Andor', 'Arrival', 'Breaking Bad', 'The Matrix']);
	});

	it('does not mutate the input array', () => {
		const snapshot = items.map((i) => i.title);
		applyWatchlistView(items, { ...baseView, sort: 'title' });
		expect(items.map((i) => i.title)).toEqual(snapshot);
	});
});

describe('countByStatus', () => {
	it('counts all, to-watch and watched', () => {
		expect(countByStatus(items)).toEqual({ all: 4, toWatch: 2, watched: 2 });
	});

	it('handles an empty list', () => {
		expect(countByStatus([])).toEqual({ all: 0, toWatch: 0, watched: 0 });
	});
});
