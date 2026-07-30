<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';
	import type { countByStatus } from '$lib/watchlist';

	interface Props {
		counts: ReturnType<typeof countByStatus>;
		status: string;
		type: string;
		sort: string;
		query: string;
	}

	let {
		counts,
		status = $bindable(),
		type = $bindable(),
		sort = $bindable(),
		query = $bindable()
	}: Props = $props();

	// The extra lenses only earn their place once the list actually contains
	// something they would show — an empty tab is just noise on a phone.
	const statusOptions = $derived([
		{ value: 'all', label: 'All', count: counts.all },
		{ value: 'toWatch', label: 'To Watch', count: counts.toWatch },
		...(counts.inProgress > 0
			? [{ value: 'inProgress', label: 'Watching', count: counts.inProgress }]
			: []),
		...(counts.upcoming > 0
			? [{ value: 'upcoming', label: 'Upcoming', count: counts.upcoming }]
			: []),
		{ value: 'watched', label: 'Watched', count: counts.watched }
	]);
</script>

<div class="flex flex-wrap items-center gap-2">
	<label class="relative">
		<span class="sr-only">Filter your watchlist</span>
		<input
			type="search"
			bind:value={query}
			placeholder="Filter your list…"
			autocomplete="off"
			class="w-full rounded-xl border border-white/10 bg-slate-800/70 py-1.5 pr-3 pl-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none sm:w-44 sm:text-sm"
		/>
	</label>

	<SegmentedControl bind:value={status} options={statusOptions} />
	<SegmentedControl
		bind:value={type}
		options={[
			{ value: 'all', label: 'All' },
			{ value: 'movie', label: 'Movies' },
			{ value: 'tv', label: 'TV' }
		]}
	/>

	<label class="relative">
		<span class="sr-only">Sort watchlist</span>
		<select
			bind:value={sort}
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
