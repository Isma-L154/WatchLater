import { fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { watchlistItem } from '$lib/server/db/schema';
import { getTrending } from '$lib/server/tmdb';
import type { MediaResult, MediaType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/** Returned by every action when the caller has no session. */
const UNAUTHENTICATED = { message: 'Please sign in first.' };

/**
 * Load the signed-in user's watch-later list (newest first) plus this week's
 * trending titles.
 *
 * Trending is public — browsing works signed out — but the list is not: with no
 * session we return an empty array rather than querying at all.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const items = locals.user
		? await getDb()
				.select()
				.from(watchlistItem)
				.where(eq(watchlistItem.userId, locals.user.id))
				.orderBy(desc(watchlistItem.addedAt))
		: [];

	let trending: MediaResult[] = [];
	try {
		trending = await getTrending();
	} catch (err) {
		console.error('Failed to load trending titles:', err);
	}

	return { items, trending };
};

export const actions: Actions = {
	/** Save a movie/TV show. Duplicates are silently ignored via the unique index. */
	add: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const tmdbId = Number(form.get('tmdbId'));
		const mediaType = String(form.get('mediaType') ?? '') as MediaType;
		const title = String(form.get('title') ?? '').trim();

		if (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv') || !title) {
			return fail(400, { message: 'Invalid item data.' });
		}

		const rating = form.get('voteAverage');
		await getDb()
			.insert(watchlistItem)
			.values({
				userId: locals.user.id,
				tmdbId,
				mediaType,
				title,
				posterPath: emptyToNull(form.get('posterPath')),
				releaseDate: emptyToNull(form.get('releaseDate')),
				overview: emptyToNull(form.get('overview')),
				voteAverage: rating ? Number(rating) : null
			})
			.onConflictDoNothing();

		return { added: true };
	},

	/** Remove an item from the list. */
	remove: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'Missing id.' });

		await getDb().delete(watchlistItem).where(ownedRow(id, locals.user.id));
		return { removed: true };
	},

	/** Toggle the watched/unwatched state of an item. */
	toggleWatched: async ({ request, locals }) => {
		if (!locals.user) return fail(401, UNAUTHENTICATED);

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const currentlyWatched = form.get('watched') === 'true';
		if (!id) return fail(400, { message: 'Missing id.' });

		await getDb()
			.update(watchlistItem)
			.set({ watched: !currentlyWatched })
			.where(ownedRow(id, locals.user.id));
		return { toggled: true };
	}
};

/**
 * Match a row by id *and* owner.
 *
 * The id alone would be enough to find the row, which is exactly the problem:
 * item ids travel through the browser as form fields, so every mutation is
 * scoped by the session's user id as well. Someone else's id simply matches
 * nothing.
 */
function ownedRow(id: string, userId: string) {
	return and(eq(watchlistItem.id, id), eq(watchlistItem.userId, userId));
}

/** Normalize empty/whitespace form values to null for nullable columns. */
function emptyToNull(value: FormDataEntryValue | null): string | null {
	const text = value == null ? '' : String(value).trim();
	return text === '' ? null : text;
}
