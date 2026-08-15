<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import ModalSheet from '$lib/components/ui/ModalSheet.svelte';
	import DetailArtwork from './DetailArtwork.svelte';
	import DetailHeading from './DetailHeading.svelte';
	import ReleaseBanner from './ReleaseBanner.svelte';
	import SeasonPicker from './SeasonPicker.svelte';
	import EpisodePicker from './EpisodePicker.svelte';
	import WatchProviders from './WatchProviders.svelte';
	import SaveControl from './SaveControl.svelte';
	import CastRow from './CastRow.svelte';
	import { getEpisodePosition } from '$lib/domain/episodes';
	import { MediaDetailsRequest } from '$lib/stores/details.svelte';
	import type { MediaType, SavedEntry } from '$lib/types';

	/**
	 * Everything known about one title, and the things you can do to it.
	 *
	 * This file is composition and nothing else. The fetch lives in a store, the
	 * dialog behaviour in `ModalSheet`, and each band of the sheet in its own
	 * component — the order they appear in below is the argument this file makes:
	 * progress first, because for a show you are watching that is why the sheet
	 * was opened; the synopsis is not.
	 */
	interface Props {
		tmdbId: number;
		mediaType: MediaType;
		/** The saved row when this title is already on the list, otherwise null. */
		saved: SavedEntry | null;
		/** Saving requires an account; signed-out visitors get a sign-in prompt. */
		signedIn: boolean;
		/** ISO country for streaming availability, resolved at the edge. */
		country: string;
		onClose: () => void;
	}

	let { tmdbId, mediaType, saved, signedIn, country, onClose }: Props = $props();

	const request = new MediaDetailsRequest();

	/**
	 * Which season's episodes to request: the one in progress. Derived from the
	 * saved row rather than from the response, so the ask can be made in the same
	 * round-trip that fetches the details themselves.
	 */
	const position = $derived(
		saved && mediaType === 'tv'
			? getEpisodePosition({ mediaType, ...saved, episodesIntoSeason: saved.episodesIntoSeason })
			: null
	);

	const query = $derived({
		tmdbId,
		mediaType,
		country,
		season: position?.trackable ? position.season : null
	});

	// Refetch whenever the title, or the season being tracked, changes.
	$effect(() => {
		void request.load(query);
	});

	const details = $derived(request.details);
</script>

<ModalSheet label={details?.title ?? 'Title details'} {onClose}>
	{#if request.loading}
		<div class="flex h-72 items-center justify-center">
			<span
				class="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-hi"
				role="status"
				aria-label="Loading details"
			></span>
		</div>
	{:else if request.failed || !details}
		<div class="flex h-72 flex-col items-center justify-center gap-3 px-6 text-center">
			<Icon name="alert" size={28} class="text-ink-faint" />
			<p class="text-ink-muted">Couldn't load details.</p>
			<button
				type="button"
				onclick={() => request.load(query)}
				class="cursor-pointer rounded-lg bg-surface-hi px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line transition-colors duration-200 hover:bg-line"
			>
				Try again
			</button>
		</div>
	{:else}
		<DetailArtwork {details} />

		<!-- Pulled up over the artwork, which is why the heading carries its own
		     top padding rather than this container doing it. -->
		<div class="relative -mt-14 px-4 pb-8 sm:px-6">
			<DetailHeading {details} />
			<ReleaseBanner {details} />

			{#if saved && details.mediaType === 'tv' && details.airedSeasons && details.airedSeasons > 1}
				<SeasonPicker
					itemId={saved.id}
					title={details.title}
					airedSeasons={details.airedSeasons}
					totalSeasons={details.seasons ?? details.airedSeasons}
					upcomingSeason={details.upcomingSeason}
					seasonsSeen={saved.watched ? details.airedSeasons : saved.seasonsSeen}
				/>
			{/if}

			<!-- The season picker says which season; this says where inside it. -->
			{#if saved && position?.trackable && details.season}
				<EpisodePicker
					itemId={saved.id}
					title={details.title}
					season={details.season}
					episodesWatched={position.episodesWatched}
				/>
			{/if}

			{#if details.watch}
				<WatchProviders watch={details.watch} title={details.title} />
			{/if}

			{#if details.genres.length}
				<div class="mt-5 flex flex-wrap gap-2">
					{#each details.genres as genre (genre)}
						<span
							class="rounded-full bg-surface-hi px-3 py-1 text-xs font-medium text-ink-muted ring-1 ring-line"
						>
							{genre}
						</span>
					{/each}
				</div>
			{/if}

			{#if details.tagline}
				<p class="mt-4 text-sm text-ink-muted italic">“{details.tagline}”</p>
			{/if}

			{#if details.overview}
				<p class="mt-3 text-sm leading-relaxed text-ink-muted">{details.overview}</p>
			{/if}

			<SaveControl {details} {saved} {signedIn} />
			<CastRow cast={details.cast} />
		</div>
	{/if}
</ModalSheet>
