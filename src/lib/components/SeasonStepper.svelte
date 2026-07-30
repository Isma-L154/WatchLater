<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { SeasonProgress } from '$lib/progress';

	/**
	 * Compact season counter for a watchlist card.
	 *
	 * Both buttons submit the same form with an *absolute* target season rather
	 * than a delta, so a double-tap or a replayed request can never drift the
	 * count — the server simply writes the same number twice.
	 */
	interface Props {
		itemId: string;
		title: string;
		progress: SeasonProgress;
		onSubmit: SubmitFunction;
	}

	let { itemId, title, progress, onSubmit }: Props = $props();

	const complete = $derived(progress.state === 'complete');
	const buttonClass =
		'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-slate-300 ring-1 ring-white/10 ring-inset transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30';
</script>

<div class="space-y-1.5">
	<!-- Progress bar: a 2px rule reads the shape of the list at a glance without
	     adding visual weight to every card. -->
	<div class="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
		<div
			class="h-full rounded-full transition-[width] duration-300 {complete
				? 'bg-emerald-400'
				: 'bg-sky-400'}"
			style:width="{progress.percent}%"
		></div>
	</div>

	<form method="POST" action="?/setSeasons" use:enhance={onSubmit} class="flex items-center gap-1">
		<input type="hidden" name="id" value={itemId} />
		<button
			type="submit"
			name="seasons"
			value={progress.seasonsSeen - 1}
			disabled={progress.seasonsSeen === 0}
			class={buttonClass}
			aria-label={`Mark one fewer season of ${title} as watched`}
		>
			−
		</button>

		<span
			class="flex-1 text-center text-[11px] font-semibold tabular-nums {complete
				? 'text-emerald-400'
				: 'text-slate-400'}"
			title={progress.label}
		>
			{progress.seasonsSeen}/{progress.totalSeasons}
		</span>

		<button
			type="submit"
			name="seasons"
			value={progress.seasonsSeen + 1}
			disabled={complete}
			class={buttonClass}
			aria-label={`Mark season ${progress.seasonsSeen + 1} of ${title} as watched`}
		>
			+
		</button>
	</form>
</div>
