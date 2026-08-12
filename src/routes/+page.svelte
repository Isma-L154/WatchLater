<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PosterGrid from '$lib/components/media/PosterGrid.svelte';
	import PosterGridSkeleton from '$lib/components/media/PosterGridSkeleton.svelte';
	import DiscoverCard from '$lib/components/media/DiscoverCard.svelte';
	import MediaDetailModal from '$lib/components/media/MediaDetailModal.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import { MediaSearch } from '$lib/stores/search.svelte';
	import { TrendingFeed } from '$lib/stores/trending.svelte';
	import { toasts } from '$lib/stores/toasts.svelte';
	import { dedupeByKey, mediaKey } from '$lib/domain/media';
	import type { MediaType } from '$lib/types';
	import type { PageData } from './$types';

	/**
	 * Discover — finding something to watch.
	 *
	 * This page used to also carry the watchlist, stacked underneath trending and
	 * search results. That put the list one full scroll below the fold on every
	 * visit, which is the wrong end of the app to bury: browsing is occasional,
	 * "what am I watching?" is the daily question. The list now has its own route
	 * and its own tab; this page does one job.
	 */
	let { data }: { data: PageData } = $props();

	const signedIn = $derived(Boolean(page.data.user));
	const search = new MediaSearch();

	/**
	 * How many posters load eagerly at full priority.
	 *
	 * Covers the widest first row (5 columns at `lg`) with one to spare. Beyond
	 * that, eager loading stops helping and starts competing with the LCP image
	 * for bandwidth, so the rest stay lazy.
	 */
	const EAGER_POSTERS = 6;

	/**
	 * Owns pages 2..n; page 1 stays with the server load.
	 *
	 * `untrack` states the intent the compiler asks about: the flag is a starting
	 * point, not a binding. Rebuilding the feed whenever `data` changes would
	 * throw away every page the visitor had loaded each time they saved a title.
	 */
	const trending = untrack(() => new TrendingFeed(data.trending.hasMore));

	/**
	 * Merge the server's page 1 with the pages loaded since.
	 *
	 * Saving a title invalidates the page data, so page 1 is re-fetched — and the
	 * trending list is re-ranked continuously, so a title sitting in `extra` can
	 * reappear in the refreshed page 1. The grid is keyed by title, and a
	 * duplicate key is a render error, not a cosmetic glitch.
	 */
	const allTrending = $derived(dedupeByKey([...data.trending.items, ...trending.extra]));

	let selected = $state<{ tmdbId: number; mediaType: MediaType } | null>(null);

	const selectedSaved = $derived(selected ? (data.saved[mediaKey(selected)] ?? null) : null);

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
</script>

<svelte:head>
	<title>Discover — WatchLater</title>
	<meta
		name="description"
		content="Search movies and TV shows, see what's trending this week, and save titles to your personal watch-later list."
	/>
</svelte:head>

<div class="py-5 sm:py-8">
	<h1 class="font-display text-2xl font-extrabold sm:text-3xl">Discover</h1>
	<p class="mt-1 text-sm text-ink-muted">Find something worth your evening.</p>

	<div class="mt-5">
		<SearchBar {search} />
	</div>

	<section class="mt-7">
		{#if search.error}
			<p
				class="flex items-center gap-2 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose ring-1 ring-rose/20"
			>
				<Icon name="alert" size={16} />
				{search.error}
			</p>
		{:else if search.active}
			<div class="mb-3 flex items-baseline justify-between gap-3">
				<h2 class="text-sm font-bold tracking-wide text-ink-muted uppercase">Search results</h2>
				{#if !search.loading && search.results.length > 0}
					<span class="text-xs text-ink-faint">{search.results.length} found</span>
				{/if}
			</div>

			{#if search.loading && search.results.length === 0}
				<PosterGridSkeleton />
			{:else if search.results.length > 0}
				<PosterGrid>
					{#each search.results as item, index (mediaKey(item))}
						<DiscoverCard
							{item}
							{signedIn}
							priority={index < EAGER_POSTERS}
							saved={data.saved[mediaKey(item)] ?? null}
							onSelect={() => (selected = item)}
							onSubmit={withToast(`Added “${item.title}”`)}
						/>
					{/each}
				</PosterGrid>
			{:else}
				<EmptyState
					icon="search"
					title={`No results for “${search.query}”`}
					hint="Try a shorter title, or check the spelling."
				/>
			{/if}
		{:else if allTrending.length > 0}
			<div class="mb-3 flex items-center gap-2">
				<Icon name="flame" size={16} class="text-amber" />
				<h2 class="text-sm font-bold tracking-wide text-ink-muted uppercase">Trending this week</h2>
				<span class="text-xs text-ink-faint">{allTrending.length}</span>
			</div>
			<PosterGrid>
				{#each allTrending as item, index (mediaKey(item))}
					<DiscoverCard
						{item}
						{signedIn}
						priority={index < EAGER_POSTERS}
						saved={data.saved[mediaKey(item)] ?? null}
						onSelect={() => (selected = item)}
						onSubmit={withToast(`Added “${item.title}”`)}
					/>
				{/each}
			</PosterGrid>

			{#if trending.hasMore}
				<div class="mt-6 flex flex-col items-center gap-2">
					{#if trending.error}
						<p class="flex items-center gap-2 text-sm text-rose" role="alert">
							<Icon name="alert" size={15} />
							{trending.error}
						</p>
					{/if}
					<button
						type="button"
						onclick={trending.loadMore}
						disabled={trending.loading}
						class="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface px-6 text-sm font-semibold text-ink ring-1 ring-line transition-colors duration-200 hover:bg-surface-hi disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if trending.loading}
							<span class="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-hi"
							></span>
							Loading…
						{:else}
							<Icon name="plus" size={15} stroke={2.5} />
							{trending.error ? 'Try again' : 'Load more'}
						{/if}
					</button>
				</div>
			{/if}
		{:else}
			<EmptyState
				icon="alert"
				title="Trending is unavailable right now"
				hint="Search for a title above — that still works."
			/>
		{/if}
	</section>

	<!-- Signed-out prompt sits *after* the content, not in front of it: browsing
	     is open to everyone, and only saving needs an account. -->
	{#if !signedIn && page.data.authAvailable}
		<section
			class="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-surface/60 px-6 py-8 text-center ring-1 ring-line sm:flex-row sm:justify-between sm:text-left"
		>
			<div class="flex items-center gap-3">
				<span
					class="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand-hi sm:flex"
				>
					<Icon name="bookmark" size={20} />
				</span>
				<div>
					<p class="font-display font-semibold text-ink">Keep track of what you find</p>
					<p class="mt-0.5 text-sm text-ink-muted">
						Sign in to build a watchlist that's yours alone.
					</p>
				</div>
			</div>
			<div class="w-full max-w-xs sm:w-auto"><GoogleButton size="full" /></div>
		</section>
	{:else if signedIn}
		<div class="mt-10 flex justify-center">
			<a
				href={resolve('/watchlist')}
				class="flex items-center gap-2 rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold text-ink-muted ring-1 ring-line transition-colors duration-200 hover:bg-surface-hi hover:text-ink"
			>
				<Icon name="bookmark" size={16} />
				Go to my list
				<Icon name="chevronRight" size={15} />
			</a>
		</div>
	{/if}
</div>

{#if selected}
	<MediaDetailModal
		tmdbId={selected.tmdbId}
		mediaType={selected.mediaType}
		saved={selectedSaved}
		{signedIn}
		country={page.data.country}
		onClose={() => (selected = null)}
	/>
{/if}
