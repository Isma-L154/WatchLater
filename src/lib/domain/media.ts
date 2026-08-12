import type { MediaType } from '../types';

/**
 * Identity helpers for TMDB titles, kept pure so every view builds the same key
 * the same way.
 *
 * A TMDB id is only unique *within* a media type — movie 1399 and TV show 1399
 * are different titles — so nothing may key on the id alone.
 */

/** The minimum needed to identify a title; a superset of every result shape. */
export interface Identifiable {
	tmdbId: number;
	mediaType: MediaType;
}

/** Stable key for maps, sets and `{#each}` blocks: `"<tmdbId>:<mediaType>"`. */
export function mediaKey(item: Identifiable): string {
	return `${item.tmdbId}:${item.mediaType}`;
}

/**
 * Drop repeats, keeping the first occurrence of each title.
 *
 * Paged feeds need this because the source list is re-ranked between requests:
 * a title fetched on page 3 can slide up into a later re-fetch of page 1 and
 * arrive twice. Svelte keys grids by `mediaKey`, and a duplicate key is a hard
 * render error — so "first wins" is deliberate, keeping the freshest copy
 * (page 1) rather than the stale one.
 */
export function dedupeByKey<T extends Identifiable>(items: readonly T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];

	for (const item of items) {
		const key = mediaKey(item);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(item);
	}

	return unique;
}
