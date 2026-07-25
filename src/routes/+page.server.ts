import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { watchlistItem } from '$lib/server/db/schema';
import { getTrending } from '$lib/server/tmdb';
import type { MediaResult, MediaType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/**
 * Load the watch-later list (newest first) plus this week's trending titles.
 * Trending failures are non-fatal — the page still works without them.
 */
export const load: PageServerLoad = async () => {
	const items = await db.select().from(watchlistItem).orderBy(desc(watchlistItem.addedAt));

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
	add: async ({ request }) => {
		const form = await request.formData();
		const tmdbId = Number(form.get('tmdbId'));
		const mediaType = String(form.get('mediaType') ?? '') as MediaType;
		const title = String(form.get('title') ?? '').trim();

		if (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv') || !title) {
			return fail(400, { message: 'Invalid item data.' });
		}

		const rating = form.get('voteAverage');
		await db
			.insert(watchlistItem)
			.values({
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
	remove: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'Missing id.' });

		await db.delete(watchlistItem).where(eq(watchlistItem.id, id));
		return { removed: true };
	},

	/** Toggle the watched/unwatched state of an item. */
	toggleWatched: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const currentlyWatched = form.get('watched') === 'true';
		if (!id) return fail(400, { message: 'Missing id.' });

		await db
			.update(watchlistItem)
			.set({ watched: !currentlyWatched })
			.where(eq(watchlistItem.id, id));
		return { toggled: true };
	}
};

/** Normalize empty/whitespace form values to null for nullable columns. */
function emptyToNull(value: FormDataEntryValue | null): string | null {
	const text = value == null ? '' : String(value).trim();
	return text === '' ? null : text;
}
