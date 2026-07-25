<script lang="ts">
	import type { Snippet } from 'svelte';
	import { posterUrl, releaseYear } from '$lib/tmdb-image';
	import type { MediaType } from '$lib/types';

	interface Props {
		title: string;
		posterPath: string | null;
		releaseDate: string | null;
		voteAverage: number | null;
		mediaType: MediaType;
		/** Visually de-emphasize the card (e.g. an item already marked as watched). */
		dimmed?: boolean;
		/** Action controls rendered in the card footer (buttons, forms, badges). */
		actions?: Snippet;
	}

	let {
		title,
		posterPath,
		releaseDate,
		voteAverage,
		mediaType,
		dimmed = false,
		actions
	}: Props = $props();

	const poster = $derived(posterUrl(posterPath, 'w342'));
	const year = $derived(releaseYear(releaseDate));
	const rating = $derived(voteAverage ? voteAverage.toFixed(1) : null);
</script>

<article
	class="flex flex-col overflow-hidden rounded-xl bg-slate-800/60 ring-1 ring-white/5 transition hover:ring-white/20"
	class:opacity-60={dimmed}
>
	<div class="relative aspect-[2/3] w-full bg-slate-700">
		{#if poster}
			<img src={poster} alt={`${title} poster`} loading="lazy" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center text-xs text-slate-500">
				No image
			</div>
		{/if}

		<span
			class="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300"
		>
			{mediaType}
		</span>

		{#if rating}
			<span
				class="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
			>
				★ {rating}
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-2 p-3">
		<h3 class="line-clamp-2 text-sm font-semibold text-slate-100" title={title}>{title}</h3>
		{#if year}<p class="text-xs text-slate-400">{year}</p>{/if}
		{#if actions}<div class="mt-auto pt-1">{@render actions()}</div>{/if}
	</div>
</article>
