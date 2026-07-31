<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	/**
	 * The placeholder shown when a section has nothing to render.
	 *
	 * Always says what happened *and* what to do about it: an empty screen with
	 * no next step reads as a broken page rather than an expected state.
	 */
	interface Props {
		icon: IconName;
		title: string;
		hint?: string;
		/** Optional call to action (a link or button) under the hint. */
		action?: Snippet;
	}

	let { icon, title, hint, action }: Props = $props();
</script>

<div
	class="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-12 text-center sm:py-16"
>
	<span
		class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-hi text-ink-faint ring-1 ring-line"
	>
		<Icon name={icon} size={22} stroke={1.75} />
	</span>
	<p class="mt-4 font-display text-base font-semibold text-ink">{title}</p>
	{#if hint}<p class="mt-1.5 max-w-sm text-sm text-ink-muted">{hint}</p>{/if}
	{#if action}<div class="mt-5">{@render action()}</div>{/if}
</div>
