<script lang="ts">
	import type { Snippet } from 'svelte';
	import { posterUrl, releaseYear } from '$lib/tmdb-image';
	import { getReleaseInfo } from '$lib/release';
	import type { MediaType } from '$lib/types';

	interface Props {
		title: string;
		posterPath: string | null;
		releaseDate: string | null;
		voteAverage: number | null;
		mediaType: MediaType;
		/** Visually mark the card as already watched. */
		watched?: boolean;
		/** When provided, the poster and title become clickable to open details. */
		onSelect?: () => void;
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
		onSelect,
		actions
	}: Props = $props();

	const poster = $derived(posterUrl(posterPath, 'w342'));
	const year = $derived(releaseYear(releaseDate));
	const rating = $derived(voteAverage ? voteAverage.toFixed(1) : null);

	// TMDB returns titles that are still in production alongside released ones,
	// so the card has to be able to say "not out yet — here's when".
	const release = $derived(getReleaseInfo(releaseDate));
	const unreleased = $derived(release.state !== 'released');
</script>

<article
	class="group relative flex flex-col overflow-hidden rounded-2xl bg-slate-900/60 shadow-lg ring-1 shadow-black/20 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 hover:ring-sky-400/30
		{unreleased ? 'ring-amber-300/20' : 'ring-white/5'}"
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
			class="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-300 uppercase backdrop-blur"
		>
			{mediaType === 'tv' ? 'TV' : 'Movie'}
		</span>

		{#if rating}
			<span
				class="absolute top-2 right-2 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur"
			>
				★ {rating}
			</span>
		{/if}

		<!-- Release marker: a soft amber pulse reads as "pending" at a glance,
		     without competing with the poster art. -->
		{#if unreleased}
			<span
				class="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-slate-950/75 py-1 pr-2.5 pl-2 text-[10px] font-semibold tracking-wide text-amber-200 ring-1 ring-amber-300/25 backdrop-blur ring-inset"
			>
				<span class="sr-only">Not released yet —</span>
				<span class="relative flex h-1.5 w-1.5">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70"
					></span>
					<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300"></span>
				</span>
				{release.shortLabel}
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

		<!-- Transparent overlay button opens the detail view (kept last so it sits
		     on top of the badges/overlay). -->
		{#if onSelect}
			<button
				type="button"
				onclick={onSelect}
				aria-label={`View details for ${title}`}
				class="absolute inset-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
			></button>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1.5 p-3">
		{#if onSelect}
			<button
				type="button"
				onclick={onSelect}
				{title}
				class="line-clamp-2 text-left text-sm leading-snug font-semibold text-slate-100 transition hover:text-sky-300"
			>
				{title}
			</button>
		{:else}
			<h3 class="line-clamp-2 text-sm leading-snug font-semibold text-slate-100" {title}>
				{title}
			</h3>
		{/if}
		<!-- The poster badge carries the date; this line carries the meaning, so
		     an amber "Dec 16" can never be mistaken for an ordinary release year. -->
		{#if unreleased}
			<p class="text-xs font-medium text-amber-300/80">Not released yet</p>
		{:else if year}
			<p class="text-xs text-slate-500">{year}</p>
		{/if}
		{#if actions}<div class="mt-auto pt-1.5">{@render actions()}</div>{/if}
	</div>
</article>
