<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { toasts } from '$lib/stores/toasts.svelte';

	/**
	 * Full season picker for the detail sheet.
	 *
	 * The card tracker answers "advance me by one"; this answers "I binged four
	 * seasons over the weekend" — jumping straight to a season is a single tap
	 * instead of four round-trips through the stepper.
	 *
	 * Season counts come from the live TMDB payload rather than the stored row, so
	 * an entry saved before season tracking existed can start tracking from here.
	 * The server still resolves the authoritative total before it writes.
	 */
	interface Props {
		itemId: string;
		title: string;
		totalSeasons: number;
		seasonsSeen: number;
	}

	let { itemId, title, totalSeasons, seasonsSeen }: Props = $props();

	const complete = $derived(seasonsSeen >= totalSeasons);
	const nextSeason = $derived(seasonsSeen + 1);

	const summary = $derived(
		seasonsSeen === 0
			? 'Not started'
			: complete
				? `All ${totalSeasons} seasons watched`
				: `Season ${seasonsSeen} of ${totalSeasons}`
	);

	/**
	 * Feedback comes from the server's response rather than the pre-click state:
	 * the action may have discovered a newly aired season, so only it knows
	 * whether the show is actually finished.
	 */
	const onSubmit: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type !== 'success') {
				if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
				return;
			}
			const payload = result.data as { seasonsSeen?: number; totalSeasons?: number } | undefined;
			const seen = payload?.seasonsSeen ?? 0;
			const total = payload?.totalSeasons ?? 0;

			if (total && seen >= total) toasts.add(`Finished “${title}” 🎉`);
			else if (seen === 0) toasts.add(`Reset progress for “${title}”`, 'info');
			else toasts.add(`Season ${seen} watched`);
		};
	};
</script>

<section
	aria-labelledby="season-progress-heading"
	class="mt-6 rounded-2xl bg-canvas/60 p-4 ring-1 ring-line"
>
	<div class="flex items-baseline justify-between gap-3">
		<h3
			id="season-progress-heading"
			class="text-[11px] font-bold tracking-widest text-ink-muted uppercase"
		>
			Season progress
		</h3>
		<span class="text-xs font-semibold {complete ? 'text-mint' : 'text-ink-muted'}">{summary}</span>
	</div>

	<form method="POST" action="?/setSeasons" use:enhance={onSubmit} class="mt-3">
		<input type="hidden" name="id" value={itemId} />

		<!--
			Tapping the season you are already on steps back one, so the row doubles
			as its own undo and there is no separate "reset" control to explain.
		-->
		<div class="flex flex-wrap gap-1.5">
			{#each { length: totalSeasons }, index (index)}
				{@const season = index + 1}
				{@const seen = season <= seasonsSeen}
				<button
					type="submit"
					name="seasons"
					value={season === seasonsSeen ? season - 1 : season}
					aria-pressed={seen}
					aria-label={season === seasonsSeen
						? `Mark season ${season} of ${title} as unwatched`
						: `Mark seasons 1 to ${season} of ${title} as watched`}
					class="h-9 min-w-9 cursor-pointer rounded-lg px-2.5 text-xs font-bold tabular-nums transition-colors duration-200 active:scale-95
						{seen
						? 'bg-brand text-white hover:bg-brand-hi'
						: 'bg-surface-hi text-ink-faint ring-1 ring-line ring-inset hover:bg-line hover:text-ink'}"
				>
					{season}
				</button>
			{/each}
		</div>

		<!-- The single most likely next action, named explicitly so it needs no
		     interpretation of the pill row above it. -->
		{#if !complete}
			<button
				type="submit"
				name="seasons"
				value={nextSeason}
				class="mt-3 flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand/15 text-sm font-semibold text-brand-hi ring-1 ring-brand/25 transition-colors duration-200 ring-inset hover:bg-brand/25"
			>
				<Icon name="play" size={14} filled />
				Watched season {nextSeason}
			</button>
		{/if}
	</form>
</section>
