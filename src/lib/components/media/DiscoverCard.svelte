<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import MediaCard from './MediaCard.svelte';
	import type { MediaResult } from '$lib/types';

	/**
	 * A discoverable title (trending or search result) with its save control.
	 *
	 * The three states are mutually exclusive: sign in, already saved, or save —
	 * so the footer never shows an action that cannot succeed.
	 */
	interface Props {
		item: MediaResult;
		saved: boolean;
		signedIn: boolean;
		onSelect: () => void;
		onSubmit: SubmitFunction;
	}

	let { item, saved, signedIn, onSelect, onSubmit }: Props = $props();
</script>

<MediaCard
	title={item.title}
	posterPath={item.posterPath}
	releaseDate={item.releaseDate}
	voteAverage={item.voteAverage}
	mediaType={item.mediaType}
	{onSelect}
>
	{#snippet actions()}
		{#if !signedIn}
			<a
				href={resolve('/auth/google')}
				data-sveltekit-reload
				class="block w-full rounded-lg bg-white/5 py-2 text-center text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
			>
				Sign in to save
			</a>
		{:else if saved}
			<span
				class="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-400"
			>
				✓ In your list
			</span>
		{:else}
			<form method="POST" action="?/add" use:enhance={onSubmit}>
				<input type="hidden" name="tmdbId" value={item.tmdbId} />
				<input type="hidden" name="mediaType" value={item.mediaType} />
				<input type="hidden" name="title" value={item.title} />
				<input type="hidden" name="posterPath" value={item.posterPath ?? ''} />
				<input type="hidden" name="releaseDate" value={item.releaseDate ?? ''} />
				<input type="hidden" name="overview" value={item.overview ?? ''} />
				<input type="hidden" name="voteAverage" value={item.voteAverage ?? ''} />
				<button
					type="submit"
					class="w-full rounded-lg bg-sky-500 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 active:scale-95"
				>
					+ Watch Later
				</button>
			</form>
		{/if}
	{/snippet}
</MediaCard>
