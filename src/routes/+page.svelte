<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { SubmitFunction } from '@sveltejs/kit';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import MediaDetailModal from '$lib/components/MediaDetailModal.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import GoogleButton from '$lib/components/GoogleButton.svelte';
	import AccountChip from '$lib/components/AccountChip.svelte';
	import { toasts } from '$lib/stores/toasts.svelte';
	import { applyWatchlistView, countByStatus } from '$lib/watchlist';
	import { getReleaseInfo } from '$lib/release';
	import type { MediaResult, MediaType } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Shared responsive grid layout for every poster grid on the page.
	const gridClass = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

	const signedIn = $derived(Boolean(data.user));

	// --- Search state ---
	let query = $state('');
	let results = $state<MediaResult[]>([]);
	let searching = $state(false);
	let searchError = $state<string | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout>;

	// --- Watchlist filter state (kept as strings to pair with SegmentedControl) ---
	let statusTab = $state('all');
	let typeFilter = $state('all');
	let sortBy = $state('recent');
	let listQuery = $state('');

	// --- Detail modal state ---
	let selected = $state<{ tmdbId: number; mediaType: MediaType } | null>(null);

	function openDetails(item: { tmdbId: number; mediaType: MediaType }) {
		selected = { tmdbId: item.tmdbId, mediaType: item.mediaType };
	}

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

	// --- Derived values ---
	const savedKeys = $derived(new Set(data.items.map((i) => key(i.tmdbId, i.mediaType))));

	// Map of "<tmdbId>:<mediaType>" -> DB id, so the modal knows the saved row id.
	const savedIds = $derived(new Map(data.items.map((i) => [key(i.tmdbId, i.mediaType), i.id])));

	const selectedSavedId = $derived(
		selected ? (savedIds.get(key(selected.tmdbId, selected.mediaType)) ?? null) : null
	);

	const counts = $derived(countByStatus(data.items));

	// The "Upcoming" lens only earns its place once something in the list is
	// actually unreleased.
	const statusOptions = $derived([
		{ value: 'all', label: 'All', count: counts.all },
		{ value: 'toWatch', label: 'To Watch', count: counts.toWatch },
		...(counts.upcoming > 0
			? [{ value: 'upcoming', label: 'Upcoming', count: counts.upcoming }]
			: []),
		{ value: 'watched', label: 'Watched', count: counts.watched }
	]);

	// Status/type/search filtering plus sorting, all in one pure helper.
	const visibleItems = $derived(
		applyWatchlistView(data.items, {
			status: statusTab,
			type: typeFilter,
			sort: sortBy,
			query: listQuery
		})
	);

	const hasQuery = $derived(query.trim().length > 0);

	// --- Search handlers ---
	function onInput() {
		clearTimeout(debounceTimer);
		const q = query.trim();
		if (!q) {
			results = [];
			searchError = null;
			searching = false;
			return;
		}
		searching = true; // show skeletons right away for perceived speed
		debounceTimer = setTimeout(() => runSearch(q), 350);
	}

	async function runSearch(q: string) {
		searching = true;
		searchError = null;
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			if (!response.ok) throw new Error('Search request failed');
			const body = (await response.json()) as { results: MediaResult[] };
			results = body.results;
		} catch {
			searchError = 'Something went wrong while searching. Please try again.';
			results = [];
		} finally {
			searching = false;
		}
	}

	function clearSearch() {
		clearTimeout(debounceTimer);
		query = '';
		results = [];
		searchError = null;
		searching = false;
	}

	function key(tmdbId: number, mediaType: string): string {
		return `${tmdbId}:${mediaType}`;
	}

	/**
	 * "Mark as watched" still works on an unreleased title (early screenings and
	 * premieres exist), but it shouldn't be the loudest thing on the card when
	 * the title isn't out — so it drops to a quiet, secondary style.
	 */
	function isUnreleased(releaseDate: string | null): boolean {
		return getReleaseInfo(releaseDate).state !== 'released';
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
</script>

<svelte:head>
	<title>WatchLater — Your movie & TV watchlist</title>
	<meta
		name="description"
		content="Discover movies and TV shows and save them to your personal watch-later list."
	/>
</svelte:head>

<!-- Reusable card for a discoverable title (trending / search result). -->
{#snippet discoverCard(item: MediaResult)}
	<MediaCard
		title={item.title}
		posterPath={item.posterPath}
		releaseDate={item.releaseDate}
		voteAverage={item.voteAverage}
		mediaType={item.mediaType}
		onSelect={() => openDetails(item)}
	>
		{#snippet actions()}
			{#if !signedIn}
				<a
					href={resolve('/auth/google')}
					data-sveltekit-reload
					class="block w-full rounded-lg bg-white/5 py-2 text-center text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
				>
					Sign in to save
				</a>
			{:else if savedKeys.has(key(item.tmdbId, item.mediaType))}
				<span
					class="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-400"
				>
					✓ In your list
				</span>
			{:else}
				<form method="POST" action="?/add" use:enhance={withToast(`Added “${item.title}”`)}>
					<input type="hidden" name="tmdbId" value={item.tmdbId} />
					<input type="hidden" name="mediaType" value={item.mediaType} />
					<input type="hidden" name="title" value={item.title} />
					<input type="hidden" name="posterPath" value={item.posterPath ?? ''} />
					<input type="hidden" name="releaseDate" value={item.releaseDate ?? ''} />
					<input type="hidden" name="overview" value={item.overview ?? ''} />
					<input type="hidden" name="voteAverage" value={item.voteAverage ?? ''} />
					<button
						type="submit"
						class="w-full rounded-lg bg-sky-500 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 active:scale-95"
					>
						+ Watch Later
					</button>
				</form>
			{/if}
		{/snippet}
	</MediaCard>
{/snippet}

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

<div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-20 sm:px-6">
	<!-- Hero -->
	<header class="pt-6 pb-4 sm:pt-10">
		<div class="flex items-start justify-between gap-4">
			<div>
				<div class="flex items-center gap-2">
					<span class="text-3xl">🎬</span>
					<h1 class="text-2xl font-black tracking-tight sm:text-4xl">
						Watch<span
							class="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent"
							>Later</span
						>
					</h1>
				</div>
				<p class="mt-2 max-w-md text-sm text-slate-400 sm:text-base">
					Discover movies & TV shows and build your personal watchlist.
				</p>
			</div>

			<div class="flex-shrink-0 pt-1">
				{#if data.user}
					<AccountChip user={data.user} />
				{:else if data.authAvailable}
					<GoogleButton />
				{/if}
			</div>
		</div>
	</header>

	<!-- Sticky search bar -->
	<div
		class="sticky top-0 z-20 -mx-4 border-b border-white/5 bg-slate-950/70 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6"
	>
		<label class="relative block">
			<span class="sr-only">Search movies and TV shows</span>
			<span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500">
				{#if searching}
					<span
						class="block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
					></span>
				{:else}
					🔍
				{/if}
			</span>
			<input
				type="search"
				bind:value={query}
				oninput={onInput}
				placeholder="Search for a movie or TV show…"
				autocomplete="off"
				class="w-full rounded-xl border border-white/10 bg-slate-800/70 py-3 pr-11 pl-11 text-base text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-800 focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
			/>
			{#if hasQuery}
				<button
					type="button"
					onclick={clearSearch}
					aria-label="Clear search"
					class="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
				>
					✕
				</button>
			{/if}
		</label>
	</div>

	<!-- Discover section: search results OR trending -->
	<section class="mt-6">
		{#if searchError}
			<p class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{searchError}</p>
		{:else if hasQuery}
			<div class="mb-3 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold tracking-wide text-slate-400 uppercase">Search results</h2>
				{#if !searching && results.length > 0}
					<span class="text-xs text-slate-500">{results.length} found</span>
				{/if}
			</div>

			{#if searching && results.length === 0}
				{@render skeletonGrid()}
			{:else if results.length > 0}
				<div class={gridClass}>
					{#each results as item (key(item.tmdbId, item.mediaType))}
						{@render discoverCard(item)}
					{/each}
				</div>
			{:else}
				<div class="rounded-2xl border border-dashed border-white/10 py-12 text-center">
					<p class="text-4xl">🤷</p>
					<p class="mt-2 text-slate-400">No results for “{query}”.</p>
				</div>
			{/if}
		{:else if data.trending.length > 0}
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
				🔥 Trending this week
			</h2>
			<div class={gridClass}>
				{#each data.trending as item (key(item.tmdbId, item.mediaType))}
					{@render discoverCard(item)}
				{/each}
			</div>
		{/if}
	</section>

	<!-- Divider -->
	<div class="my-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

	<!-- Watchlist section -->
	<section>
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-lg font-bold text-slate-100">Your Watchlist</h2>
			{#if signedIn && counts.all > 0}
				<div class="flex flex-wrap items-center gap-2">
					<label class="relative">
						<span class="sr-only">Filter your watchlist</span>
						<input
							type="search"
							bind:value={listQuery}
							placeholder="Filter your list…"
							autocomplete="off"
							class="w-full rounded-xl border border-white/10 bg-slate-800/70 py-1.5 pr-3 pl-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none sm:w-44 sm:text-sm"
						/>
					</label>
					<SegmentedControl bind:value={statusTab} options={statusOptions} />
					<SegmentedControl
						bind:value={typeFilter}
						options={[
							{ value: 'all', label: 'All' },
							{ value: 'movie', label: 'Movies' },
							{ value: 'tv', label: 'TV' }
						]}
					/>
					<label class="relative">
						<span class="sr-only">Sort watchlist</span>
						<select
							bind:value={sortBy}
							class="cursor-pointer rounded-xl bg-slate-800/70 py-1.5 pr-8 pl-3 text-xs font-semibold text-slate-300 ring-1 ring-white/5 focus:ring-2 focus:ring-sky-500/40 focus:outline-none sm:text-sm"
						>
							<option value="recent">Recently added</option>
							<option value="rating">Top rated</option>
							<option value="title">A–Z</option>
							{#if counts.upcoming > 0}
								<option value="soonest">Releasing soonest</option>
							{/if}
						</select>
					</label>
				</div>
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
					<div class="mx-auto mt-6 max-w-xs">
						<GoogleButton size="full" />
					</div>
				{:else}
					<p class="mt-6 text-xs text-amber-300/80">
						Sign-in is not configured on this deployment yet.
					</p>
				{/if}
			</div>
		{:else if counts.all === 0}
			<div class="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
				<p class="text-5xl">🍿</p>
				<p class="mt-3 font-medium text-slate-300">Your watchlist is empty</p>
				<p class="mt-1 text-sm text-slate-500">
					Search or pick something trending above to get started.
				</p>
			</div>
		{:else if visibleItems.length === 0}
			<div class="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
				{#if listQuery.trim()}
					<p class="text-slate-400">No matches for “{listQuery}” in your list.</p>
				{:else}
					<p class="text-slate-400">Nothing here with the current filters.</p>
				{/if}
			</div>
		{:else}
			<div class={gridClass}>
				{#each visibleItems as item (item.id)}
					<div
						animate:flip={{ duration: 250 }}
						in:fade={{ duration: 200 }}
						out:fade={{ duration: 150 }}
					>
						<MediaCard
							title={item.title}
							posterPath={item.posterPath}
							releaseDate={item.releaseDate}
							voteAverage={item.voteAverage}
							mediaType={item.mediaType}
							watched={item.watched}
							onSelect={() => openDetails(item)}
						>
							{#snippet actions()}
								<div class="flex gap-2">
									<form
										method="POST"
										action="?/toggleWatched"
										class="flex-1"
										use:enhance={withToast(
											item.watched ? 'Moved back to your list' : 'Marked as watched'
										)}
									>
										<input type="hidden" name="id" value={item.id} />
										<input type="hidden" name="watched" value={item.watched} />
										<button
											type="submit"
											class="w-full rounded-lg py-2 text-xs font-semibold transition active:scale-95
												{item.watched
												? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
												: isUnreleased(item.releaseDate)
													? 'bg-white/5 text-slate-400 ring-1 ring-white/10 ring-inset hover:bg-white/10 hover:text-slate-200'
													: 'bg-emerald-500/90 text-white hover:bg-emerald-400'}"
										>
											{item.watched ? '↺ Unwatch' : '✓ Watched'}
										</button>
									</form>
									<form
										method="POST"
										action="?/remove"
										use:enhance={withToast(`Removed “${item.title}”`, 'info')}
									>
										<input type="hidden" name="id" value={item.id} />
										<button
											type="submit"
											aria-label="Remove from list"
											class="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 active:scale-95"
										>
											✕
										</button>
									</form>
								</div>
							{/snippet}
						</MediaCard>
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
		savedId={selectedSavedId}
		{signedIn}
		onClose={() => (selected = null)}
	/>
{/if}
