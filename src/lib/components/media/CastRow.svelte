<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import ScrollRail from '$lib/components/ui/ScrollRail.svelte';
	import { profileUrl } from '$lib/format/tmdb-image';
	import type { CastMember } from '$lib/types';

	/**
	 * Faces, for the "where do I know them from" question a synopsis never
	 * answers. Renders nothing when TMDB has no cast.
	 *
	 * A `ScrollRail` rather than a bare overflow container: a full billed cast
	 * runs well past the width of the sheet, and with the scrollbar hidden a
	 * mouse had no way to reach past the fourth or fifth face.
	 */
	interface Props {
		cast: CastMember[];
	}

	let { cast }: Props = $props();
</script>

{#if cast.length}
	<h3 class="mt-7 text-sm font-bold tracking-wide text-ink-muted uppercase">Cast</h3>
	<div class="mt-1">
		<ScrollRail label="Cast">
			{#each cast as person (person.name + '|' + person.character)}
				{@const profile = profileUrl(person.profilePath)}
				<div class="w-20 flex-shrink-0 snap-start text-center">
					<div
						class="mx-auto h-20 w-20 overflow-hidden rounded-full bg-surface-hi ring-1 ring-line"
					>
						{#if profile}
							<img
								src={profile}
								alt={person.name}
								loading="lazy"
								class="h-full w-full object-cover"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-ink-faint">
								<Icon name="user" size={22} stroke={1.5} />
							</div>
						{/if}
					</div>
					<p class="mt-1.5 line-clamp-2 text-[11px] font-medium text-ink">{person.name}</p>
					{#if person.character}
						<p class="line-clamp-1 text-[10px] text-ink-faint">{person.character}</p>
					{/if}
				</div>
			{/each}
		</ScrollRail>
	</div>
{/if}
