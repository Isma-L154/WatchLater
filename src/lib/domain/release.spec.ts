import { describe, expect, it } from 'vitest';
import { getReleaseInfo, isUpcoming, releaseVerb } from './release';

// Fixed "today" so every assertion is deterministic regardless of when CI runs.
const now = new Date('2026-07-29T12:00:00Z');

describe('getReleaseInfo — state', () => {
	it('treats a past date as released', () => {
		expect(getReleaseInfo('1999-03-31', now).state).toBe('released');
	});

	it('treats today as released', () => {
		expect(getReleaseInfo('2026-07-29', now).state).toBe('released');
	});

	it('treats a future date as upcoming', () => {
		expect(getReleaseInfo('2026-08-14', now).state).toBe('upcoming');
	});

	it('treats a missing date as unscheduled', () => {
		expect(getReleaseInfo(null, now)).toMatchObject({ state: 'unscheduled', shortLabel: 'TBA' });
		expect(getReleaseInfo('', now).state).toBe('unscheduled');
	});

	it('treats a malformed or impossible date as unscheduled', () => {
		expect(getReleaseInfo('not-a-date', now).state).toBe('unscheduled');
		expect(getReleaseInfo('2026-02-31', now).state).toBe('unscheduled');
	});

	it('accepts a year-only date, anchored to January 1st', () => {
		expect(getReleaseInfo('2027', now).state).toBe('upcoming');
		expect(getReleaseInfo('2020', now).state).toBe('released');
	});
});

describe('getReleaseInfo — countdown', () => {
	it('counts whole days until release', () => {
		expect(getReleaseInfo('2026-08-14', now).daysUntil).toBe(16);
	});

	it('is null for released titles', () => {
		expect(getReleaseInfo('2020-01-01', now).daysUntil).toBeNull();
	});

	it('ignores the time of day, so "tomorrow" stays tomorrow all day', () => {
		const lateAtNight = new Date('2026-07-29T23:59:00Z');
		expect(getReleaseInfo('2026-07-30', lateAtNight).daysUntil).toBe(1);
	});
});

describe('getReleaseInfo — labels', () => {
	it('says "Tomorrow" one day out', () => {
		expect(getReleaseInfo('2026-07-30', now).shortLabel).toBe('Tomorrow');
	});

	it('counts down within the next week', () => {
		expect(getReleaseInfo('2026-08-03', now).shortLabel).toBe('In 5 days');
	});

	it('drops the year for a date later this year', () => {
		expect(getReleaseInfo('2026-08-14', now).shortLabel).toBe('Aug 14');
	});

	it('keeps the year for a date in a following year', () => {
		expect(getReleaseInfo('2027-01-15', now).shortLabel).toBe('Jan 15, 2027');
	});

	it('keeps the exact day even for distant releases', () => {
		expect(getReleaseInfo('2028-05-04', now).shortLabel).toBe('May 4, 2028');
	});

	it('never invents a day TMDB did not give — month-only dates stay month-only', () => {
		expect(getReleaseInfo('2027-03', now).shortLabel).toBe('Mar 2027');
		expect(getReleaseInfo('2027-03', now).fullDate).toBe('March 2027');
	});

	it('never invents a day TMDB did not give — year-only dates stay year-only', () => {
		expect(getReleaseInfo('2029', now).shortLabel).toBe('2029');
		expect(getReleaseInfo('2029', now).fullDate).toBe('2029');
	});

	it('spells the date out in full for detail views', () => {
		expect(getReleaseInfo('2026-08-14', now).fullDate).toBe('Friday, August 14, 2026');
	});

	it('leaves the short label empty once released', () => {
		expect(getReleaseInfo('2020-01-01', now).shortLabel).toBe('');
	});
});

describe('isUpcoming', () => {
	it('is true only for confirmed future dates', () => {
		expect(isUpcoming('2026-12-25', now)).toBe(true);
		expect(isUpcoming('2020-12-25', now)).toBe(false);
		expect(isUpcoming(null, now)).toBe(false);
	});
});

describe('releaseVerb', () => {
	it('uses medium-appropriate wording', () => {
		expect(releaseVerb('movie')).toBe('In theaters');
		expect(releaseVerb('tv')).toBe('Premieres');
	});
});
