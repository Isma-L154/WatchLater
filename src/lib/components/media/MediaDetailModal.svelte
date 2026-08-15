<script lang="ts">
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import SeasonPicker from './SeasonPicker.svelte';
	import EpisodePicker from './EpisodePicker.svelte';
	import WatchProviders from './WatchProviders.svelte';
	import { getEpisodePosition } from '$lib/domain/episodes';
	import { backdropUrl, formatRuntime, posterUrl, profileUrl, releaseYear } from '$lib/tmdb-image';
	import { getReleaseInfo, releaseVerb } from '$lib/domain/release';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { MediaDetails, MediaType, SavedEntry } from '$lib/types';

	interface Props {
		tmdbId: number;
		mediaType: MediaType;
		/** The saved row when this title is already on the list, otherwise null. */
		saved: SavedEntry | null;
		/** Saving requires an account; signed-out visitors get a sign-in prompt. */
		signedIn: boolean;
		/** ISO country for streaming availability, resolved at the edge. */
		country: string;
		onClose: () => void;
	}

	let { tmdbId, mediaType, saved, signedIn, country, onClose }: Props = $props();

	let details = $state<MediaDetails | null>(null);
	let loading = $state(true);
	let loadError = $state(false);
	let showTrailer = $state(false);
	let dialog = $state<HTMLElement | null>(null);

	/**
	 * Which season's episodes to request: the one in progress. Derived from the
	 * saved row rather than from the details response, so the request can be made
	 * in the same round-trip that fetches the details themselves.
	 */
	const position = $derived(
		saved && mediaType === 'tv'
			? getEpisodePosition({ mediaType, ...saved, episodesIntoSeason: saved.episodesIntoSeason })
			: null
	);

	// Refetch whenever the selected title, or the season being tracked, changes.
	$effect(() => {
		void loadDetails(tmdbId, mediaType, country, position?.trackable ? position.season : null);
	});

	/**
	 * Open/close side effects: lock the background scroll and hand focus back to
	 * whatever opened the sheet.
	 *
	 * Deliberately reads nothing reactive — `dialog` is untracked — so it runs
	 * exactly once per mount. Folding this together with the key handler below
	 * would tie it to `onClose`, which is an inline arrow in the parent and so
	 * gets a fresh identity on every re-render; a single form action would then
	 * tear the effect down mid-session, bounce focus, and re-capture
	 * `previouslyFocused` as the dialog itself — leaving the final close to
	 * restore focus to a node that no longer exists.
	 */
	$effect(() => {
		const previousOverflow = document.body.style.overflow;
		const previouslyFocused = document.activeElement as HTMLElement | null;

		document.body.style.overflow = 'hidden';
		untrack(() => dialog)?.focus();

		return () => {
			document.body.style.overflow = previousOverflow;
			previouslyFocused?.focus();
		};
	});

	/**
	 * Escape to close, and a focus trap for Tab.
	 *
	 * Without the trap, tabbing walks straight out of the dialog and into the page
	 * behind it — which is still there, still interactive, and now invisible to a
	 * screen-reader user who has no way of knowing they left.
	 */
	$effect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
				return;
			}
			if (event.key !== 'Tab' || !dialog) return;

			// Queried per keypress rather than cached: the sheet's focusable set
			// changes as it loads, and as the trailer and save/remove controls swap.
			const focusable = [
				...dialog.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'
				)
			].filter((element) => element.offsetParent !== null || element === document.activeElement);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	async function loadDetails(id: number, type: MediaType, region: string, season: number | null) {
		loading = true;
		loadError = false;
		showTrailer = false;
		details = null;
		try {
			const query = season ? `?country=${region}&season=${season}` : `?country=${region}`;
			const response = await fetch(`/api/details/${type}/${id}${query}`);
			if (!response.ok) throw new Error('Request failed');
			details = (await response.json()) as MediaDetails;
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	const withToast =
		(message: string, type: 'success' | 'info' = 'success'): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') toasts.add(message, type);
			else if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
		};

	const backdrop = $derived(details ? backdropUrl(details.backdropPath) : null);
	const poster = $derived(details ? posterUrl(details.posterPath, 'w342') : null);

	// Human-readable meta line: "2024 · 3 seasons · 1h 58m".
	const meta = $derived.by(() => {
		if (!details) return '';
		const parts: string[] = [];
		const year = releaseYear(details.releaseDate);
		if (year) parts.push(year);
		if (details.mediaType === 'tv' && details.seasons) {
			parts.push(`${details.seasons} season${details.seasons > 1 ? 's' : ''}`);
		}
		const runtime = formatRuntime(details.runtimeMinutes);
		if (runtime) parts.push(runtime);
		return parts.join(' · ');
	});

	const release = $derived(details ? getReleaseInfo(details.releaseDate) : null);

	/**
	 * Countdown wording for the release banner. Kept separate from the date so
	 * the banner reads as "when" followed by "how soon".
	 */
	const countdown = $derived.by(() => {
		const days = release?.daysUntil;
		if (!days) return '';
		if (days === 1) return 'tomorrow';
		if (days < 30) return `in ${days} days`;
		const months = Math.round(days / 30);
		if (months < 12) return `in about ${months} month${months > 1 ? 's' : ''}`;
		const years = Math.round(days / 365);
		return `in about ${years} year${years > 1 ? 's' : ''}`;
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="fixed inset-0 z-40 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
	transition:fade={{ duration: 150 }}
	onclick={onClose}
	role="presentation"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={dialog}
		class="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-surface shadow-2xl ring-1 ring-line sm:rounded-3xl"
		transition:fly={{ y: 40, duration: 220, opacity: 1 }}
		onclick={(event) => event.stopPropagation()}
		role="dialog"
		aria-modal="true"
		aria-label={details?.title ?? 'Title details'}
		tabindex="-1"
	>
		<!-- Grab handle: the bottom-sheet affordance people expect on a phone. -->
		<div class="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center sm:hidden">
			<span class="h-1 w-10 rounded-full bg-white/25"></span>
		</div>

		<button
			type="button"
			onclick={onClose}
			aria-label="Close"
			class="absolute top-3 right-3 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/55 text-ink backdrop-blur transition-colors duration-200 hover:bg-black/75"
		>
			<Icon name="close" size={18} />
		</button>

		{#if loading}
			<div class="flex h-72 items-center justify-center">
				<span
					class="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-hi"
					role="status"
					aria-label="Loading details"
				></span>
			</div>
		{:else if loadError || !details}
			<div class="flex h-72 flex-col items-center justify-center gap-3 px-6 text-center">
				<Icon name="alert" size={28} class="text-ink-faint" />
				<p class="text-ink-muted">Couldn't load details.</p>
				<button
					type="button"
					onclick={() =>
						loadDetails(tmdbId, mediaType, country, position?.trackable ? position.season : null)}
					class="cursor-pointer rounded-lg bg-surface-hi px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line transition-colors duration-200 hover:bg-line"
				>
					Try again
				</button>
			</div>
		{:else}
			<!-- Header: backdrop image or embedded trailer -->
			<div class="relative aspect-video w-full overflow-hidden bg-surface-hi">
				{#if showTrailer && details.trailerKey}
					<iframe
						class="h-full w-full"
						title={`${details.title} trailer`}
						src={`https://www.youtube-nocookie.com/embed/${details.trailerKey}?autoplay=1&rel=0`}
						allow="autoplay; encrypted-media; fullscreen"
						allowfullscreen
					></iframe>
				{:else}
					{#if backdrop}
						<img src={backdrop} alt="" class="h-full w-full object-cover" />
					{/if}
					<div
						class="absolute inset-0 bg-gradient-to-t from-surface via-surface/45 to-transparent"
					></div>
					{#if details.trailerKey}
						<button
							type="button"
							onclick={() => (showTrailer = true)}
							class="absolute inset-0 flex cursor-pointer items-center justify-center"
							aria-label={`Play the ${details.title} trailer`}
						>
							<span
								class="flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors duration-200 hover:bg-white/25"
							>
								<Icon name="play" size={16} filled /> Play trailer
							</span>
						</button>
					{/if}
				{/if}
			</div>

			<!-- Body -->
			<div class="relative -mt-14 px-4 pb-8 sm:px-6">
				<div class="flex gap-4">
					{#if poster}
						<img
							src={poster}
							alt={`${details.title} poster`}
							class="h-36 w-24 flex-shrink-0 rounded-xl object-cover shadow-lg ring-1 ring-line sm:h-44 sm:w-28"
						/>
					{/if}
					<div class="min-w-0 flex-1 pt-14">
						<h2 class="font-display text-xl leading-tight font-extrabold text-ink sm:text-2xl">
							{details.title}
						</h2>
						{#if meta}<p class="mt-1 text-sm text-ink-muted">{meta}</p>{/if}
						{#if details.voteAverage}
							<p class="mt-1.5 flex items-center gap-1 text-sm font-bold text-gold">
								<Icon name="star" size={14} filled />
								{details.voteAverage.toFixed(1)}
							</p>
						{/if}
					</div>
				</div>

				<!-- Unreleased banner. TMDB indexes titles long before they come out,
				     so this states plainly that the title isn't watchable yet. -->
				{#if release && release.state !== 'released'}
					<div
						class="mt-5 flex items-start gap-3 rounded-2xl border border-amber/20 bg-amber/[0.06] px-4 py-3"
					>
						<span class="relative mt-1.5 flex h-2 w-2 flex-shrink-0">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-70"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-amber"></span>
						</span>
						<div class="min-w-0">
							<p class="text-[11px] font-bold tracking-widest text-amber uppercase">Not out yet</p>
							{#if release.state === 'upcoming'}
								<p class="mt-0.5 text-sm text-ink">
									{releaseVerb(details.mediaType)}
									{release.fullDate}
								</p>
								<p class="mt-0.5 text-xs text-amber/75">
									{countdown}{details.productionStatus
										? ` · ${details.productionStatus.toLowerCase()}`
										: ''}
								</p>
							{:else}
								<p class="mt-0.5 text-sm text-ink">No release date announced yet.</p>
								{#if details.productionStatus}
									<p class="mt-0.5 text-xs text-amber/75">
										Currently {details.productionStatus.toLowerCase()}
									</p>
								{/if}
							{/if}
						</div>
					</div>
				{/if}

				<!--
					Season progress sits directly under the header, above genres and
					synopsis. For a show you are already watching this is the reason you
					opened the sheet; the plot summary is not.
				-->
				{#if saved && details.mediaType === 'tv' && details.airedSeasons && details.airedSeasons > 1}
					<SeasonPicker
						itemId={saved.id}
						title={details.title}
						airedSeasons={details.airedSeasons}
						totalSeasons={details.seasons ?? details.airedSeasons}
						upcomingSeason={details.upcomingSeason}
						seasonsSeen={saved.watched ? details.airedSeasons : saved.seasonsSeen}
					/>
				{/if}

				<!-- Episodes sit right under the season row: the season picker says
				     which season, this says where inside it. -->
				{#if saved && position?.trackable && details.season}
					<EpisodePicker
						itemId={saved.id}
						title={details.title}
						season={details.season}
						episodesWatched={position.episodesWatched}
					/>
				{/if}

				{#if details.watch}
					<WatchProviders watch={details.watch} title={details.title} />
				{/if}

				{#if details.genres.length}
					<div class="mt-5 flex flex-wrap gap-2">
						{#each details.genres as genre (genre)}
							<span
								class="rounded-full bg-surface-hi px-3 py-1 text-xs font-medium text-ink-muted ring-1 ring-line"
							>
								{genre}
							</span>
						{/each}
					</div>
				{/if}

				{#if details.tagline}
					<p class="mt-4 text-sm text-ink-muted italic">“{details.tagline}”</p>
				{/if}

				{#if details.overview}
					<p class="mt-3 text-sm leading-relaxed text-ink-muted">{details.overview}</p>
				{/if}

				<!-- Save / remove -->
				<div class="mt-6">
					{#if !signedIn}
						<GoogleButton size="full" label="Sign in to save this" />
					{:else if saved}
						<form
							method="POST"
							action="?/remove"
							use:enhance={withToast(`Removed “${details.title}”`, 'info')}
						>
							<input type="hidden" name="id" value={saved.id} />
							<button
								type="submit"
								class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose/12 py-3 text-sm font-semibold text-rose transition-colors duration-200 hover:bg-rose/22"
							>
								<Icon name="trash" size={16} /> Remove from my list
							</button>
						</form>
					{:else}
						<form method="POST" action="?/add" use:enhance={withToast(`Added “${details.title}”`)}>
							<input type="hidden" name="tmdbId" value={details.tmdbId} />
							<input type="hidden" name="mediaType" value={details.mediaType} />
							<input type="hidden" name="title" value={details.title} />
							<input type="hidden" name="posterPath" value={details.posterPath ?? ''} />
							<input type="hidden" name="releaseDate" value={details.releaseDate ?? ''} />
							<input type="hidden" name="overview" value={details.overview ?? ''} />
							<input type="hidden" name="voteAverage" value={details.voteAverage ?? ''} />
							<button
								type="submit"
								class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-colors duration-200 hover:bg-brand-hi"
							>
								<Icon name="plus" size={16} stroke={2.5} /> Save to my list
							</button>
						</form>
					{/if}
				</div>

				<!-- Cast -->
				{#if details.cast.length}
					<h3 class="mt-7 text-sm font-bold tracking-wide text-ink-muted uppercase">Cast</h3>
					<div class="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
						{#each details.cast as person (person.name + '|' + person.character)}
							<div class="w-20 flex-shrink-0 text-center">
								<div
									class="mx-auto h-20 w-20 overflow-hidden rounded-full bg-surface-hi ring-1 ring-line"
								>
									{#if profileUrl(person.profilePath)}
										<img
											src={profileUrl(person.profilePath)}
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
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
