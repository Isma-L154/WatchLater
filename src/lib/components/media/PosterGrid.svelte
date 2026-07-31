<script lang="ts" module>
	/**
	 * The one grid geometry every poster list uses.
	 *
	 * Exported as a constant rather than duplicated per page: two grids that are
	 * *almost* the same is the most common way a responsive layout starts to look
	 * accidental, and the loading skeleton has to match the real grid exactly or
	 * the page visibly reflows when results land.
	 */
	export const POSTER_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class={POSTER_GRID}>{@render children()}</div>
