<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { backdropUrl } from '$lib/format/tmdb-image';
	import type { MediaDetails } from '$lib/types';

	/**
	 * The top of the detail sheet: artwork, or the trailer once it is asked for.
	 *
	 * The trailer replaces the backdrop rather than opening elsewhere, so the
	 * sheet keeps its shape and nothing below it moves.
	 *
	 * Separate from the heading below it because the two sit in different
	 * containers — this one spans the sheet, the heading is inset and pulled up
	 * over it.
	 */
	interface Props {
		details: MediaDetails;
	}

	let { details }: Props = $props();

	let showTrailer = $state(false);

	// A new title means a new sheet, but the same sheet can refetch when the
	// tracked season changes; the trailer should not survive that.
	$effect(() => {
		void details.tmdbId;
		showTrailer = false;
	});

	const backdrop = $derived(backdropUrl(details.backdropPath));
</script>

<div class="relative aspect-video w-full overflow-hidden bg-surface-hi">
	{#if showTrailer && details.trailerKey}
		<iframe
			class="h-full w-full"
			title={`${details.title} trailer`}
			src={`https://www.youtube-nocookie.com/embed/${details.trailerKey}?autoplay=1&rel=0`}
			allow="autoplay; encrypted-media; fullscreen"
			allowfullscreen
		></iframe>
	{:else}
		{#if backdrop}
			<img src={backdrop} alt="" class="h-full w-full object-cover" />
		{/if}
		<div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/45 to-transparent"></div>
		{#if details.trailerKey}
			<button
				type="button"
				onclick={() => (showTrailer = true)}
				class="absolute inset-0 flex cursor-pointer items-center justify-center"
				aria-label={`Play the ${details.title} trailer`}
			>
				<span
					class="flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors duration-200 hover:bg-white/25"
				>
					<Icon name="play" size={16} filled /> Play trailer
				</span>
			</button>
		{/if}
	{/if}
</div>
