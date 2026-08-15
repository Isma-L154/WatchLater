<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { formatRuntime, posterUrl, releaseYear } from '$lib/format/tmdb-image';
	import type { MediaDetails } from '$lib/types';

	/**
	 * Poster, title and the one-line summary of what this is.
	 *
	 * Pulled up over the artwork by its container, which is why the text column
	 * carries top padding: the poster overlaps the image above, the words must
	 * not.
	 */
	interface Props {
		details: MediaDetails;
	}

	let { details }: Props = $props();

	const poster = $derived(posterUrl(details.posterPath, 'w342'));

	/** Human-readable meta line: "2024 · 3 seasons · 1h 58m". */
	const meta = $derived.by(() => {
		const parts: string[] = [];
		const year = releaseYear(details.releaseDate);
		if (year) parts.push(year);
		if (details.mediaType === 'tv' && details.seasons) {
			parts.push(`${details.seasons} season${details.seasons > 1 ? 's' : ''}`);
		}
		const runtime = formatRuntime(details.runtimeMinutes);
		if (runtime) parts.push(runtime);
		return parts.join(' · ');
	});
</script>

<div class="flex gap-4">
	{#if poster}
		<img
			src={poster}
			alt={`${details.title} poster`}
			class="h-36 w-24 flex-shrink-0 rounded-xl object-cover shadow-lg ring-1 ring-line sm:h-44 sm:w-28"
		/>
	{/if}
	<div class="min-w-0 flex-1 pt-14">
		<h2 class="font-display text-xl leading-tight font-extrabold text-ink sm:text-2xl">
			{details.title}
		</h2>
		{#if meta}<p class="mt-1 text-sm text-ink-muted">{meta}</p>{/if}
		{#if details.voteAverage}
			<p class="mt-1.5 flex items-center gap-1 text-sm font-bold text-gold">
				<Icon name="star" size={14} filled />
				{details.voteAverage.toFixed(1)}
			</p>
		{/if}
	</div>
</div>
