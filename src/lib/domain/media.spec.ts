import { describe, expect, it } from 'vitest';
import { dedupeByKey, mediaKey } from './media';

const item = (tmdbId: number, mediaType: 'movie' | 'tv' = 'movie', tag = '') => ({
	tmdbId,
	mediaType,
	tag
});

describe('mediaKey', () => {
	it('combines id and media type', () => {
		expect(mediaKey({ tmdbId: 1399, mediaType: 'tv' })).toBe('1399:tv');
	});

	// The whole reason the key is not just the id.
	it('separates a movie from a show sharing the same TMDB id', () => {
		expect(mediaKey({ tmdbId: 1399, mediaType: 'movie' })).not.toBe(
			mediaKey({ tmdbId: 1399, mediaType: 'tv' })
		);
	});
});

describe('dedupeByKey', () => {
	it('leaves a list with no repeats untouched', () => {
		const items = [item(1), item(2), item(3)];
		expect(dedupeByKey(items)).toEqual(items);
	});

	it('keeps the first occurrence and drops later ones', () => {
		const result = dedupeByKey([item(1, 'movie', 'fresh'), item(2), item(1, 'movie', 'stale')]);
		expect(result).toHaveLength(2);
		expect(result[0].tag).toBe('fresh');
	});

	it('does not collapse a movie and a show with the same id', () => {
		expect(dedupeByKey([item(1399, 'movie'), item(1399, 'tv')])).toHaveLength(2);
	});

	it('handles an empty list', () => {
		expect(dedupeByKey([])).toEqual([]);
	});
});
