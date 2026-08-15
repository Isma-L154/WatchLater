import { describe, expect, it } from 'vitest';
import {
	getEpisodePosition,
	hasStarted,
	previousEpisode,
	progressNote,
	resolveEpisodeTarget,
	type EpisodeEntry,
	type ProgressEntry
} from './episodes';

const show = (over: Partial<EpisodeEntry> = {}): EpisodeEntry => ({
	mediaType: 'tv',
	seasonsSeen: 0,
	episodesIntoSeason: 0,
	airedSeasons: 4,
	...over
});

/** A show as the note sees it: season counters plus the watched flag. */
const noted = (over: Partial<ProgressEntry> = {}): ProgressEntry => ({
	...show(),
	watched: false,
	totalSeasons: 4,
	...over
});

describe('getEpisodePosition', () => {
	it('starts at S1E1', () => {
		expect(getEpisodePosition(show())).toMatchObject({
			season: 1,
			nextEpisode: 1,
			nextLabel: 'S1E1'
		});
	});

	it('reports the season after the last completed one', () => {
		expect(getEpisodePosition(show({ seasonsSeen: 2, episodesIntoSeason: 4 }))).toMatchObject({
			season: 3,
			episodesWatched: 4,
			nextLabel: 'S3E5'
		});
	});

	it('is not trackable for movies or unresolved shows', () => {
		expect(getEpisodePosition(show({ mediaType: 'movie' })).trackable).toBe(false);
		expect(getEpisodePosition(show({ airedSeasons: null })).trackable).toBe(false);
	});

	it('reports up to date once every aired season is finished', () => {
		const position = getEpisodePosition(show({ seasonsSeen: 4, episodesIntoSeason: 0 }));
		expect(position.upToDate).toBe(true);
		// Clamped to the last aired season rather than pointing one past the end.
		expect(position.season).toBe(4);
	});

	it('is not up to date part-way through the final aired season', () => {
		expect(getEpisodePosition(show({ seasonsSeen: 3, episodesIntoSeason: 2 })).upToDate).toBe(
			false
		);
	});

	// A stored count above what has aired means the show lost seasons on TMDB.
	it('clamps a season count beyond what has aired', () => {
		expect(getEpisodePosition(show({ seasonsSeen: 9, airedSeasons: 4 })).season).toBe(4);
	});
});

describe('resolveEpisodeTarget', () => {
	it('records progress inside a season', () => {
		expect(resolveEpisodeTarget(3, 4, 10, 10)).toEqual({ seasonsSeen: 2, episodesIntoSeason: 4 });
	});

	/**
	 * The invariant that keeps one position from having two encodings: finishing
	 * the last episode is stored as a completed season, not as "10 of 10".
	 */
	it('rolls a completed season into the season counter', () => {
		expect(resolveEpisodeTarget(3, 10, 10, 10)).toEqual({ seasonsSeen: 3, episodesIntoSeason: 0 });
	});

	it('never records an episode that has not aired', () => {
		// Season has 10 episodes but only 3 are out.
		expect(resolveEpisodeTarget(4, 8, 10, 3)).toEqual({ seasonsSeen: 3, episodesIntoSeason: 3 });
	});

	it('does not roll over when only part of the season has aired', () => {
		expect(resolveEpisodeTarget(4, 3, 10, 3)).toEqual({ seasonsSeen: 3, episodesIntoSeason: 3 });
	});

	it('floors at zero and truncates fractions', () => {
		expect(resolveEpisodeTarget(2, -5, 10, 10)).toEqual({ seasonsSeen: 1, episodesIntoSeason: 0 });
		expect(resolveEpisodeTarget(2, 3.9, 10, 10)).toEqual({ seasonsSeen: 1, episodesIntoSeason: 3 });
	});

	// Without a length there is no boundary to roll over at, so it holds instead
	// of inventing one.
	it('holds progress when the season length is unknown', () => {
		expect(resolveEpisodeTarget(2, 99, null, null)).toEqual({
			seasonsSeen: 1,
			episodesIntoSeason: 99
		});
	});
});

describe('previousEpisode', () => {
	const at = (seasonsSeen: number, episodesIntoSeason: number) =>
		getEpisodePosition(show({ seasonsSeen, episodesIntoSeason }));

	it('steps back within the season', () => {
		expect(previousEpisode(at(2, 4), 10)).toEqual({ seasonsSeen: 2, episodesIntoSeason: 3 });
	});

	it('crosses back into the previous season at its last episode', () => {
		expect(previousEpisode(at(2, 0), 8)).toEqual({ seasonsSeen: 1, episodesIntoSeason: 7 });
	});

	it('refuses to move before the very first episode', () => {
		expect(previousEpisode(at(0, 0), null)).toBeNull();
	});

	// Guessing the wrong episode silently is worse than not moving.
	it('refuses to cross back when the previous season length is unknown', () => {
		expect(previousEpisode(at(2, 0), null)).toBeNull();
	});
});

describe('hasStarted', () => {
	it('counts a part-watched season, not just completed ones', () => {
		expect(hasStarted(show({ seasonsSeen: 0, episodesIntoSeason: 0 }))).toBe(false);
		expect(hasStarted(show({ seasonsSeen: 0, episodesIntoSeason: 3 }))).toBe(true);
		expect(hasStarted(show({ seasonsSeen: 2, episodesIntoSeason: 0 }))).toBe(true);
	});
});

describe('progressNote', () => {
	it('names the next episode while a show is in progress', () => {
		expect(progressNote(noted({ seasonsSeen: 1, episodesIntoSeason: 4 }))).toBe('Next: S2E5');
	});

	// The rule the card, the rail and the discover tile now share, and used not to.
	it('gives every surface the same answer for the same show', () => {
		const entry = noted({
			seasonsSeen: 0,
			episodesIntoSeason: 6,
			totalSeasons: 3,
			airedSeasons: 3
		});
		expect(progressNote(entry)).toBe('Next: S1E7');
	});

	it('falls back to the season summary once there is no next episode', () => {
		expect(progressNote(noted({ seasonsSeen: 4, airedSeasons: 4, totalSeasons: 4 }))).toBe(
			'All 4 seasons'
		);
		expect(progressNote(noted({ seasonsSeen: 3, airedSeasons: 3, totalSeasons: 4 }))).toBe(
			'Caught up'
		);
	});

	it('says nothing about a film', () => {
		expect(
			progressNote(noted({ mediaType: 'movie', airedSeasons: null, totalSeasons: null }))
		).toBeUndefined();
	});

	// A single-season show keeps the plain watched toggle, but "where am I" is
	// still a fair question inside it.
	it('tracks episodes of a one-season show even though seasons are not tracked', () => {
		expect(
			progressNote(
				noted({ seasonsSeen: 0, episodesIntoSeason: 2, airedSeasons: 1, totalSeasons: 1 })
			)
		).toBe('Next: S1E3');
	});
});
