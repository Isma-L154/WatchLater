<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import MediaCard from './MediaCard.svelte';
	import SeasonTracker from './SeasonTracker.svelte';
	import { getSeasonProgress } from '$lib/domain/progress';
	import { getEpisodePosition } from '$lib/domain/episodes';
	import { getReleaseInfo } from '$lib/domain/release';
	import {
		daysUntilArchive,
		shouldWarnAboutArchive,
		type ArchiveWindow
	} from '$lib/domain/archive';
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
		/** The account's auto-archive window, or null when the feature is off. */
		archiveWindow?: ArchiveWindow | null;
		onSelect: () => void;
		onToggle: SubmitFunction;
		onSetSeasons: SubmitFunction;
		onRemove: SubmitFunction;
		/** Resets the archive countdown. Required once `archiveWindow` is set. */
		onKeep?: SubmitFunction;
		/** Brings an archived title back. Only rendered for archived entries. */
		onRestore?: SubmitFunction;
	}

	let {
		item,
		priority = false,
		archiveWindow = null,
		onSelect,
		onToggle,
		onSetSeasons,
		onRemove,
		onKeep,
		onRestore
	}: Props = $props();

	const archived = $derived(item.archivedAt !== null);

	/**
	 * Days left before this is tidied away, shown only inside the final week.
	 *
	 * A countdown on something with a month to go would sit on every watched card
	 * permanently and stop being read; the point is that nothing disappears
	 * without having said so first.
	 */
	const archiveCountdown = $derived(
		shouldWarnAboutArchive(item, archiveWindow) ? daysUntilArchive(item, archiveWindow) : null
	);

	const progress = $derived(getSeasonProgress(item));
	const position = $derived(getEpisodePosition(item));

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

	/**
	 * The line under the title. Episode position wins when there is one: "S3E5" is
	 * a more precise answer to "where am I" than "Season 3 of 5", and it is the
	 * thing the primary button is about to act on.
	 */
	const note = $derived.by(() => {
		if (progress.state === 'caughtUp' && nextSeason) {
			return `Caught up · S${nextSeason.number} ${nextSeason.label}`;
		}
		if (position.trackable && !position.upToDate) return `Next: ${position.nextLabel}`;
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
		{#if archived}
			<!-- An archived tile carries one action, because there is only one thing
			     worth doing with it: putting it back. -->
			<form method="POST" action="?/restore" use:enhance={onRestore}>
				<input type="hidden" name="id" value={item.id} />
				<button
					type="submit"
					class="flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-surface-hi text-xs font-semibold text-ink ring-1 ring-line transition-colors duration-200 ring-inset hover:bg-line active:scale-[0.98]"
				>
					<Icon name="rotate" size={14} /> Restore
				</button>
			</form>
		{:else if progress.trackable}
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

		<!--
			The warning is deliberately actionable rather than informational: telling
			someone their title is about to disappear without offering the one-tap way
			to stop it would be a notification, not a control.
		-->
		{#if archiveCountdown !== null && onKeep}
			<form method="POST" action="?/keepLonger" use:enhance={onKeep} class="mt-1.5">
				<input type="hidden" name="id" value={item.id} />
				<button
					type="submit"
					class="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-amber/10 py-1 text-[11px] font-medium text-amber transition-colors duration-200 hover:bg-amber/20"
					title={`Archives in ${archiveCountdown} day${archiveCountdown === 1 ? '' : 's'} — tap to keep it on your list`}
				>
					<Icon name="clock" size={11} />
					{archiveCountdown === 0 ? 'Archives today' : `Archives in ${archiveCountdown}d`} · Keep
				</button>
			</form>
		{/if}
	{/snippet}
</MediaCard>
