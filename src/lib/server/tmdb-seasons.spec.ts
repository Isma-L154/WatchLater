import { describe, expect, it } from 'vitest';
import { normalizeSeasonEpisodes, splitSeasons } from './tmdb';

/**
 * Fixed "today" so these never drift with the calendar. Chosen to sit between
 * Reacher's third and fourth seasons, the case that motivated the split.
 */
const now = new Date('2026-08-01T12:00:00Z');

describe('splitSeasons', () => {
	it('reports nothing when there are no seasons', () => {
		expect(splitSeasons(undefined, now)).toEqual({
			totalSeasons: null,
			airedSeasons: null,
			upcomingSeason: null,
			episodeCounts: {}
		});
		expect(splitSeasons([], now).totalSeasons).toBeNull();
	});

	// The reported bug: TMDB counts the announced season in number_of_seasons.
	it('separates aired seasons from an announced one', () => {
		const result = splitSeasons(
			[
				{ season_number: 1, air_date: '2022-01-31' },
				{ season_number: 2, air_date: '2023-12-14' },
				{ season_number: 3, air_date: '2025-02-19' },
				{ season_number: 4, air_date: '2026-08-12' }
			],
			now
		);

		expect(result.totalSeasons).toBe(4);
		expect(result.airedSeasons).toBe(3);
		expect(result.upcomingSeason).toEqual({ number: 4, airDate: '2026-08-12' });
	});

	/**
	 * Season 0 is "Specials". It is not part of the numbered run, and counting it
	 * would shift every season by one — "Season 3" would mean the second real one.
	 */
	it('ignores the specials season', () => {
		const result = splitSeasons(
			[
				{ season_number: 0, air_date: '2021-12-01' },
				{ season_number: 1, air_date: '2022-01-31' },
				{ season_number: 2, air_date: '2023-12-14' }
			],
			now
		);

		expect(result.totalSeasons).toBe(2);
		expect(result.airedSeasons).toBe(2);
	});

	/**
	 * TMDB leaves the date empty for seasons that are announced but unscheduled.
	 * Treating those as aired would recreate the exact bug this prevents.
	 */
	it('treats an undated season as not yet aired', () => {
		const result = splitSeasons(
			[
				{ season_number: 1, air_date: '2022-01-31' },
				{ season_number: 2, air_date: null }
			],
			now
		);

		expect(result.airedSeasons).toBe(1);
		expect(result.upcomingSeason).toEqual({ number: 2, airDate: null });
	});

	it('counts a season premiering today as aired', () => {
		const result = splitSeasons([{ season_number: 1, air_date: '2026-08-01' }], now);
		expect(result.airedSeasons).toBe(1);
		expect(result.upcomingSeason).toBeNull();
	});

	it('reports no upcoming season for a finished show', () => {
		const result = splitSeasons(
			[
				{ season_number: 1, air_date: '2010-01-01' },
				{ season_number: 2, air_date: '2011-01-01' }
			],
			now
		);

		expect(result.airedSeasons).toBe(2);
		expect(result.totalSeasons).toBe(2);
		expect(result.upcomingSeason).toBeNull();
	});

	it('handles seasons arriving out of order', () => {
		const result = splitSeasons(
			[
				{ season_number: 3, air_date: '2030-01-01' },
				{ season_number: 1, air_date: '2022-01-31' },
				{ season_number: 2, air_date: '2023-12-14' }
			],
			now
		);

		expect(result.airedSeasons).toBe(2);
		expect(result.upcomingSeason?.number).toBe(3);
	});

	it('handles a show with nothing aired yet', () => {
		const result = splitSeasons([{ season_number: 1, air_date: '2030-05-01' }], now);
		expect(result.airedSeasons).toBe(0);
		expect(result.upcomingSeason?.number).toBe(1);
	});
});

describe('splitSeasons — episode counts', () => {
	it('indexes episode counts by season number', () => {
		const result = splitSeasons(
			[
				{ season_number: 0, air_date: '2021-12-01', episode_count: 3 },
				{ season_number: 1, air_date: '2022-01-31', episode_count: 8 },
				{ season_number: 2, air_date: '2023-12-14', episode_count: 10 }
			],
			now
		);

		// Specials are excluded here too, or rollover would use the wrong length.
		expect(result.episodeCounts).toEqual({ 1: 8, 2: 10 });
	});

	it('omits seasons with no usable count rather than storing zero', () => {
		const result = splitSeasons(
			[
				{ season_number: 1, air_date: '2022-01-31', episode_count: 8 },
				{ season_number: 2, air_date: '2030-01-01', episode_count: 0 }
			],
			now
		);

		expect(result.episodeCounts).toEqual({ 1: 8 });
	});
});

describe('normalizeSeasonEpisodes', () => {
	const season = (episodes: Array<{ n: number; air: string | null }>) => ({
		episodes: episodes.map((e) => ({
			episode_number: e.n,
			name: `Episode ${e.n}`,
			air_date: e.air,
			runtime: 45
		}))
	});

	it('returns null when there are no episodes', () => {
		expect(normalizeSeasonEpisodes(undefined, 1, now)).toBeNull();
		expect(normalizeSeasonEpisodes({ episodes: [] }, 1, now)).toBeNull();
	});

	/**
	 * The ceiling the write path validates against: a season can be part-way
	 * broadcast, and the episodes still to come are not tickable.
	 */
	it('counts only aired episodes', () => {
		const result = normalizeSeasonEpisodes(
			season([
				{ n: 1, air: '2026-07-01' },
				{ n: 2, air: '2026-08-01' },
				{ n: 3, air: '2026-09-01' },
				{ n: 4, air: null }
			]),
			3,
			now
		);

		expect(result?.airedCount).toBe(2);
		expect(result?.episodes.map((e) => e.aired)).toEqual([true, true, false, false]);
	});

	it('sorts out-of-order episodes and drops specials', () => {
		const result = normalizeSeasonEpisodes(
			season([
				{ n: 3, air: '2026-07-03' },
				{ n: 0, air: '2026-07-00' },
				{ n: 1, air: '2026-07-01' }
			]),
			1,
			now
		);

		expect(result?.episodes.map((e) => e.number)).toEqual([1, 3]);
	});

	it('falls back to a numbered name when TMDB has none', () => {
		const result = normalizeSeasonEpisodes(
			{ episodes: [{ episode_number: 5, name: '   ', air_date: '2026-01-01', runtime: null }] },
			2,
			now
		);

		expect(result?.episodes[0].name).toBe('Episode 5');
		expect(result?.seasonNumber).toBe(2);
	});
});
