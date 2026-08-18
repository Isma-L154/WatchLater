import type { MediaType } from '$lib/types';

/**
 * Turning a person's full credit list into the handful of titles you would
 * actually recognise them from.
 *
 * TMDB's combined credits are a career, not a highlight reel: a working actor
 * has hundreds of entries, most of them one-episode guest spots, unreleased
 * projects and documentaries about themselves. Shown raw they answer the
 * opposite of the question being asked — "where do I know them from" needs the
 * five titles a viewer has heard of, not the five most recent.
 *
 * Kept out of the TMDB client so the ranking can be argued with in tests rather
 * than by opening the app and squinting at a panel.
 */

/**
 * How many titles the filmography panel shows.
 *
 * Small on purpose. The panel opens inside a sheet that is already about
 * something else — it answers "what else have I seen them in" and then gets out
 * of the way. A full career belongs on a page of its own, not folded into a
 * detail view.
 */
export const FILMOGRAPHY_SIZE = 5;

/**
 * Identity for a credit, so a panel can be asked to leave one out.
 *
 * The title the sheet is already open on is always the person's top credit here
 * — it is why their face is on the screen — and a panel whose first row is the
 * thing you are looking at wastes a fifth of itself saying nothing.
 */
export function creditKey(credit: Pick<CreditCandidate, 'tmdbId' | 'mediaType'>): string {
	return `${credit.mediaType}:${credit.tmdbId}`;
}

/** The fields ranking actually reads. Callers pass their own richer rows through. */
export interface CreditCandidate {
	tmdbId: number;
	mediaType: MediaType;
	posterPath: string | null;
	/** Total ratings cast. The proxy for "how many people have seen this". */
	voteCount: number;
	/** TMDB's current-attention score, used only to break ties. */
	popularity: number;
	/** TV only: how many episodes the person appeared in. */
	episodeCount: number | null;
}

/**
 * A guest appearance is not a credit worth showing.
 *
 * Combined credits make no distinction between a series regular and someone who
 * turned up in one episode of a procedural fifteen years ago — both are a row
 * with the show's name on it, and the show's own vote count, which is what makes
 * them outrank real roles. Two episodes is the cheapest line that separates
 * "was in it" from "walked past it"; TV credits with no episode count at all are
 * left alone, because absent is not the same as small.
 */
const MIN_EPISODES = 2;

export function isSubstantial(credit: CreditCandidate): boolean {
	if (credit.mediaType !== 'tv' || credit.episodeCount === null) return true;
	return credit.episodeCount >= MIN_EPISODES;
}

/**
 * Rank a person's credits and keep the best `limit` of them.
 *
 * Ordered by vote count rather than by popularity, deliberately. Popularity is a
 * measure of this week — it puts whatever the person is currently promoting
 * above the role they are famous for, which is the wrong answer to the question
 * the panel is opened to ask. Vote count is cumulative and so encodes durable
 * recognition; popularity survives only as the tiebreak between titles nobody
 * has rated.
 *
 * Titles with no poster are dropped rather than ranked. The panel is a strip of
 * artwork, and a placeholder tile carries no information at the size it renders
 * at — it costs a row and says nothing.
 *
 * Duplicates are collapsed first, not last: a recurring character is listed once
 * per credited role, and without this a panel of five can be the same show five
 * times.
 */
export function rankCredits<T extends CreditCandidate>(credits: T[], limit: number): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];

	for (const credit of credits) {
		if (!credit.posterPath || !isSubstantial(credit)) continue;
		const id = creditKey(credit);
		if (seen.has(id)) continue;
		seen.add(id);
		unique.push(credit);
	}

	return unique
		.sort((a, b) => b.voteCount - a.voteCount || b.popularity - a.popularity)
		.slice(0, Math.max(0, limit));
}
