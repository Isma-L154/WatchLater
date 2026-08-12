import { describe, expect, it } from 'vitest';
import {
	MAX_SEASONS,
	clampSeasons,
	deriveWatched,
	getSeasonProgress,
	isTrackable,
	normalizeTotalSeasons,
	type TrackableEntry
} from './progress';

const show = (over: Partial<TrackableEntry> = {}): TrackableEntry => ({
	mediaType: 'tv',
	watched: false,
	seasonsSeen: 0,
	totalSeasons: 5,
	// Defaults to "all five have aired"; tests that care about unaired seasons
	// override this to a lower number.
	airedSeasons: over.totalSeasons === undefined ? 5 : (over.totalSeasons ?? null),
	...over
});

describe('isTrackable', () => {
	it('tracks multi-season shows', () => {
		expect(isTrackable(show())).toBe(true);
	});

	it('does not track movies', () => {
		expect(isTrackable(show({ mediaType: 'movie' }))).toBe(false);
	});

	it('does not track shows with an unknown season count', () => {
		expect(isTrackable(show({ totalSeasons: null }))).toBe(false);
	});

	it('does not track single-season shows — a 0-to-1 stepper is just friction', () => {
		expect(isTrackable(show({ totalSeasons: 1 }))).toBe(false);
	});

	// 0 is the `NO_SEASON_DATA` sentinel the refresh writes when TMDB answered
	// but had nothing usable. It must behave exactly like "not trackable", not
	// like a zero-season show.
	it('does not track shows marked as having no season data', () => {
		expect(isTrackable(show({ totalSeasons: 0, airedSeasons: 0 }))).toBe(false);
		expect(getSeasonProgress(show({ totalSeasons: 0, airedSeasons: 0 })).trackable).toBe(false);
		expect(deriveWatched(0, 0)).toBe(false);
	});

	/**
	 * The case this whole distinction exists for: a show whose only second season
	 * is announced but unaired must not offer a "0 of 2" tracker, because the
	 * only thing you could do with it is claim to have watched an unaired season.
	 */
	it('does not track a show whose extra seasons have not aired', () => {
		expect(isTrackable(show({ totalSeasons: 2, airedSeasons: 1 }))).toBe(false);
	});

	it('measures trackability against aired seasons, not announced ones', () => {
		expect(isTrackable(show({ totalSeasons: 9, airedSeasons: 1 }))).toBe(false);
		expect(isTrackable(show({ totalSeasons: 9, airedSeasons: 2 }))).toBe(true);
	});
});

/**
 * Reacher, as reported: three seasons aired and a fourth dated for the future.
 * TMDB reports `number_of_seasons: 4`, so measuring against the total let you
 * tick off a season that had not been broadcast.
 */
describe('unaired seasons', () => {
	const reacher = (seasonsSeen: number) => show({ totalSeasons: 4, airedSeasons: 3, seasonsSeen });

	it('caps the ceiling at the aired seasons', () => {
		expect(getSeasonProgress(reacher(0)).airedSeasons).toBe(3);
		expect(getSeasonProgress(reacher(0)).totalSeasons).toBe(4);
	});

	it('refuses to record a season that has not aired', () => {
		expect(clampSeasons(4, 3)).toBe(3);
		expect(getSeasonProgress(reacher(4)).seasonsSeen).toBe(3);
	});

	it('reports "caught up" rather than "complete" while a season is pending', () => {
		const progress = getSeasonProgress(reacher(3));
		expect(progress.state).toBe('caughtUp');
		expect(progress.label).toBe('Caught up');
		expect(progress.percent).toBe(100);
	});

	it('only reports "complete" once nothing is left to air', () => {
		expect(
			getSeasonProgress(show({ totalSeasons: 4, airedSeasons: 4, seasonsSeen: 4 })).state
		).toBe('complete');
	});

	/**
	 * The self-maintaining part: being caught up counts as watched, so the show
	 * leaves "To watch" — and when the next season airs and the refresh raises
	 * the aired count, it comes back on its own.
	 */
	it('drops back out of watched when a new season airs', () => {
		expect(deriveWatched(3, 3)).toBe(true);
		expect(deriveWatched(3, 4)).toBe(false);
	});
});

describe('getSeasonProgress', () => {
	it('reports "not started" at zero', () => {
		expect(getSeasonProgress(show())).toMatchObject({
			state: 'notStarted',
			percent: 0,
			label: 'Not started'
		});
	});

	it('reports partial progress', () => {
		expect(getSeasonProgress(show({ seasonsSeen: 3 }))).toMatchObject({
			state: 'inProgress',
			percent: 60,
			label: 'Season 3 of 5'
		});
	});

	it('reports completion on the last season', () => {
		expect(getSeasonProgress(show({ seasonsSeen: 5, watched: true }))).toMatchObject({
			state: 'complete',
			percent: 100,
			label: 'All 5 seasons'
		});
	});

	it('clamps a stored count above the total (show lost seasons on TMDB)', () => {
		expect(getSeasonProgress(show({ seasonsSeen: 9 }))).toMatchObject({
			seasonsSeen: 5,
			percent: 100,
			state: 'complete'
		});
	});

	it('falls back to the plain watched flag when not trackable', () => {
		expect(getSeasonProgress(show({ mediaType: 'movie', watched: true }))).toMatchObject({
			trackable: false,
			state: 'complete',
			percent: 100
		});
	});
});

describe('deriveWatched', () => {
	it('is true only once every season is seen', () => {
		expect(deriveWatched(4, 5)).toBe(false);
		expect(deriveWatched(5, 5)).toBe(true);
		expect(deriveWatched(6, 5)).toBe(true);
	});

	it('is false when the total is unknown', () => {
		expect(deriveWatched(3, null)).toBe(false);
		expect(deriveWatched(0, 0)).toBe(false);
	});
});

describe('clampSeasons', () => {
	it('keeps values inside 0..total', () => {
		expect(clampSeasons(3, 5)).toBe(3);
		expect(clampSeasons(-4, 5)).toBe(0);
		expect(clampSeasons(99, 5)).toBe(5);
	});

	it('rejects non-numeric and fractional input', () => {
		expect(clampSeasons(Number.NaN, 5)).toBe(0);
		expect(clampSeasons(Number.POSITIVE_INFINITY, 5)).toBe(0);
		expect(clampSeasons(2.9, 5)).toBe(2);
	});

	it('collapses to zero when there is no total to measure against', () => {
		expect(clampSeasons(3, null)).toBe(0);
	});
});

describe('normalizeTotalSeasons', () => {
	it('accepts realistic counts', () => {
		expect(normalizeTotalSeasons(5)).toBe(5);
		expect(normalizeTotalSeasons(1)).toBe(1);
	});

	it('rejects missing, zero, negative and absurd counts', () => {
		expect(normalizeTotalSeasons(null)).toBeNull();
		expect(normalizeTotalSeasons(undefined)).toBeNull();
		expect(normalizeTotalSeasons(0)).toBeNull();
		expect(normalizeTotalSeasons(-3)).toBeNull();
		expect(normalizeTotalSeasons(MAX_SEASONS + 1)).toBeNull();
		expect(normalizeTotalSeasons(Number.NaN)).toBeNull();
	});
});
