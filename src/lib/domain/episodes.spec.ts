import { describe, expect, it } from 'vitest';
import {
	getEpisodePosition,
	previousEpisode,
	resolveEpisodeTarget,
	type EpisodeEntry
} from './episodes';

const show = (over: Partial<EpisodeEntry> = {}): EpisodeEntry => ({
	mediaType: 'tv',
	seasonsSeen: 0,
	episodesIntoSeason: 0,
	airedSeasons: 4,
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
