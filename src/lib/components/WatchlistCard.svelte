<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import MediaCard from './MediaCard.svelte';
	import SeasonStepper from './SeasonStepper.svelte';
	import { getSeasonProgress } from '$lib/progress';
	import { getReleaseInfo } from '$lib/release';
	import type { WatchlistItem } from '$lib/server/db/schema';

	/**
	 * A saved title with its controls.
	 *
	 * Multi-season shows get the season counter instead of the binary toggle —
	 * completing the counter is what marks them as watched.
	 */
	interface Props {
		item: WatchlistItem;
		onSelect: () => void;
		onToggle: SubmitFunction;
		onSetSeasons: SubmitFunction;
		onRemove: SubmitFunction;
	}

	let { item, onSelect, onToggle, onSetSeasons, onRemove }: Props = $props();

	const progress = $derived(getSeasonProgress(item));

	// "Mark as watched" still works on an unreleased title (premieres exist), but
	// it shouldn't be the loudest thing on a card for something that isn't out.
	const unreleased = $derived(getReleaseInfo(item.releaseDate).state !== 'released');
</script>

<MediaCard
	title={item.title}
	posterPath={item.posterPath}
	releaseDate={item.releaseDate}
	voteAverage={item.voteAverage}
	mediaType={item.mediaType}
	watched={item.watched}
	{onSelect}
>
	{#snippet actions()}
		<div class="flex items-end gap-2">
			<div class="min-w-0 flex-1">
				{#if progress.trackable}
					<SeasonStepper itemId={item.id} title={item.title} {progress} onSubmit={onSetSeasons} />
				{:else}
					<form method="POST" action="?/toggleWatched" use:enhance={onToggle}>
						<input type="hidden" name="id" value={item.id} />
						<button
							type="submit"
							class="w-full rounded-lg py-2 text-xs font-semibold transition active:scale-95
								{item.watched
								? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
								: unreleased
									? 'bg-white/5 text-slate-400 ring-1 ring-white/10 ring-inset hover:bg-white/10 hover:text-slate-200'
									: 'bg-emerald-500/90 text-white hover:bg-emerald-400'}"
						>
							{item.watched ? '↺ Unwatch' : '✓ Watched'}
						</button>
					</form>
				{/if}
			</div>

			<form method="POST" action="?/remove" use:enhance={onRemove}>
				<input type="hidden" name="id" value={item.id} />
				<button
					type="submit"
					aria-label={`Remove ${item.title} from your list`}
					class="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 active:scale-95"
				>
					✕
				</button>
			</form>
		</div>
	{/snippet}
</MediaCard>
