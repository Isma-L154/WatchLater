import { describe, expect, it } from 'vitest';
import {
	getUpcomingInfo,
	groupByUpcomingWindow,
	hasUpcoming,
	upcomingSortKey,
	type UpcomingEntry
} from './upcoming';

/** Fixed "today" so none of these drift with the calendar. */
const now = new Date('2026-08-12T12:00:00Z');

const entry = (over: Partial<UpcomingEntry> = {}): UpcomingEntry => ({
	mediaType: 'tv',
	releaseDate: '2010-01-01',
	nextSeasonNumber: null,
	nextSeasonAirDate: null,
	...over
});

describe('getUpcomingInfo', () => {
	it('reports nothing for a released title with no pending season', () => {
		expect(getUpcomingInfo(entry(), now)).toBeNull();
	});

	it('reports an unreleased film by its release date', () => {
		const info = getUpcomingInfo(entry({ mediaType: 'movie', releaseDate: '2026-12-25' }), now);
		expect(info?.kind).toBe('release');
		expect(info?.daysUntil).toBe(135);
		expect(info?.seasonNumber).toBeNull();
	});

	/**
	 * The gap this module exists to close. A returning series first aired years
	 * ago, so judging by release date alone reported "nothing pending" for a show
	 * with a season two months out.
	 */
	it('reports a returning series by its next season', () => {
		const info = getUpcomingInfo(
			entry({ releaseDate: '2005-03-27', nextSeasonNumber: 23, nextSeasonAirDate: '2026-10-15' }),
			now
		);
		expect(info?.kind).toBe('season');
		expect(info?.seasonNumber).toBe(23);
		expect(info?.daysUntil).toBe(64);
	});

	// A show that has not premiered at all is waiting on its premiere, not on
	// "season 1" — otherwise the same event would be announced twice.
	it('prefers the title release over a pending season', () => {
		const info = getUpcomingInfo(
			entry({ releaseDate: '2026-09-01', nextSeasonNumber: 1, nextSeasonAirDate: '2026-09-01' }),
			now
		);
		expect(info?.kind).toBe('release');
	});

	it('reports an announced season with no date', () => {
		const info = getUpcomingInfo(entry({ nextSeasonNumber: 4, nextSeasonAirDate: null }), now);
		expect(info?.kind).toBe('season');
		expect(info?.date).toBeNull();
		expect(info?.daysUntil).toBeNull();
	});

	it('ignores a season whose air date has passed', () => {
		expect(
			getUpcomingInfo(entry({ nextSeasonNumber: 4, nextSeasonAirDate: '2026-08-01' }), now)
		).toBeNull();
	});

	it('never reports a pending season for a movie', () => {
		expect(
			getUpcomingInfo(
				entry({ mediaType: 'movie', nextSeasonNumber: 2, nextSeasonAirDate: '2027-01-01' }),
				now
			)
		).toBeNull();
	});
});

describe('hasUpcoming', () => {
	it('counts both kinds of pending title', () => {
		expect(hasUpcoming(entry({ mediaType: 'movie', releaseDate: '2027-01-01' }), now)).toBe(true);
		expect(hasUpcoming(entry({ nextSeasonNumber: 9, nextSeasonAirDate: '2026-10-01' }), now)).toBe(
			true
		);
		expect(hasUpcoming(entry(), now)).toBe(false);
	});

	// Announced-but-undated titles are not watchable, so they belong here rather
	// than lumped in with everything already out.
	it('includes announced titles with no date', () => {
		expect(hasUpcoming(entry({ nextSeasonNumber: 4, nextSeasonAirDate: null }), now)).toBe(true);
	});
});

describe('upcomingSortKey', () => {
	it('orders soonest first and sinks undated entries', () => {
		const soon = entry({ nextSeasonNumber: 2, nextSeasonAirDate: '2026-08-20' });
		const later = entry({ nextSeasonNumber: 2, nextSeasonAirDate: '2027-01-01' });
		const undated = entry({ nextSeasonNumber: 2, nextSeasonAirDate: null });

		expect(upcomingSortKey(soon, now)).toBeLessThan(upcomingSortKey(later, now));
		expect(upcomingSortKey(later, now)).toBeLessThan(upcomingSortKey(undated, now));
	});
});

describe('groupByUpcomingWindow', () => {
	const named = (title: string, over: Partial<UpcomingEntry>) => ({ title, ...entry(over) });

	it('buckets by how soon, and drops empty groups', () => {
		const groups = groupByUpcomingWindow(
			[
				named('next week', { nextSeasonNumber: 2, nextSeasonAirDate: '2026-08-16' }),
				named('next month', { nextSeasonNumber: 2, nextSeasonAirDate: '2026-09-05' }),
				named('far off', { nextSeasonNumber: 2, nextSeasonAirDate: '2027-06-01' }),
				named('no date', { nextSeasonNumber: 2, nextSeasonAirDate: null }),
				named('already out', {})
			],
			now
		);

		expect(groups.map((g) => g.window)).toEqual(['thisWeek', 'thisMonth', 'later', 'undated']);
		expect(groups.flatMap((g) => g.items.map((i) => i.item.title))).toEqual([
			'next week',
			'next month',
			'far off',
			'no date'
		]);
	});

	it('sorts within a bucket by how soon', () => {
		const groups = groupByUpcomingWindow(
			[
				named('later that month', { nextSeasonNumber: 2, nextSeasonAirDate: '2026-09-05' }),
				named('sooner', { nextSeasonNumber: 2, nextSeasonAirDate: '2026-08-25' })
			],
			now
		);

		expect(groups[0].items.map((i) => i.item.title)).toEqual(['sooner', 'later that month']);
	});

	it('returns nothing when there is nothing pending', () => {
		expect(groupByUpcomingWindow([entry()], now)).toEqual([]);
	});
});
