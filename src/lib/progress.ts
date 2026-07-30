import type { MediaType } from './types';

/**
 * Season-level progress for TV shows, kept pure so it can be unit tested and
 * shared by the card, the detail modal and the server actions without any of
 * them re-deriving the rules.
 *
 * "Watched / not watched" is the whole truth for a film, but for a six-season
 * show it collapses "halfway through season 3" into a state that is simply
 * wrong. Progress is tracked per season — not per episode, which would mean an
 * extra request per season and a lot of tapping for precision nobody needs.
 */

export type ProgressState = 'notStarted' | 'inProgress' | 'complete';

/**
 * Sanity bound for a season count. TMDB's longest-running entries are an order
 * of magnitude below this; the limit exists to reject absurd stored values.
 */
export const MAX_SEASONS = 200;

/** The fields progress reasoning needs — structurally a subset of a DB row. */
export interface TrackableEntry {
	mediaType: MediaType;
	watched: boolean;
	seasonsSeen: number;
	totalSeasons: number | null;
}

export interface SeasonProgress {
	/** False for movies, and for shows whose season count we don't know yet. */
	trackable: boolean;
	seasonsSeen: number;
	totalSeasons: number;
	/** Completion as 0–100, for the progress bar. */
	percent: number;
	state: ProgressState;
	/** Human-readable summary, e.g. "Season 3 of 5". */
	label: string;
}

/**
 * Season tracking only earns its extra UI on multi-season shows. A stepper that
 * goes from 0 to 1 is pure friction, so single-season shows (and shows whose
 * count TMDB hasn't given us yet) keep the plain watched toggle.
 */
export function isTrackable(entry: TrackableEntry): boolean {
	return entry.mediaType === 'tv' && entry.totalSeasons !== null && entry.totalSeasons > 1;
}

export function getSeasonProgress(entry: TrackableEntry): SeasonProgress {
	if (!isTrackable(entry)) {
		return {
			trackable: false,
			seasonsSeen: 0,
			totalSeasons: 0,
			percent: entry.watched ? 100 : 0,
			state: entry.watched ? 'complete' : 'notStarted',
			label: ''
		};
	}

	const totalSeasons = entry.totalSeasons as number;
	const seasonsSeen = clampSeasons(entry.seasonsSeen, totalSeasons);
	const state: ProgressState =
		seasonsSeen === 0 ? 'notStarted' : seasonsSeen >= totalSeasons ? 'complete' : 'inProgress';

	return {
		trackable: true,
		seasonsSeen,
		totalSeasons,
		percent: Math.round((seasonsSeen / totalSeasons) * 100),
		state,
		label:
			state === 'notStarted'
				? 'Not started'
				: state === 'complete'
					? `All ${totalSeasons} seasons`
					: `Season ${seasonsSeen} of ${totalSeasons}`
	};
}

/**
 * The invariant tying progress to status: finishing the last season marks the
 * show as watched, and stepping back from it un-marks it.
 *
 * Enforced on the server for every write, never only in the UI, so a stale tab
 * or a replayed form post cannot leave the two disagreeing.
 */
export function deriveWatched(seasonsSeen: number, totalSeasons: number | null): boolean {
	return totalSeasons !== null && totalSeasons > 0 && seasonsSeen >= totalSeasons;
}

/** Constrain a season target to `0..totalSeasons`, rejecting junk input. */
export function clampSeasons(value: number, totalSeasons: number | null): number {
	if (!Number.isFinite(value)) return 0;
	const upperBound = Math.min(totalSeasons ?? 0, MAX_SEASONS);
	return Math.max(0, Math.min(Math.trunc(value), upperBound));
}

/**
 * Validate a season count coming from TMDB before it is stored.
 * Anything out of range is treated as "unknown" rather than persisted.
 */
export function normalizeTotalSeasons(value: number | null | undefined): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const total = Math.trunc(value);
	return total >= 1 && total <= MAX_SEASONS ? total : null;
}
