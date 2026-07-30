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
