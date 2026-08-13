import { describe, expect, it } from 'vitest';
import {
	daysUntilArchive,
	isArchivable,
	isDueForArchive,
	normalizeArchiveWindow,
	shouldWarnAboutArchive,
	type ArchivableEntry
} from './archive';

const now = new Date('2026-08-12T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const entry = (over: Partial<ArchivableEntry> = {}): ArchivableEntry => ({
	mediaType: 'movie',
	releaseDate: '2010-01-01',
	nextSeasonNumber: null,
	nextSeasonAirDate: null,
	watched: true,
	watchedAt: daysAgo(40),
	archivedAt: null,
	...over
});

describe('isArchivable', () => {
	it('accepts a watched film', () => {
		expect(isArchivable(entry(), now)).toBe(true);
	});

	it('ignores anything not watched', () => {
		expect(isArchivable(entry({ watched: false }), now)).toBe(false);
	});

	it('ignores what is already archived', () => {
		expect(isArchivable(entry({ archivedAt: daysAgo(1) }), now)).toBe(false);
	});

	// Rows watched before the column existed have no clock to measure from.
	it('ignores entries with no watched timestamp', () => {
		expect(isArchivable(entry({ watchedAt: null }), now)).toBe(false);
	});

	/**
	 * The exclusion the whole design hangs on. Being caught up marks a running
	 * series watched, so without this the app would archive a show weeks before
	 * the season the viewer was waiting for.
	 */
	it('never touches a show with a season still to come', () => {
		expect(
			isArchivable(
				entry({ mediaType: 'tv', nextSeasonNumber: 23, nextSeasonAirDate: '2026-10-15' }),
				now
			)
		).toBe(false);
	});

	it('never touches a show whose next season has no date yet', () => {
		expect(
			isArchivable(entry({ mediaType: 'tv', nextSeasonNumber: 4, nextSeasonAirDate: null }), now)
		).toBe(false);
	});

	it('accepts a finished show with nothing pending', () => {
		expect(isArchivable(entry({ mediaType: 'tv' }), now)).toBe(true);
	});

	it('never touches an unreleased title', () => {
		expect(isArchivable(entry({ releaseDate: '2027-01-01' }), now)).toBe(false);
	});
});

describe('daysUntilArchive', () => {
	it('is null when the feature is off', () => {
		expect(daysUntilArchive(entry(), null, now)).toBeNull();
	});

	it('counts down from the watched date', () => {
		expect(daysUntilArchive(entry({ watchedAt: daysAgo(0) }), 30, now)).toBe(30);
		expect(daysUntilArchive(entry({ watchedAt: daysAgo(28) }), 30, now)).toBe(2);
	});

	it('floors at zero once overdue', () => {
		expect(daysUntilArchive(entry({ watchedAt: daysAgo(45) }), 30, now)).toBe(0);
	});

	it('is null for anything the rules exclude', () => {
		expect(daysUntilArchive(entry({ watched: false }), 30, now)).toBeNull();
	});
});

describe('isDueForArchive', () => {
	it('is false before the window elapses and true after', () => {
		expect(isDueForArchive(entry({ watchedAt: daysAgo(29) }), 30, now)).toBe(false);
		expect(isDueForArchive(entry({ watchedAt: daysAgo(30) }), 30, now)).toBe(true);
	});

	it('is never true while the feature is off', () => {
		expect(isDueForArchive(entry({ watchedAt: daysAgo(999) }), null, now)).toBe(false);
	});

	// The safety property, restated as a test because it is the one that matters.
	it('is never true for a show with a pending season, however old', () => {
		expect(
			isDueForArchive(
				entry({
					mediaType: 'tv',
					watchedAt: daysAgo(999),
					nextSeasonNumber: 9,
					nextSeasonAirDate: '2027-01-01'
				}),
				7,
				now
			)
		).toBe(false);
	});
});

describe('shouldWarnAboutArchive', () => {
	it('warns only inside the final week', () => {
		expect(shouldWarnAboutArchive(entry({ watchedAt: daysAgo(20) }), 30, now)).toBe(false);
		expect(shouldWarnAboutArchive(entry({ watchedAt: daysAgo(25) }), 30, now)).toBe(true);
	});
});

describe('normalizeArchiveWindow', () => {
	it('accepts the offered windows', () => {
		expect(normalizeArchiveWindow(7)).toBe(7);
		expect(normalizeArchiveWindow('30')).toBe(30);
		expect(normalizeArchiveWindow(90)).toBe(90);
	});

	it('rejects anything else, falling back to off', () => {
		expect(normalizeArchiveWindow(1)).toBeNull();
		expect(normalizeArchiveWindow(0)).toBeNull();
		expect(normalizeArchiveWindow(-30)).toBeNull();
		expect(normalizeArchiveWindow('soon')).toBeNull();
		expect(normalizeArchiveWindow(null)).toBeNull();
	});
});
