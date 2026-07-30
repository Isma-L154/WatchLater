import type { MediaType } from '../types';

/**
 * Release-date reasoning, kept pure and framework-agnostic so it can be unit
 * tested and reused by every view.
 *
 * TMDB happily returns titles that are still in production, so the UI has to be
 * able to say "this isn't out yet, here's when it lands" instead of silently
 * showing a future year like any other.
 */

export type ReleaseState =
	/** Already out. */
	| 'released'
	/** Has a confirmed future date. */
	| 'upcoming'
	/** No date from TMDB at all — announced but unscheduled. */
	| 'unscheduled';

export interface ReleaseInfo {
	state: ReleaseState;
	/** Whole days from today until release; null unless `state === 'upcoming'`. */
	daysUntil: number | null;
	/** Compact badge text, e.g. "Tomorrow", "In 5 days", "Aug 14", "Mar 2027". */
	shortLabel: string;
	/** Full sentence for detail views, e.g. "Friday, August 14, 2026". */
	fullDate: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Classify a TMDB date string (`YYYY-MM-DD`, sometimes partial or empty).
 *
 * Dates are compared as calendar days in UTC rather than as instants: a film
 * released "on August 14" is out on August 14 everywhere, and anchoring both
 * sides to UTC midnight stops the countdown flickering by ±1 across time zones.
 */
export function getReleaseInfo(releaseDate: string | null, now: Date = new Date()): ReleaseInfo {
	const parsed = parseReleaseDate(releaseDate);
	if (parsed === null) {
		return { state: 'unscheduled', daysUntil: null, shortLabel: 'TBA', fullDate: '' };
	}

	const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	const daysUntil = Math.round((parsed.timestamp - todayUtc) / MS_PER_DAY);
	const date = new Date(parsed.timestamp);
	const fullDate = formatDate(date, parsed.precision, now.getFullYear(), true);

	if (daysUntil <= 0) {
		return { state: 'released', daysUntil: null, shortLabel: '', fullDate };
	}

	return {
		state: 'upcoming',
		daysUntil,
		shortLabel: formatShort(date, parsed.precision, daysUntil, now.getFullYear()),
		fullDate
	};
}

/** Convenience predicate for filtering and counting. */
export function isUpcoming(releaseDate: string | null, now: Date = new Date()): boolean {
	return getReleaseInfo(releaseDate, now).state === 'upcoming';
}

/**
 * Wording for the release line. Cinema releases and TV premieres are different
 * enough events that reusing one verb for both reads wrong.
 */
export function releaseVerb(mediaType: MediaType): string {
	return mediaType === 'tv' ? 'Premieres' : 'In theaters';
}

/** How specific the source date actually was. */
type DatePrecision = 'day' | 'month' | 'year';

interface ParsedDate {
	timestamp: number;
	precision: DatePrecision;
}

/**
 * Parse a TMDB date into a UTC timestamp, remembering how specific it was.
 *
 * Titles far from release are often listed with only a year or a month. Those
 * are anchored to the 1st so they can still be compared and sorted, but the
 * precision is tracked so the UI never invents a day that was never announced.
 */
function parseReleaseDate(value: string | null): ParsedDate | null {
	if (!value) return null;

	const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
	if (!match) return null;

	const year = Number(match[1]);
	const month = match[2] ? Number(match[2]) - 1 : 0;
	const day = match[3] ? Number(match[3]) : 1;

	const timestamp = Date.UTC(year, month, day);
	// Reject impossible dates like 2026-02-31, which Date.UTC would roll over.
	const parsed = new Date(timestamp);
	if (parsed.getUTCMonth() !== month || parsed.getUTCDate() !== day) return null;

	const precision: DatePrecision = match[3] ? 'day' : match[2] ? 'month' : 'year';
	return { timestamp, precision };
}

/**
 * Short label tuned to distance: within a week a countdown is more meaningful
 * than a date, beyond that the date itself is what people want to know.
 */
function formatShort(
	date: Date,
	precision: DatePrecision,
	daysUntil: number,
	currentYear: number
): string {
	if (daysUntil === 1) return 'Tomorrow';
	if (daysUntil <= 7 && precision === 'day') return `In ${daysUntil} days`;
	return formatDate(date, precision, currentYear, false);
}

/**
 * Render a date at the precision it was given, dropping the year when it is the
 * current one — "Aug 14" is less noisy than "Aug 14, 2026" and just as clear.
 */
function formatDate(
	date: Date,
	precision: DatePrecision,
	currentYear: number,
	long: boolean
): string {
	const year = date.getUTCFullYear() === currentYear ? undefined : ('numeric' as const);
	const month = long ? ('long' as const) : ('short' as const);

	if (precision === 'year') return String(date.getUTCFullYear());
	if (precision === 'month') return format(date, { month, year: 'numeric' });
	return format(date, {
		weekday: long ? 'long' : undefined,
		month,
		day: 'numeric',
		year: long ? 'numeric' : year
	});
}

function format(date: Date, options: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
}
