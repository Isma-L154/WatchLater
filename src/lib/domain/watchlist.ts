import { isTrackable } from './progress';
import { getReleaseInfo, isUpcoming } from './release';
import type { MediaType } from '../types';

/**
 * Pure, framework-agnostic filtering and sorting for the watch-later list.
 * Extracted from the UI so it can be unit-tested in isolation.
 */

/** Minimal shape needed to filter/sort; structurally compatible with a DB row. */
export interface WatchlistEntry {
	title: string;
	mediaType: MediaType;
	watched: boolean;
	voteAverage: number | null;
	releaseDate: string | null;
	seasonsSeen: number;
	totalSeasons: number | null;
}

/** Current view options coming from the UI controls. */
export interface WatchlistView {
	/** 'all' | 'toWatch' | 'inProgress' | 'upcoming' | 'watched' */
	status: string;
	/** 'all' | 'movie' | 'tv' */
	type: string;
	/** 'recent' | 'rating' | 'title' | 'soonest' */
	sort: string;
	/** Free-text title filter. */
	query: string;
}

/**
 * Apply the status/type/search filters and then the chosen sort.
 *
 * The `recent` sort intentionally preserves the input order (the DB already
 * returns rows newest-first), so callers don't need an explicit timestamp here.
 * `now` is injectable purely so the release-date logic stays deterministic
 * under test.
 */
export function applyWatchlistView<T extends WatchlistEntry>(
	items: readonly T[],
	view: WatchlistView,
	now: Date = new Date()
): T[] {
	const query = view.query.trim().toLowerCase();

	const filtered = items.filter((item) => {
		const matchesStatus =
			view.status === 'all' ||
			(view.status === 'toWatch' && !item.watched) ||
			(view.status === 'watched' && item.watched) ||
			(view.status === 'upcoming' && isUpcoming(item.releaseDate, now)) ||
			(view.status === 'inProgress' && isInProgress(item));
		const matchesType = view.type === 'all' || item.mediaType === view.type;
		const matchesQuery = query === '' || item.title.toLowerCase().includes(query);
		return matchesStatus && matchesType && matchesQuery;
	});

	const sorted = [...filtered];
	if (view.sort === 'rating') {
		// Highest rated first; missing ratings sink to the bottom.
		sorted.sort((a, b) => (b.voteAverage ?? -1) - (a.voteAverage ?? -1));
	} else if (view.sort === 'title') {
		sorted.sort((a, b) => a.title.localeCompare(b.title));
	} else if (view.sort === 'soonest') {
		// Nearest release first; already-released and undated titles go last.
		sorted.sort((a, b) => releaseSortKey(a, now) - releaseSortKey(b, now));
	}
	return sorted;
}

/** A show that has been started but not finished — "what was I in the middle of?" */
export function isInProgress(item: WatchlistEntry): boolean {
	return isTrackable(item) && item.seasonsSeen > 0 && !item.watched;
}

/** Count how many entries are in each status bucket (for the tab badges). */
export function countByStatus(
	items: readonly WatchlistEntry[],
	now: Date = new Date()
): {
	all: number;
	toWatch: number;
	inProgress: number;
	upcoming: number;
	watched: number;
} {
	let watched = 0;
	let inProgress = 0;
	let upcoming = 0;
	for (const item of items) {
		if (item.watched) watched++;
		if (isInProgress(item)) inProgress++;
		if (isUpcoming(item.releaseDate, now)) upcoming++;
	}
	return { all: items.length, toWatch: items.length - watched, inProgress, upcoming, watched };
}

/** Sort key for "coming soon": days until release, or Infinity when not upcoming. */
function releaseSortKey(item: WatchlistEntry, now: Date): number {
	return getReleaseInfo(item.releaseDate, now).daysUntil ?? Number.POSITIVE_INFINITY;
}
