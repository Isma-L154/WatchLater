import { describe, expect, it } from 'vitest';
import {
	creditKey,
	FILMOGRAPHY_SIZE,
	isSubstantial,
	rankCredits,
	rankPeople,
	type CreditCandidate,
	type PersonCandidate
} from './filmography';

function credit(overrides: Partial<CreditCandidate> & { tmdbId: number }): CreditCandidate {
	return {
		mediaType: 'movie',
		posterPath: '/poster.jpg',
		voteCount: 100,
		popularity: 1,
		episodeCount: null,
		...overrides
	};
}

describe('isSubstantial', () => {
	it('keeps every film, however small', () => {
		expect(isSubstantial(credit({ tmdbId: 1, voteCount: 0 }))).toBe(true);
	});

	it('drops a one-episode guest spot', () => {
		expect(isSubstantial(credit({ tmdbId: 1, mediaType: 'tv', episodeCount: 1 }))).toBe(false);
	});

	it('keeps a recurring role', () => {
		expect(isSubstantial(credit({ tmdbId: 1, mediaType: 'tv', episodeCount: 2 }))).toBe(true);
	});

	it('keeps a show TMDB gave no episode count for', () => {
		expect(isSubstantial(credit({ tmdbId: 1, mediaType: 'tv', episodeCount: null }))).toBe(true);
	});
});

describe('rankCredits', () => {
	it('orders by how many people have rated the title', () => {
		const ranked = rankCredits(
			[
				credit({ tmdbId: 1, voteCount: 10 }),
				credit({ tmdbId: 2, voteCount: 900 }),
				credit({ tmdbId: 3, voteCount: 400 })
			],
			5
		);
		expect(ranked.map((c) => c.tmdbId)).toEqual([2, 3, 1]);
	});

	it('does not let this week beat the role they are known for', () => {
		const ranked = rankCredits(
			[
				credit({ tmdbId: 1, voteCount: 12, popularity: 980 }),
				credit({ tmdbId: 2, voteCount: 25_000, popularity: 4 })
			],
			5
		);
		expect(ranked[0].tmdbId).toBe(2);
	});

	it('falls back to popularity only when nobody has rated either', () => {
		const ranked = rankCredits(
			[
				credit({ tmdbId: 1, voteCount: 0, popularity: 3 }),
				credit({ tmdbId: 2, voteCount: 0, popularity: 60 })
			],
			5
		);
		expect(ranked.map((c) => c.tmdbId)).toEqual([2, 1]);
	});

	it('lists a recurring character once, not once per credited role', () => {
		const ranked = rankCredits(
			[
				credit({ tmdbId: 7, mediaType: 'tv', episodeCount: 30, voteCount: 500 }),
				credit({ tmdbId: 7, mediaType: 'tv', episodeCount: 12, voteCount: 500 }),
				credit({ tmdbId: 8, voteCount: 400 })
			],
			5
		);
		expect(ranked.map((c) => c.tmdbId)).toEqual([7, 8]);
	});

	it('treats a film and a series sharing an id as different titles', () => {
		const ranked = rankCredits(
			[
				credit({ tmdbId: 7, mediaType: 'movie', voteCount: 500 }),
				credit({ tmdbId: 7, mediaType: 'tv', voteCount: 400, episodeCount: 10 })
			],
			5
		);
		expect(ranked).toHaveLength(2);
	});

	it('drops titles with no artwork', () => {
		const ranked = rankCredits(
			[
				credit({ tmdbId: 1, posterPath: null, voteCount: 9000 }),
				credit({ tmdbId: 2, voteCount: 5 })
			],
			5
		);
		expect(ranked.map((c) => c.tmdbId)).toEqual([2]);
	});

	it('keeps only the requested number', () => {
		const credits = Array.from({ length: 20 }, (_, i) => credit({ tmdbId: i + 1, voteCount: i }));
		expect(rankCredits(credits, 5)).toHaveLength(5);
	});

	it('survives a person with nothing worth showing', () => {
		expect(rankCredits([credit({ tmdbId: 1, posterPath: null })], 5)).toEqual([]);
		expect(rankCredits([], 5)).toEqual([]);
	});

	it('leaves the caller a way to ask for nothing', () => {
		expect(rankCredits([credit({ tmdbId: 1 })], 0)).toEqual([]);
	});

	it('fills the panel even after the open title is dropped from it', () => {
		const credits = Array.from({ length: 30 }, (_, i) =>
			credit({ tmdbId: i + 1, voteCount: 1000 - i })
		);
		const fetched = rankCredits(credits, FILMOGRAPHY_SIZE + 1);
		const shown = fetched.filter((c) => creditKey(c) !== creditKey(fetched[0]));
		expect(shown).toHaveLength(FILMOGRAPHY_SIZE);
	});
});

describe('creditKey', () => {
	it('separates a film from a series that happens to share an id', () => {
		expect(creditKey({ tmdbId: 7, mediaType: 'movie' })).not.toBe(
			creditKey({ tmdbId: 7, mediaType: 'tv' })
		);
	});

	it('matches the same title however it was built', () => {
		expect(creditKey(credit({ tmdbId: 42 }))).toBe(creditKey({ tmdbId: 42, mediaType: 'movie' }));
	});
});

function person(overrides: Partial<PersonCandidate> & { id: number }): PersonCandidate {
	return { profilePath: '/face.jpg', popularity: 1, ...overrides };
}

describe('rankPeople', () => {
	it('leads with the one being looked for', () => {
		const ranked = rankPeople(
			[
				person({ id: 1, popularity: 2 }),
				person({ id: 2, popularity: 90 }),
				person({ id: 3, popularity: 40 })
			],
			8
		);
		expect(ranked.map((p) => p.id)).toEqual([2, 3, 1]);
	});

	it('drops the faceless crew entries that crowd a name out', () => {
		const ranked = rankPeople(
			[person({ id: 1, profilePath: null, popularity: 99 }), person({ id: 2, popularity: 1 })],
			8
		);
		expect(ranked.map((p) => p.id)).toEqual([2]);
	});

	it('lists a person once even when the index repeats them', () => {
		const ranked = rankPeople([person({ id: 5 }), person({ id: 5 }), person({ id: 6 })], 8);
		expect(ranked.map((p) => p.id)).toEqual([5, 6]);
	});

	it('keeps the strip short', () => {
		const people = Array.from({ length: 30 }, (_, i) => person({ id: i + 1, popularity: i }));
		expect(rankPeople(people, 8)).toHaveLength(8);
	});

	it('survives a query nobody matched', () => {
		expect(rankPeople([], 8)).toEqual([]);
	});
});
