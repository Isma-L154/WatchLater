import { hasUpcoming, type UpcomingEntry } from './upcoming';

/**
 * Auto-archiving watched titles.
 *
 * The problem is a "Watched" tab that only ever grows. The solution is *not*
 * deletion: hiding a finished title and destroying it produce the same tidy
 * list, and only one of them is recoverable when the rule gets it wrong. So
 * expired entries move to an archived state, out of every normal view, and can
 * be restored with one tap.
 *
 * Everything here is pure so the rules can be tested without a database — which
 * matters more than usual, because the cost of a wrong rule is someone's list
 * quietly emptying itself.
 */

/** Windows offered in the UI. Null is "never", and it is the default. */
export const ARCHIVE_WINDOWS = [7, 30, 90] as const;
export type ArchiveWindow = (typeof ARCHIVE_WINDOWS)[number];

const MS_PER_DAY = 86_400_000;

/** The fields the rules need — structurally a subset of a watchlist row. */
export interface ArchivableEntry extends UpcomingEntry {
	watched: boolean;
	watchedAt: Date | null;
	archivedAt: Date | null;
}

/** Validate a stored or submitted window, rejecting anything unexpected. */
export function normalizeArchiveWindow(value: unknown): ArchiveWindow | null {
	const days = Number(value);
	return (ARCHIVE_WINDOWS as readonly number[]).includes(days) ? (days as ArchiveWindow) : null;
}

/**
 * Whether this entry is the *kind* of thing auto-archiving may ever touch,
 * ignoring how long ago it was watched.
 *
 * The exclusion that matters is a show with a season still to come. Being caught
 * up on a running series marks it watched, so a naive rule would archive it
 * weeks before the thing you were waiting for arrives — removing the title
 * precisely when it was about to become interesting. Anything pending is off
 * limits; only finished shows and films qualify.
 */
export function isArchivable(entry: ArchivableEntry, now: Date = new Date()): boolean {
	if (!entry.watched || entry.archivedAt !== null) return false;
	if (entry.watchedAt === null) return false;
	return !hasUpcoming(entry, now);
}

/**
 * Days left before this entry is archived, or null when it is not on the clock.
 *
 * Rounded up, so "1 day" means "some time tomorrow" rather than a countdown that
 * reads zero for most of its final day. Zero means it is due now.
 */
export function daysUntilArchive(
	entry: ArchivableEntry,
	window: ArchiveWindow | null,
	now: Date = new Date()
): number | null {
	if (window === null || !isArchivable(entry, now)) return null;

	const elapsed = now.getTime() - (entry.watchedAt as Date).getTime();
	return Math.max(0, Math.ceil((window * MS_PER_DAY - elapsed) / MS_PER_DAY));
}

/** Whether the window has fully elapsed for this entry. */
export function isDueForArchive(
	entry: ArchivableEntry,
	window: ArchiveWindow | null,
	now: Date = new Date()
): boolean {
	if (window === null || !isArchivable(entry, now)) return false;
	return now.getTime() - (entry.watchedAt as Date).getTime() >= window * MS_PER_DAY;
}

/**
 * How close to expiry an entry has to be before the card warns about it.
 *
 * Nothing should vanish unannounced, but a countdown on something with two
 * months left is noise — it would sit on every card permanently and stop being
 * read. A week is long enough to notice and act.
 */
export const ARCHIVE_WARNING_DAYS = 7;

export function shouldWarnAboutArchive(
	entry: ArchivableEntry,
	window: ArchiveWindow | null,
	now: Date = new Date()
): boolean {
	const days = daysUntilArchive(entry, window, now);
	return days !== null && days <= ARCHIVE_WARNING_DAYS;
}
