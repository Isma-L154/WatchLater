<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { posterUrl, releaseYear } from '$lib/tmdb-image';
	import { getReleaseInfo } from '$lib/domain/release';
	import type { MediaType } from '$lib/types';

	/**
	 * The poster tile every grid is built from.
	 *
	 * It owns the artwork, the badges and the title; what can be *done* with the
	 * title is passed in as a snippet, because that is the only thing that differs
	 * between Discover ("save it") and My List ("track it, drop it").
	 */
	interface Props {
		title: string;
		posterPath: string | null;
		releaseDate: string | null;
		voteAverage: number | null;
		mediaType: MediaType;
		/** Visually mark the tile as already watched. */
		watched?: boolean;
		/** Extra line under the title, e.g. season progress. */
		note?: string;
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
		note,
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
	class="group relative flex flex-col overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 shadow-black/20 transition duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40
		{unreleased ? 'ring-amber/20 hover:ring-amber/40' : 'ring-line hover:ring-brand/40'}"
>
	<div class="relative aspect-[2/3] w-full overflow-hidden bg-surface-hi">
		{#if poster}
			<img
				src={poster}
				alt={`${title} poster`}
				loading="lazy"
				decoding="async"
				class="h-full w-full object-cover transition duration-500 ease-[var(--ease-out-soft)] group-hover:scale-105"
				class:grayscale={watched}
				class:opacity-50={watched}
			/>
		{:else}
			<div class="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-faint">
				<Icon name="image" size={28} stroke={1.5} />
				<span class="text-[11px]">No image</span>
			</div>
		{/if}

		<!-- Bottom fade so badges stay legible over any poster. -->
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-canvas/95 via-canvas/40 to-transparent"
		></div>

		<span
			class="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-[10px] font-bold tracking-wider text-ink uppercase backdrop-blur-sm"
		>
			<Icon name={mediaType === 'tv' ? 'tv' : 'film'} size={11} stroke={2.4} />
			{mediaType === 'tv' ? 'TV' : 'Film'}
		</span>

		{#if rating}
			<span
				class="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-[11px] font-bold text-gold backdrop-blur-sm"
			>
				<Icon name="star" size={11} filled />
				{rating}
			</span>
		{/if}

		<!-- Release marker: a soft amber pulse reads as "pending" at a glance,
		     without competing with the poster art. -->
		{#if unreleased}
			<span
				class="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-2.5 pl-2 text-[10px] font-semibold tracking-wide text-amber ring-1 ring-amber/25 backdrop-blur-sm ring-inset"
			>
				<span class="sr-only">Not released yet —</span>
				<span class="relative flex h-1.5 w-1.5">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-70"
					></span>
					<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber"></span>
				</span>
				{release.shortLabel}
			</span>
		{/if}

		{#if watched}
			<span class="pointer-events-none absolute inset-0 flex items-center justify-center">
				<span
					class="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-xs font-bold text-canvas shadow-lg"
				>
					<Icon name="check" size={13} stroke={3} /> Watched
				</span>
			</span>
		{/if}

		<!-- Transparent overlay button opens the detail view (kept last so it sits
		     on top of the badges and the overlay). -->
		{#if onSelect}
			<button
				type="button"
				onclick={onSelect}
				aria-label={`View details for ${title}`}
				class="absolute inset-0 cursor-pointer"
			></button>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1 p-3">
		{#if onSelect}
			<button
				type="button"
				onclick={onSelect}
				{title}
				class="line-clamp-2 cursor-pointer text-left text-sm leading-snug font-semibold text-ink transition-colors duration-200 hover:text-brand-hi"
			>
				{title}
			</button>
		{:else}
			<h3 class="line-clamp-2 text-sm leading-snug font-semibold text-ink" {title}>{title}</h3>
		{/if}

		<!-- The poster badge carries the date; this line carries the meaning, so
		     an amber "Dec 16" can never be mistaken for an ordinary release year. -->
		{#if unreleased}
			<p class="text-xs font-medium text-amber">Not released yet</p>
		{:else if note}
			<p class="text-xs text-ink-muted">{note}</p>
		{:else if year}
			<p class="text-xs text-ink-faint">{year}</p>
		{/if}

		{#if actions}<div class="mt-auto pt-2">{@render actions()}</div>{/if}
	</div>
</article>
