import type { MediaType } from './types';

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
}

/** Current view options coming from the UI controls. */
export interface WatchlistView {
	/** 'all' | 'toWatch' | 'watched' */
	status: string;
	/** 'all' | 'movie' | 'tv' */
	type: string;
	/** 'recent' | 'rating' | 'title' */
	sort: string;
	/** Free-text title filter. */
	query: string;
}

/**
 * Apply the status/type/search filters and then the chosen sort.
 * The `recent` sort intentionally preserves the input order (the DB already
 * returns rows newest-first), so callers don't need an explicit timestamp here.
 */
export function applyWatchlistView<T extends WatchlistEntry>(
	items: readonly T[],
	view: WatchlistView
): T[] {
	const query = view.query.trim().toLowerCase();

	const filtered = items.filter((item) => {
		const matchesStatus =
			view.status === 'all' ||
			(view.status === 'toWatch' && !item.watched) ||
			(view.status === 'watched' && item.watched);
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
	}
	return sorted;
}

/** Count how many entries are in each status bucket (for the tab badges). */
export function countByStatus(items: readonly WatchlistEntry[]): {
	all: number;
	toWatch: number;
	watched: number;
} {
	let watched = 0;
	for (const item of items) if (item.watched) watched++;
	return { all: items.length, toWatch: items.length - watched, watched };
}
