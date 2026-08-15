import type { MediaType } from '../types';

/**
 * Episode-level position within a series.
 *
 * This is a bookmark, not a checklist. Series are watched in order, so "where am
 * I" is one point on a line — two small integers rather than a row per episode.
 * Marking episode 7 while 4 is unwatched is not something the model can express,
 * and deliberately so: supporting it would cost a join table and a heavier query
 * on every list render, to describe a way almost nobody watches television.
 *
 * The position is stored as (`seasonsSeen`, `episodesIntoSeason`), reusing the
 * season counter that already drives caught-up, archiving and the upcoming view.
 * Season progress therefore stays exactly as correct as before; episodes only
 * add resolution inside the season in progress.
 */

/** The fields position reasoning needs — a subset of a watchlist row. */
export interface EpisodeEntry {
	mediaType: MediaType;
	seasonsSeen: number;
	episodesIntoSeason: number;
	airedSeasons: number | null;
}

export interface EpisodePosition {
	/** False for movies and for shows with no resolved season data. */
	trackable: boolean;
	/** The season currently in progress (1-based). */
	season: number;
	/** Episodes of that season already watched. */
	episodesWatched: number;
	/** The episode to watch next within `season`, 1-based. */
	nextEpisode: number;
	/** Compact label for the next thing to watch, e.g. "S3E5". */
	nextLabel: string;
	/** True when every aired season is finished and nothing is part-watched. */
	upToDate: boolean;
}

/**
 * Where the viewer is, and what comes next.
 *
 * `seasonsSeen` counts *completed* seasons, so the season in progress is always
 * the one after it. That keeps a single source of truth: there is no separate
 * "current season" field that could drift out of step with the season counter.
 */
export function getEpisodePosition(entry: EpisodeEntry): EpisodePosition {
	const aired = entry.airedSeasons;
	if (entry.mediaType !== 'tv' || aired === null || aired < 1) {
		return {
			trackable: false,
			season: 0,
			episodesWatched: 0,
			nextEpisode: 0,
			nextLabel: '',
			upToDate: false
		};
	}

	const seasonsSeen = Math.max(0, Math.min(entry.seasonsSeen, aired));
	const upToDate = seasonsSeen >= aired && entry.episodesIntoSeason === 0;
	// Clamped so a finished show reports its last season rather than one past it.
	const season = Math.min(seasonsSeen + 1, aired);
	const episodesWatched = upToDate ? 0 : Math.max(0, entry.episodesIntoSeason);

	return {
		trackable: true,
		season,
		episodesWatched,
		nextEpisode: episodesWatched + 1,
		nextLabel: `S${season}E${episodesWatched + 1}`,
		upToDate
	};
}

/** The result of advancing or rewinding, as absolute counters to store. */
export interface EpisodeTarget {
	seasonsSeen: number;
	episodesIntoSeason: number;
}

/**
 * Normalize a raw (season, episode) target into storable counters.
 *
 * "Watched through S3E10 of a ten-episode season" and "finished season 3" are
 * the same state, so completing a season rolls into `seasonsSeen` and resets the
 * episode counter. Without that, the same position would have two encodings and
 * every downstream rule would need to handle both.
 *
 * @param episodeCount  Episodes in `season`; when unknown the season cannot roll
 *                      over, so progress is held at the last episode instead of
 *                      guessing a boundary.
 * @param airedEpisodes Ceiling within `season`. Episodes that have not been
 *                      broadcast cannot be ticked off, the same rule seasons
 *                      already follow.
 */
export function resolveEpisodeTarget(
	season: number,
	episodesWatched: number,
	episodeCount: number | null,
	airedEpisodes: number | null
): EpisodeTarget {
	const priorSeasons = Math.max(0, season - 1);
	const ceiling = Math.min(
		episodeCount ?? Number.POSITIVE_INFINITY,
		airedEpisodes ?? Number.POSITIVE_INFINITY
	);

	const watched = Math.max(0, Math.min(Math.trunc(episodesWatched), ceiling));

	// A completed season is stored as a completed season, never as "n of n".
	if (episodeCount !== null && watched >= episodeCount) {
		return { seasonsSeen: priorSeasons + 1, episodesIntoSeason: 0 };
	}

	return { seasonsSeen: priorSeasons, episodesIntoSeason: watched };
}

/**
 * Step back one episode, crossing into the previous season when at its start.
 *
 * The previous season's length is needed to land on its final episode; without
 * it the step is refused rather than guessed, since landing on the wrong episode
 * silently is worse than not moving.
 */
export function previousEpisode(
	position: EpisodePosition,
	previousSeasonEpisodeCount: number | null
): EpisodeTarget | null {
	if (!position.trackable) return null;

	if (position.episodesWatched > 0) {
		return {
			seasonsSeen: position.season - 1,
			episodesIntoSeason: position.episodesWatched - 1
		};
	}

	if (position.season <= 1 || previousSeasonEpisodeCount === null) return null;

	return {
		seasonsSeen: position.season - 2,
		episodesIntoSeason: Math.max(0, previousSeasonEpisodeCount - 1)
	};
}
