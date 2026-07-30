<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { SubmitFunction } from '@sveltejs/kit';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import DiscoverCard from '$lib/components/media/DiscoverCard.svelte';
	import WatchlistCard from '$lib/components/media/WatchlistCard.svelte';
	import WatchlistToolbar from '$lib/components/media/WatchlistToolbar.svelte';
	import MediaDetailModal from '$lib/components/media/MediaDetailModal.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import { MediaSearch } from '$lib/stores/search.svelte';
	import { toasts } from '$lib/stores/toasts.svelte';
	import { applyWatchlistView, countByStatus } from '$lib/domain/watchlist';
	import type { MediaType, SavedEntry } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Shared responsive grid layout for every poster grid on the page.
	const gridClass = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

	const signedIn = $derived(Boolean(data.user));

	const search = new MediaSearch();

	// --- Watchlist view state (strings, to pair with SegmentedControl) ---
	let statusTab = $state('all');
	let typeFilter = $state('all');
	let sortBy = $state('recent');
	let listQuery = $state('');

	// --- Detail modal ---
	let selected = $state<{ tmdbId: number; mediaType: MediaType } | null>(null);

	/**
	 * Surface the outcome of the OAuth round-trip, which comes back as a query
	 * parameter, then strip it so a refresh doesn't replay the message.
	 */
	$effect(() => {
		const outcome = page.url.searchParams.get('auth');
		if (!outcome) return;

		if (outcome === 'error') toasts.add('Could not sign you in. Please try again.', 'error');
		else if (outcome === 'unavailable') toasts.add('Sign-in is not configured yet.', 'error');

		replaceState(page.url.pathname, page.state);
	});

	// --- Derived views over the saved list ---
	const savedKeys = $derived(new Set(data.items.map((i) => key(i.tmdbId, i.mediaType))));

	// "<tmdbId>:<mediaType>" -> saved row, so the modal can render the same
	// controls as the card without issuing a second query.
	const savedEntries = $derived(
		new Map<string, SavedEntry>(
			data.items.map((i) => [
				key(i.tmdbId, i.mediaType),
				{ id: i.id, watched: i.watched, seasonsSeen: i.seasonsSeen, totalSeasons: i.totalSeasons }
			])
		)
	);

	const selectedSaved = $derived(
		selected ? (savedEntries.get(key(selected.tmdbId, selected.mediaType)) ?? null) : null
	);

	const counts = $derived(countByStatus(data.items));

	const visibleItems = $derived(
		applyWatchlistView(data.items, {
			status: statusTab,
			type: typeFilter,
			sort: sortBy,
			query: listQuery
		})
	);

	function key(tmdbId: number, mediaType: string): string {
		return `${tmdbId}:${mediaType}`;
	}

	/**
	 * Progressive-enhancement helper: after the action completes it refreshes
	 * the page data and shows a toast reflecting the outcome.
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
	function seasonProgressToast(title: string): SubmitFunction {
		return () =>
			async ({ result, update }) => {
				await update();
				if (result.type !== 'success') {
					if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
					return;
				}
				const payload = result.data as { seasonsSeen?: number; totalSeasons?: number } | undefined;
				const finished =
					!!payload?.totalSeasons && (payload.seasonsSeen ?? 0) >= payload.totalSeasons;
				toasts.add(finished ? `Finished “${title}” 🎉` : `Progress saved for “${title}”`);
			};
	}
</script>

<svelte:head>
	<title>WatchLater — Your movie & TV watchlist</title>
	<meta
		name="description"
		content="Discover movies and TV shows and save them to your personal watch-later list."
	/>
</svelte:head>

<!-- Loading placeholders shown while a search is in flight. -->
{#snippet skeletonGrid()}
	<div class={gridClass}>
		{#each [...Array(10).keys()] as i (i)}
			<div class="animate-pulse overflow-hidden rounded-2xl bg-slate-800/50 ring-1 ring-white/5">
				<div class="aspect-[2/3] w-full bg-slate-700/40"></div>
				<div class="space-y-2 p-3">
					<div class="h-3 w-3/4 rounded bg-slate-700/40"></div>
					<div class="h-2 w-1/3 rounded bg-slate-700/40"></div>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet emptyState(icon: string, title: string, hint?: string)}
	<div class="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
		<p class="text-4xl">{icon}</p>
		<p class="mt-3 font-medium text-slate-300">{title}</p>
		{#if hint}<p class="mt-1 text-sm text-slate-500">{hint}</p>{/if}
	</div>
{/snippet}

<div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-20 sm:px-6">
	<AppHeader user={data.user} authAvailable={data.authAvailable} />

	<SearchBar {search} />

	<!-- Discover: search results, or trending when the box is empty -->
	<section class="mt-6">
		{#if search.error}
			<p class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{search.error}</p>
		{:else if search.active}
			<div class="mb-3 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold tracking-wide text-slate-400 uppercase">Search results</h2>
				{#if !search.loading && search.results.length > 0}
					<span class="text-xs text-slate-500">{search.results.length} found</span>
				{/if}
			</div>

			{#if search.loading && search.results.length === 0}
				{@render skeletonGrid()}
			{:else if search.results.length > 0}
				<div class={gridClass}>
					{#each search.results as item (key(item.tmdbId, item.mediaType))}
						<DiscoverCard
							{item}
							{signedIn}
							saved={savedKeys.has(key(item.tmdbId, item.mediaType))}
							onSelect={() => (selected = item)}
							onSubmit={withToast(`Added “${item.title}”`)}
						/>
					{/each}
				</div>
			{:else}
				{@render emptyState('🤷', `No results for “${search.query}”.`)}
			{/if}
		{:else if data.trending.length > 0}
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
				🔥 Trending this week
			</h2>
			<div class={gridClass}>
				{#each data.trending as item (key(item.tmdbId, item.mediaType))}
					<DiscoverCard
						{item}
						{signedIn}
						saved={savedKeys.has(key(item.tmdbId, item.mediaType))}
						onSelect={() => (selected = item)}
						onSubmit={withToast(`Added “${item.title}”`)}
					/>
				{/each}
			</div>
		{/if}
	</section>

	<div class="my-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

	<!-- The list itself -->
	<section>
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="shrink-0 text-lg font-bold whitespace-nowrap text-slate-100">Your Watchlist</h2>
			{#if signedIn && counts.all > 0}
				<WatchlistToolbar
					{counts}
					bind:status={statusTab}
					bind:type={typeFilter}
					bind:sort={sortBy}
					bind:query={listQuery}
				/>
			{/if}
		</div>

		{#if !signedIn}
			<!-- Signed-out state. Browsing stays open; the list itself is private. -->
			<div
				class="rounded-2xl border border-white/10 bg-slate-900/40 px-6 py-14 text-center sm:py-16"
			>
				<p class="text-5xl">🔐</p>
				<p class="mt-4 text-lg font-semibold text-slate-100">Your list, and only yours</p>
				<p class="mx-auto mt-2 max-w-sm text-sm text-slate-400">
					Sign in with Google to save titles. Your watchlist stays tied to your account — nobody
					else can see or change it.
				</p>
				{#if data.authAvailable}
					<div class="mx-auto mt-6 max-w-xs"><GoogleButton size="full" /></div>
				{:else}
					<p class="mt-6 text-xs text-amber-300/80">
						Sign-in is not configured on this deployment yet.
					</p>
				{/if}
			</div>
		{:else if counts.all === 0}
			{@render emptyState(
				'🍿',
				'Your watchlist is empty',
				'Search or pick something trending above to get started.'
			)}
		{:else if visibleItems.length === 0}
			{@render emptyState(
				'🔎',
				listQuery.trim()
					? `No matches for “${listQuery}” in your list.`
					: 'Nothing here with the current filters.'
			)}
		{:else}
			<div class={gridClass}>
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
							onSetSeasons={seasonProgressToast(item.title)}
							onRemove={withToast(`Removed “${item.title}”`, 'info')}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</section>
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
