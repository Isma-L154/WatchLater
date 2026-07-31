<script lang="ts">
	import { POSTER_GRID } from './PosterGrid.svelte';

	/**
	 * Loading placeholders for a poster grid.
	 *
	 * Mirrors the real card's geometry exactly — same grid, same 2:3 poster, same
	 * footer height — so results replace the skeleton without shifting anything
	 * already on screen.
	 */
	interface Props {
		count?: number;
	}

	let { count = 10 }: Props = $props();
</script>

<div class={POSTER_GRID} aria-hidden="true">
	{#each { length: count }, index (index)}
		<div class="animate-pulse overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
			<div class="aspect-[2/3] w-full bg-surface-hi"></div>
			<div class="space-y-2 p-3">
				<div class="h-3 w-3/4 rounded bg-surface-hi"></div>
				<div class="h-2 w-1/3 rounded bg-surface-hi"></div>
				<div class="h-[38px] w-full rounded-xl bg-surface-hi"></div>
			</div>
		</div>
	{/each}
</div>
