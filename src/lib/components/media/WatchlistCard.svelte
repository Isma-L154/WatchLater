<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import MediaCard from './MediaCard.svelte';
	import SeasonTracker from './SeasonTracker.svelte';
	import { getSeasonProgress } from '$lib/domain/progress';
	import { getReleaseInfo } from '$lib/domain/release';
	import type { WatchlistItem } from '$lib/server/db/schema';

	/**
	 * A saved title with its controls.
	 *
	 * Multi-season shows get the season tracker instead of the binary toggle —
	 * completing the tracker is what marks them as watched.
	 */
	interface Props {
		item: WatchlistItem;
		/** Forwarded to the poster; set for the tiles above the fold. */
		priority?: boolean;
		onSelect: () => void;
		onToggle: SubmitFunction;
		onSetSeasons: SubmitFunction;
		onRemove: SubmitFunction;
	}

	let { item, priority = false, onSelect, onToggle, onSetSeasons, onRemove }: Props = $props();

	const progress = $derived(getSeasonProgress(item));

	// "Mark as watched" still works on an unreleased title (premieres exist), but
	// it shouldn't be the loudest thing on a card for something that isn't out.
	const unreleased = $derived(getReleaseInfo(item.releaseDate).state !== 'released');

	/**
	 * A pending season gets the same treatment as an unreleased film: the card
	 * says when, so "why can't I tick this off" never needs asking.
	 */
	const nextSeason = $derived.by(() => {
		if (item.mediaType !== 'tv' || item.nextSeasonNumber === null) return null;
		const release = getReleaseInfo(item.nextSeasonAirDate);
		if (release.state === 'released') return null;
		return {
			number: item.nextSeasonNumber,
			label: release.state === 'upcoming' ? release.shortLabel : 'TBA'
		};
	});

	/** The line under the title: progress, or what is coming when caught up. */
	const note = $derived.by(() => {
		if (progress.state === 'caughtUp' && nextSeason) {
			return `Caught up · S${nextSeason.number} ${nextSeason.label}`;
		}
		return progress.trackable ? progress.label : undefined;
	});
</script>

<MediaCard
	title={item.title}
	posterPath={item.posterPath}
	releaseDate={item.releaseDate}
	voteAverage={item.voteAverage}
	mediaType={item.mediaType}
	watched={item.watched}
	{note}
	upcomingSeason={nextSeason}
	{priority}
	{onSelect}
>
	{#snippet actions()}
		{#if progress.trackable}
			<!-- The tracker is a full-width row of its own: cramming it beside the
			     remove button would leave the primary action too narrow to name the
			     next season, which is the whole point of it. -->
			<div class="space-y-1.5">
				<SeasonTracker itemId={item.id} title={item.title} {progress} onSubmit={onSetSeasons} />
				<form method="POST" action="?/remove" use:enhance={onRemove}>
					<input type="hidden" name="id" value={item.id} />
					<button
						type="submit"
						class="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium text-ink-faint transition-colors duration-200 hover:text-rose"
					>
						<Icon name="trash" size={12} /> Remove
					</button>
				</form>
			</div>
		{:else}
			<div class="flex items-stretch gap-1.5">
				<form method="POST" action="?/toggleWatched" use:enhance={onToggle} class="min-w-0 flex-1">
					<input type="hidden" name="id" value={item.id} />
					<button
						type="submit"
						class="flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors duration-200 active:scale-[0.98]
							{item.watched
							? 'bg-surface-hi text-ink-muted ring-1 ring-line ring-inset hover:bg-line hover:text-ink'
							: unreleased
								? 'bg-surface-hi text-ink-muted ring-1 ring-line ring-inset hover:bg-line hover:text-ink'
								: 'bg-mint/15 text-mint hover:bg-mint/25'}"
					>
						<Icon name={item.watched ? 'rotate' : 'check'} size={14} stroke={2.5} />
						<span class="truncate">{item.watched ? 'Unwatch' : 'Watched'}</span>
					</button>
				</form>

				<form method="POST" action="?/remove" use:enhance={onRemove}>
					<input type="hidden" name="id" value={item.id} />
					<button
						type="submit"
						aria-label={`Remove ${item.title} from your list`}
						class="flex h-[38px] w-9 cursor-pointer items-center justify-center rounded-xl bg-rose/12 text-rose transition-colors duration-200 hover:bg-rose/22 active:scale-95"
					>
						<Icon name="trash" size={14} />
					</button>
				</form>
			</div>
		{/if}
	{/snippet}
</MediaCard>
