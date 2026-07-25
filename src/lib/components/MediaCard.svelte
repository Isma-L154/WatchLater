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
		/** Visually mark the card as already watched. */
		watched?: boolean;
		/** Action controls rendered in the card footer (buttons, forms, badges). */
		actions?: Snippet;
	}

	let {
		title,
		posterPath,
		releaseDate,
		voteAverage,
		mediaType,
		watched = false,
		actions
	}: Props = $props();

	const poster = $derived(posterUrl(posterPath, 'w342'));
	const year = $derived(releaseYear(releaseDate));
	const rating = $derived(voteAverage ? voteAverage.toFixed(1) : null);
</script>

<article
	class="group relative flex flex-col overflow-hidden rounded-2xl bg-slate-900/60 shadow-lg shadow-black/20 ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 hover:ring-sky-400/30"
>
	<div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-800">
		{#if poster}
			<img
				src={poster}
				alt={`${title} poster`}
				loading="lazy"
				class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
				class:grayscale={watched}
				class:opacity-60={watched}
			/>
		{:else}
			<div class="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-600">
				<span class="text-3xl">🎞️</span>
				<span class="text-[11px]">No image</span>
			</div>
		{/if}

		<!-- Bottom fade so text/badges stay legible over any poster. -->
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/90 to-transparent"
		></div>

		<span
			class="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 backdrop-blur"
		>
			{mediaType === 'tv' ? 'TV' : 'Movie'}
		</span>

		{#if rating}
			<span
				class="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur"
			>
				★ {rating}
			</span>
		{/if}

		{#if watched}
			<span class="absolute inset-0 flex items-center justify-center">
				<span
					class="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg"
				>
					✓ Watched
				</span>
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1.5 p-3">
		<h3 class="line-clamp-2 text-sm font-semibold leading-snug text-slate-100" title={title}>
			{title}
		</h3>
		{#if year}<p class="text-xs text-slate-500">{year}</p>{/if}
		{#if actions}<div class="mt-auto pt-1.5">{@render actions()}</div>{/if}
	</div>
</article>
