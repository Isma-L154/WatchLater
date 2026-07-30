<script lang="ts">
	import type { MediaSearch } from '$lib/stores/search.svelte';

	interface Props {
		search: MediaSearch;
	}

	let { search }: Props = $props();
</script>

<!-- Stays pinned so the search box is reachable from anywhere on the page. -->
<div
	class="sticky top-0 z-20 -mx-4 border-b border-white/5 bg-slate-950/70 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6"
>
	<label class="relative block">
		<span class="sr-only">Search movies and TV shows</span>
		<span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500">
			{#if search.loading}
				<span
					class="block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
				></span>
			{:else}
				🔍
			{/if}
		</span>
		<input
			type="search"
			bind:value={search.query}
			oninput={search.onInput}
			placeholder="Search for a movie or TV show…"
			autocomplete="off"
			class="w-full rounded-xl border border-white/10 bg-slate-800/70 py-3 pr-11 pl-11 text-base text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-800 focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
		/>
		{#if search.active}
			<button
				type="button"
				onclick={search.clear}
				aria-label="Clear search"
				class="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
			>
				✕
			</button>
		{/if}
	</label>
</div>
