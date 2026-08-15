<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The reading column for the legal pages.
	 *
	 * Deliberately narrow and plainly styled. Terms nobody can read are terms
	 * nobody agreed to, so the constraint here is line length and heading
	 * rhythm rather than anything decorative.
	 */
	interface Props {
		title: string;
		/** ISO date the text last changed, shown so staleness is visible. */
		updated: string;
		children: Snippet;
	}

	let { title, updated, children }: Props = $props();
</script>

<div class="py-8 sm:py-12">
	<div class="mx-auto max-w-2xl">
		<h1 class="font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
		<p class="mt-1.5 text-xs text-ink-faint">Last updated {updated}</p>

		<div
			class="mt-8 space-y-6 text-sm leading-relaxed text-ink-muted
				[&_a]:text-brand-hi [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand
				[&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink
				[&_li]:mt-1.5 [&_strong]:font-semibold [&_strong]:text-ink
				[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
		>
			{@render children()}
		</div>
	</div>
</div>
