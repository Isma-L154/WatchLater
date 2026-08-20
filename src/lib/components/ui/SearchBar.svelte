<script lang="ts">
	import Icon from './Icon.svelte';
	import type { MediaSearch } from '$lib/stores/search.svelte';

	interface Props {
		search: MediaSearch;
		placeholder?: string;
	}

	let { search, placeholder = 'Search movies and TV shows…' }: Props = $props();
</script>

<label class="relative block">
	<span class="sr-only">Search movies and TV shows</span>

	<span
		class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint"
		aria-hidden="true"
	>
		{#if search.loading}
			<span
				class="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-line border-t-brand-hi"
			></span>
		{:else}
			<Icon name="search" size={18} />
		{/if}
	</span>

	<!--
		16px on mobile is not a style choice: below it, iOS Safari zooms the whole
		page on focus and never zooms back out.
	-->
	<input
		type="search"
		bind:value={search.query}
		oninput={search.onInput}
		{placeholder}
		autocomplete="off"
		enterkeyhint="search"
		class="w-full rounded-2xl border border-line bg-surface py-3.5 pr-12 pl-11 text-base text-ink shadow-inner shadow-black/20 transition-colors duration-200 placeholder:text-ink-faint focus:border-brand focus:bg-surface-hi"
	/>

	{#if search.active}
		<button
			type="button"
			onclick={search.clear}
			aria-label="Clear search"
			class="absolute top-1/2 right-1.5 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors duration-200 hover:bg-surface-hi hover:text-ink"
		>
			<Icon name="close" size={16} />
		</button>
	{/if}
</label>

<!-- Announces result counts to screen readers without stealing focus. -->
<p class="sr-only" role="status" aria-live="polite">
	{#if search.loading}
		Searching…
	{:else if search.active}
		{search.results.length} results for {search.query}
	{/if}
</p>
