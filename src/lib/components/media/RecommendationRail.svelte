<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import DiscoverCard from './DiscoverCard.svelte';
	import { mediaKey } from '$lib/domain/media';
	import type { RecommendationRail } from '$lib/domain/recommendations';
	import type { MediaResult, SavedEntry } from '$lib/types';

	/**
	 * One row of suggestions, explained by the title it came from.
	 *
	 * The heading is the feature. A row of posters with no reason attached is
	 * indistinguishable from more trending; "Because you watched Silo" is what
	 * makes it worth reading, and what makes an off-target suggestion legible as
	 * a bad guess rather than as the app being random.
	 *
	 * A rail rather than a grid, for the same reason Continue watching is one:
	 * these are a sideline to Discover, and a grid would give them the weight of
	 * the main content while pushing trending off the screen.
	 */
	interface Props {
		rail: RecommendationRail;
		signedIn: boolean;
		/** Set on the row that lands above the fold. */
		priority?: boolean;
		/**
		 * The saved-state index, consulted rather than assumed.
		 *
		 * The loader already filters saved titles out of a rail, so this is
		 * normally all misses — but the card is the thing that knows how to say
		 * "in your list", and having it ask is what keeps a stale rail from
		 * offering to save something twice.
		 */
		saved: Record<string, SavedEntry>;
		onSelect: (item: MediaResult) => void;
		onAdd: (item: MediaResult) => SubmitFunction;
	}

	let { rail, signedIn, priority = false, saved, onSelect, onAdd }: Props = $props();

	/**
	 * How many tiles get the eager treatment when this row is the top of the page.
	 * Roughly one screen's worth at desktop width — beyond that they would only
	 * compete with the tile that is actually the LCP element.
	 */
	const EAGER_TILES = 4;

	const headingId = $derived(`rec-${rail.seedKey.replace(':', '-')}`);

	// Only ever claims what the list actually knows.
	const because = $derived(
		{
			watched: 'Because you watched',
			watching: "Because you're watching",
			saved: 'Because you saved'
		}[rail.seedState]
	);
</script>

<section aria-labelledby={headingId} class="mb-8">
	<!--
		The one heading on the page that is a sentence rather than a label.

		Every other section names a category — TRENDING THIS WEEK, SEARCH RESULTS —
		and small bold capitals are right for those. This one names a *title*, and a
		title set in capitals stops reading as the name of a thing; mixing the two
		cases in one line was worse still. So the whole line drops out of the label
		voice: muted lead-in, the title carried in the display face that the page
		heading uses, which is what gives it presence at this size without needing
		to be any louder.
	-->
	<div class="mb-3 flex items-baseline gap-2">
		<Icon name="sparkle" size={15} class="shrink-0 translate-y-0.5 text-brand-hi" />
		<h2 id={headingId} class="min-w-0 truncate text-[13px] text-ink-muted">
			{because}
			<span class="font-display text-[15px] font-bold tracking-tight text-ink">
				{rail.seedTitle}
			</span>
		</h2>
	</div>

	<!--
		The right edge fades instead of slicing.

		A rail is always wider than the screen, so some tile is always cut by the
		container — and a card severed through the middle of its button reads as a
		rendering fault rather than as "keep scrolling". The mask turns the same
		pixels into an affordance. The vertical padding is for the hover lift and
		the card shadow, which `overflow-x` would otherwise clip.

		`scroll-p*` has to repeat the horizontal padding. Snap points align to the
		*scrollport*, which is the padding box — so mandatory snapping pulled the
		first card past the page margin and left it flush against the screen edge,
		out of line with every other card on the page. It only showed up here
		because a rail short enough not to scroll never snaps.
	-->
	<div
		class="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-pl-4 items-stretch gap-3 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)] px-4 pt-2 pb-3 sm:-mx-6 sm:scroll-pl-6 sm:px-6"
	>
		{#each rail.items as item, index (mediaKey(item))}
			<!-- Stays a block: the tile is stretched by the row, and the card fills
			     it from there. Making this a flex row would leave the card sizing to
			     its own content width instead of to the tile. -->
			<div class="w-[9.5rem] flex-shrink-0 snap-start sm:w-[10.5rem]">
				<DiscoverCard
					{item}
					{signedIn}
					priority={priority && index < EAGER_TILES}
					saved={saved[mediaKey(item)] ?? null}
					onSelect={() => onSelect(item)}
					onSubmit={onAdd(item)}
				/>
			</div>
		{/each}
	</div>
</section>
