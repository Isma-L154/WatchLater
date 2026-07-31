<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SeasonTracker from './SeasonTracker.svelte';
	import { getSeasonProgress } from '$lib/domain/progress';
	import { posterUrl } from '$lib/tmdb-image';
	import type { WatchlistItem } from '$lib/server/db/schema';

	/**
	 * "What was I in the middle of?" — the first question anyone opens a watchlist
	 * to answer, and the one a flat grid of posters answers worst.
	 *
	 * Started-but-unfinished shows are pulled out of the grid into a rail at the
	 * top, each with its progress and a one-tap advance. It is deliberately a
	 * horizontal rail rather than a grid: the set is small, and the partially
	 * visible next card is what tells you there is more without spending a full
	 * row of vertical space.
	 */
	interface Props {
		items: WatchlistItem[];
		onSelect: (item: WatchlistItem) => void;
		onSetSeasons: (item: WatchlistItem) => SubmitFunction;
	}

	let { items, onSelect, onSetSeasons }: Props = $props();
</script>

{#if items.length > 0}
	<section aria-labelledby="continue-heading" class="mb-8">
		<div class="mb-3 flex items-center gap-2">
			<Icon name="play" size={16} filled class="text-brand-hi" />
			<h2 id="continue-heading" class="text-sm font-bold tracking-wide text-ink uppercase">
				Continue watching
			</h2>
			<span class="text-xs text-ink-faint">({items.length})</span>
		</div>

		<div
			class="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
		>
			{#each items as item (item.id)}
				{@const progress = getSeasonProgress(item)}
				{@const poster = posterUrl(item.posterPath, 'w185')}
				<article
					class="flex w-[17rem] flex-shrink-0 snap-start gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line transition-colors duration-200 hover:ring-brand/40 sm:w-[19rem]"
				>
					<button
						type="button"
						onclick={() => onSelect(item)}
						aria-label={`View details for ${item.title}`}
						class="h-24 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-surface-hi sm:h-28 sm:w-[4.75rem]"
					>
						{#if poster}
							<img
								src={poster}
								alt=""
								loading="lazy"
								class="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
							/>
						{:else}
							<span class="flex h-full w-full items-center justify-center text-ink-faint">
								<Icon name="image" size={20} />
							</span>
						{/if}
					</button>

					<div class="flex min-w-0 flex-1 flex-col justify-between gap-2">
						<div class="min-w-0">
							<button
								type="button"
								onclick={() => onSelect(item)}
								title={item.title}
								class="line-clamp-2 cursor-pointer text-left text-sm leading-snug font-semibold text-ink transition-colors duration-200 hover:text-brand-hi"
							>
								{item.title}
							</button>
							<p class="mt-0.5 text-[11px] text-ink-faint">{progress.label}</p>
						</div>

						<SeasonTracker
							itemId={item.id}
							title={item.title}
							{progress}
							onSubmit={onSetSeasons(item)}
							variant="rail"
						/>
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}
