<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import PosterGrid from '$lib/components/media/PosterGrid.svelte';
	import WatchlistCard from '$lib/components/media/WatchlistCard.svelte';
	import WatchlistToolbar from '$lib/components/media/WatchlistToolbar.svelte';
	import ContinueWatching from '$lib/components/media/ContinueWatching.svelte';
	import MediaDetailModal from '$lib/components/media/MediaDetailModal.svelte';
	import { toasts } from '$lib/stores/toasts.svelte';
	import { applyWatchlistView, countByStatus, isInProgress } from '$lib/domain/watchlist';
	import type { WatchlistItem } from '$lib/server/db/schema';
	import type { MediaType, SavedEntry } from '$lib/types';
	import type { PageData } from './$types';

	/**
	 * My List — everything saved, and what to do with it next.
	 *
	 * Owning a whole route is the point: the list is the reason the app exists, so
	 * it is one tap away from anywhere instead of a scroll to the bottom of
	 * Discover.
	 */
	let { data }: { data: PageData } = $props();

	const signedIn = $derived(Boolean(page.data.user));

	// --- View state (strings, to pair with SegmentedControl) ---
	let statusTab = $state('all');
	let typeFilter = $state('all');
	let sortBy = $state('recent');
	let listQuery = $state('');

	let selected = $state<{ tmdbId: number; mediaType: MediaType } | null>(null);

	const counts = $derived(countByStatus(data.items));

	/**
	 * Shows that are started but unfinished, surfaced above the grid.
	 *
	 * Only shown on the unfiltered "All" view: once the user has actively narrowed
	 * the list, a rail that ignores their filter is contradicting them.
	 */
	const continueWatching = $derived(
		statusTab === 'all' && typeFilter === 'all' && listQuery.trim() === ''
			? data.items.filter(isInProgress)
			: []
	);

	const visibleItems = $derived(
		applyWatchlistView(data.items, {
			status: statusTab,
			type: typeFilter,
			sort: sortBy,
			query: listQuery
		})
	);

	// "<tmdbId>:<mediaType>" -> saved row, so the modal renders the same controls
	// as the card without issuing a second query.
	const savedEntries = $derived(
		new Map<string, SavedEntry>(
			data.items.map((item) => [
				`${item.tmdbId}:${item.mediaType}`,
				{
					id: item.id,
					watched: item.watched,
					seasonsSeen: item.seasonsSeen,
					totalSeasons: item.totalSeasons
				}
			])
		)
	);

	const selectedSaved = $derived(
		selected ? (savedEntries.get(`${selected.tmdbId}:${selected.mediaType}`) ?? null) : null
	);

	const filtersActive = $derived(
		statusTab !== 'all' || typeFilter !== 'all' || listQuery.trim() !== ''
	);

	function resetFilters() {
		statusTab = 'all';
		typeFilter = 'all';
		listQuery = '';
	}

	/**
	 * Progressive-enhancement helper: after the action completes it refreshes the
	 * page data and shows a toast reflecting the outcome.
	 */
	function withToast(message: string, type: 'success' | 'info' = 'success'): SubmitFunction {
		return () =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') toasts.add(message, type);
				else if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
			};
	}

	/**
	 * Season updates take their message from the server's response rather than
	 * from the pre-click state: the action may have discovered a newly aired
	 * season, so only it knows whether the show is actually finished.
	 */
	function seasonProgressToast(item: Pick<WatchlistItem, 'title'>): SubmitFunction {
		return () =>
			async ({ result, update }) => {
				await update();
				if (result.type !== 'success') {
					if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
					return;
				}
				const payload = result.data as { seasonsSeen?: number; totalSeasons?: number } | undefined;
				const seen = payload?.seasonsSeen ?? 0;
				const total = payload?.totalSeasons ?? 0;

				if (total && seen >= total) toasts.add(`Finished “${item.title}” 🎉`);
				else if (seen === 0) toasts.add(`Reset progress for “${item.title}”`, 'info');
				else toasts.add(`Season ${seen} of “${item.title}” watched`);
			};
	}
</script>

<svelte:head>
	<title>My List — WatchLater</title>
	<meta name="description" content="Your personal watch-later list of movies and TV shows." />
</svelte:head>

<div class="py-5 sm:py-8">
	<div class="mb-5 flex items-baseline justify-between gap-3">
		<div>
			<h1 class="font-display text-2xl font-extrabold sm:text-3xl">My List</h1>
			<p class="mt-1 text-sm text-ink-muted">
				{#if signedIn && counts.all > 0}
					{counts.all}
					{counts.all === 1 ? 'title' : 'titles'} saved · {counts.toWatch} left to watch
				{:else}
					Everything you've saved, in one place.
				{/if}
			</p>
		</div>
	</div>

	{#if !signedIn}
		<!-- Signed-out state. Browsing stays open; the list itself is private. -->
		<EmptyState
			icon="lock"
			title="Your list, and only yours"
			hint="Sign in with Google to save titles. Your watchlist stays tied to your account — nobody else can see or change it."
		>
			{#snippet action()}
				{#if page.data.authAvailable}
					<div class="mx-auto w-full max-w-xs"><GoogleButton size="full" /></div>
				{:else}
					<p class="text-xs text-amber">Sign-in is not configured on this deployment yet.</p>
				{/if}
			{/snippet}
		</EmptyState>
	{:else if counts.all === 0}
		<EmptyState
			icon="sparkle"
			title="Your watchlist is empty"
			hint="Head to Discover to search for a title or pick something trending."
		>
			{#snippet action()}
				<a
					href={resolve('/')}
					class="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors duration-200 hover:bg-brand-hi"
				>
					<Icon name="compass" size={16} />
					Browse Discover
				</a>
			{/snippet}
		</EmptyState>
	{:else}
		<ContinueWatching
			items={continueWatching}
			onSelect={(item) => (selected = item)}
			onSetSeasons={seasonProgressToast}
		/>

		<div class="mb-4">
			<WatchlistToolbar
				{counts}
				bind:status={statusTab}
				bind:type={typeFilter}
				bind:sort={sortBy}
				bind:query={listQuery}
			/>
		</div>

		{#if visibleItems.length === 0}
			<EmptyState
				icon="filter"
				title={listQuery.trim()
					? `No matches for “${listQuery}”`
					: 'Nothing here with these filters'}
				hint="Try widening the filters to see the rest of your list."
			>
				{#snippet action()}
					<button
						type="button"
						onclick={resetFilters}
						class="cursor-pointer rounded-xl bg-surface-hi px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line transition-colors duration-200 hover:bg-line"
					>
						Clear filters
					</button>
				{/snippet}
			</EmptyState>
		{:else}
			{#if filtersActive}
				<p class="mb-3 text-xs text-ink-faint" role="status" aria-live="polite">
					Showing {visibleItems.length} of {counts.all}
				</p>
			{/if}
			<PosterGrid>
				{#each visibleItems as item (item.id)}
					<div
						animate:flip={{ duration: 250 }}
						in:fade={{ duration: 200 }}
						out:fade={{ duration: 150 }}
					>
						<WatchlistCard
							{item}
							onSelect={() => (selected = item)}
							onToggle={withToast(item.watched ? 'Moved back to your list' : 'Marked as watched')}
							onSetSeasons={seasonProgressToast(item)}
							onRemove={withToast(`Removed “${item.title}”`, 'info')}
						/>
					</div>
				{/each}
			</PosterGrid>
		{/if}
	{/if}
</div>

{#if selected}
	<MediaDetailModal
		tmdbId={selected.tmdbId}
		mediaType={selected.mediaType}
		saved={selectedSaved}
		{signedIn}
		onClose={() => (selected = null)}
	/>
{/if}
