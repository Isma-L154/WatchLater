<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { MediaDetails, SavedEntry } from '$lib/types';

	/**
	 * The one action the sheet exists to offer, in whichever of its three states
	 * applies. They are mutually exclusive on purpose: the footer never shows a
	 * control that cannot succeed.
	 *
	 * The whole snapshot is posted rather than an id alone, so the list renders
	 * from its own row and never needs TMDB to draw a card.
	 */
	interface Props {
		details: MediaDetails;
		/** The saved row when this title is already on the list, otherwise null. */
		saved: SavedEntry | null;
		signedIn: boolean;
	}

	let { details, saved, signedIn }: Props = $props();

	/**
	 * The title is read at submit time, not after the await: completing a season
	 * makes the sheet refetch, and by the time the response lands the details this
	 * is derived from may be gone.
	 */
	const withToast = (message: string, type: 'success' | 'info' = 'success'): SubmitFunction => {
		const text = message;
		return () =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') toasts.add(text, type);
				else if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
			};
	};
</script>

<div class="mt-6">
	{#if !signedIn}
		<GoogleButton size="full" label="Sign in to save this" />
	{:else if saved}
		<form
			method="POST"
			action="?/remove"
			use:enhance={withToast(`Removed “${details.title}”`, 'info')}
		>
			<input type="hidden" name="id" value={saved.id} />
			<button
				type="submit"
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose/12 py-3 text-sm font-semibold text-rose transition-colors duration-200 hover:bg-rose/22"
			>
				<Icon name="trash" size={16} /> Remove from my list
			</button>
		</form>
	{:else}
		<form method="POST" action="?/add" use:enhance={withToast(`Added “${details.title}”`)}>
			<input type="hidden" name="tmdbId" value={details.tmdbId} />
			<input type="hidden" name="mediaType" value={details.mediaType} />
			<input type="hidden" name="title" value={details.title} />
			<input type="hidden" name="posterPath" value={details.posterPath ?? ''} />
			<input type="hidden" name="releaseDate" value={details.releaseDate ?? ''} />
			<input type="hidden" name="overview" value={details.overview ?? ''} />
			<input type="hidden" name="voteAverage" value={details.voteAverage ?? ''} />
			<button
				type="submit"
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors duration-200 hover:bg-brand-hi"
			>
				<Icon name="plus" size={16} stroke={2.5} /> Save to my list
			</button>
		</form>
	{/if}
</div>
