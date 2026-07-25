<script lang="ts">
	import { enhance } from '$app/forms';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import type { MediaResult } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let results = $state<MediaResult[]>([]);
	let searching = $state(false);
	let searchError = $state<string | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout>;

	// Fast lookup of already-saved titles ("<tmdbId>:<mediaType>") so search
	// results can instantly show an "in your list" state.
	const savedKeys = $derived(new Set(data.items.map((i) => `${i.tmdbId}:${i.mediaType}`)));
	const watchedCount = $derived(data.items.filter((i) => i.watched).length);

	/** Debounce keystrokes so we don't hit the API on every character. */
	function onInput() {
		clearTimeout(debounceTimer);
		const q = query.trim();
		if (!q) {
			results = [];
			searchError = null;
			return;
		}
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

	function key(tmdbId: number, mediaType: string): string {
		return `${tmdbId}:${mediaType}`;
	}
</script>

<svelte:head>
	<title>WatchLater — Your movie & TV watchlist</title>
	<meta name="description" content="Search movies and TV shows and save them to your personal watch-later list." />
</svelte:head>

<div class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-16 sm:px-6">
	<!-- Header -->
	<header class="py-6 sm:py-8">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
			🎬 Watch<span class="text-sky-400">Later</span>
		</h1>
		<p class="mt-1 text-sm text-slate-400">Search movies & TV shows and save them for later.</p>
	</header>

	<!-- Search bar -->
	<div class="sticky top-0 z-10 -mx-4 bg-slate-950/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
		<label class="relative block">
			<span class="sr-only">Search movies and TV shows</span>
			<input
				type="search"
				bind:value={query}
				oninput={onInput}
				placeholder="Search for a movie or TV show…"
				autocomplete="off"
				class="w-full rounded-xl border border-white/10 bg-slate-800/80 py-3 pl-11 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
			/>
			<span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
				{#if searching}
					<span class="block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400"></span>
				{:else}
					🔍
				{/if}
			</span>
		</label>
	</div>

	<!-- Search results -->
	{#if searchError}
		<p class="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{searchError}</p>
	{/if}

	{#if results.length > 0}
		<section class="mt-4">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Results</h2>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each results as item (key(item.tmdbId, item.mediaType))}
					<MediaCard
						title={item.title}
						posterPath={item.posterPath}
						releaseDate={item.releaseDate}
						voteAverage={item.voteAverage}
						mediaType={item.mediaType}
					>
						{#snippet actions()}
							{#if savedKeys.has(key(item.tmdbId, item.mediaType))}
								<span class="flex items-center justify-center rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-400">
									✓ In your list
								</span>
							{:else}
								<form method="POST" action="?/add" use:enhance>
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
				{/each}
			</div>
		</section>
	{:else if query.trim() && !searching && !searchError}
		<p class="mt-6 text-center text-sm text-slate-500">No results for “{query}”.</p>
	{/if}

	<!-- Watchlist -->
	<section class="mt-10">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Your Watchlist</h2>
			{#if data.items.length > 0}
				<span class="text-xs text-slate-500">
					{data.items.length} saved · {watchedCount} watched
				</span>
			{/if}
		</div>

		{#if data.items.length === 0}
			<div class="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
				<p class="text-slate-400">Your list is empty.</p>
				<p class="mt-1 text-sm text-slate-500">Search above and add something to watch later.</p>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each data.items as item (item.id)}
					<MediaCard
						title={item.title}
						posterPath={item.posterPath}
						releaseDate={item.releaseDate}
						voteAverage={item.voteAverage}
						mediaType={item.mediaType}
						dimmed={item.watched}
					>
						{#snippet actions()}
							<div class="flex gap-2">
								<form method="POST" action="?/toggleWatched" use:enhance class="flex-1">
									<input type="hidden" name="id" value={item.id} />
									<input type="hidden" name="watched" value={item.watched} />
									<button
										type="submit"
										class="w-full rounded-lg py-2 text-xs font-semibold transition active:scale-95
											{item.watched
											? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
											: 'bg-emerald-500/90 text-white hover:bg-emerald-400'}"
									>
										{item.watched ? '↺ Unwatch' : '✓ Watched'}
									</button>
								</form>
								<form method="POST" action="?/remove" use:enhance>
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
				{/each}
			</div>
		{/if}
	</section>
</div>
