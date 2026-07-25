<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		backdropUrl,
		formatRuntime,
		posterUrl,
		profileUrl,
		releaseYear
	} from '$lib/tmdb-image';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { MediaDetails, MediaType } from '$lib/types';

	interface Props {
		tmdbId: number;
		mediaType: MediaType;
		/** DB id when the title is already saved, otherwise null. */
		savedId: string | null;
		onClose: () => void;
	}

	let { tmdbId, mediaType, savedId, onClose }: Props = $props();

	let details = $state<MediaDetails | null>(null);
	let loading = $state(true);
	let loadError = $state(false);
	let showTrailer = $state(false);

	// Refetch whenever the selected title changes.
	$effect(() => {
		void loadDetails(tmdbId, mediaType);
	});

	// Lock background scroll while open and close on Escape.
	$effect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKey);
		};
	});

	async function loadDetails(id: number, type: MediaType) {
		loading = true;
		loadError = false;
		showTrailer = false;
		details = null;
		try {
			const response = await fetch(`/api/details/${type}/${id}`);
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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
	transition:fade={{ duration: 150 }}
	onclick={onClose}
	role="presentation"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl"
		transition:scale={{ start: 0.96, duration: 200 }}
		onclick={(event) => event.stopPropagation()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<button
			type="button"
			onclick={onClose}
			aria-label="Close"
			class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-slate-200 backdrop-blur transition hover:bg-black/70"
		>
			✕
		</button>

		{#if loading}
			<div class="flex h-72 items-center justify-center">
				<span
					class="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
				></span>
			</div>
		{:else if loadError || !details}
			<div class="flex h-72 flex-col items-center justify-center gap-2 text-center">
				<p class="text-3xl">😕</p>
				<p class="text-slate-400">Couldn't load details.</p>
				<button
					type="button"
					onclick={() => loadDetails(tmdbId, mediaType)}
					class="text-sm text-sky-400 hover:underline">Try again</button
				>
			</div>
		{:else}
			<!-- Header: backdrop image or embedded trailer -->
			<div class="relative aspect-video w-full overflow-hidden bg-slate-800">
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
						class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"
					></div>
					{#if details.trailerKey}
						<button
							type="button"
							onclick={() => (showTrailer = true)}
							class="absolute inset-0 flex items-center justify-center"
							aria-label="Play trailer"
						>
							<span
								class="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 font-semibold text-white backdrop-blur transition hover:bg-white/25"
							>
								▶ Play trailer
							</span>
						</button>
					{/if}
				{/if}
			</div>

			<!-- Body -->
			<div class="relative -mt-14 px-4 pb-6 sm:px-6">
				<div class="flex gap-4">
					{#if poster}
						<img
							src={poster}
							alt={`${details.title} poster`}
							class="h-36 w-24 flex-shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10 sm:h-44 sm:w-28"
						/>
					{/if}
					<div class="min-w-0 flex-1 pt-14">
						<h2 class="text-xl font-bold leading-tight text-slate-100 sm:text-2xl">
							{details.title}
						</h2>
						{#if meta}<p class="mt-1 text-sm text-slate-400">{meta}</p>{/if}
						{#if details.voteAverage}
							<p class="mt-1 text-sm font-semibold text-amber-300">
								★ {details.voteAverage.toFixed(1)}
							</p>
						{/if}
					</div>
				</div>

				{#if details.genres.length}
					<div class="mt-4 flex flex-wrap gap-2">
						{#each details.genres as genre (genre)}
							<span
								class="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/5"
							>
								{genre}
							</span>
						{/each}
					</div>
				{/if}

				{#if details.tagline}
					<p class="mt-4 text-sm italic text-slate-400">“{details.tagline}”</p>
				{/if}

				{#if details.overview}
					<p class="mt-3 text-sm leading-relaxed text-slate-300">{details.overview}</p>
				{/if}

				<!-- Save / remove -->
				<div class="mt-5">
					{#if savedId}
						<form
							method="POST"
							action="?/remove"
							use:enhance={withToast(`Removed “${details.title}”`, 'info')}
						>
							<input type="hidden" name="id" value={savedId} />
							<button
								type="submit"
								class="w-full rounded-xl bg-red-500/15 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/25"
							>
								✓ In your list — Remove
							</button>
						</form>
					{:else}
						<form
							method="POST"
							action="?/add"
							use:enhance={withToast(`Added “${details.title}”`)}
						>
							<input type="hidden" name="tmdbId" value={details.tmdbId} />
							<input type="hidden" name="mediaType" value={details.mediaType} />
							<input type="hidden" name="title" value={details.title} />
							<input type="hidden" name="posterPath" value={details.posterPath ?? ''} />
							<input type="hidden" name="releaseDate" value={details.releaseDate ?? ''} />
							<input type="hidden" name="overview" value={details.overview ?? ''} />
							<input type="hidden" name="voteAverage" value={details.voteAverage ?? ''} />
							<button
								type="submit"
								class="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
							>
								+ Add to Watch Later
							</button>
						</form>
					{/if}
				</div>

				<!-- Cast -->
				{#if details.cast.length}
					<h3 class="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">Cast</h3>
					<div class="mt-3 flex gap-3 overflow-x-auto pb-2">
						{#each details.cast as person (person.name + '|' + person.character)}
							<div class="w-20 flex-shrink-0 text-center">
								<div
									class="mx-auto h-20 w-20 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10"
								>
									{#if profileUrl(person.profilePath)}
										<img
											src={profileUrl(person.profilePath)}
											alt={person.name}
											loading="lazy"
											class="h-full w-full object-cover"
										/>
									{:else}
										<div class="flex h-full w-full items-center justify-center text-2xl text-slate-600">
											👤
										</div>
									{/if}
								</div>
								<p class="mt-1 line-clamp-2 text-[11px] font-medium text-slate-200">{person.name}</p>
								{#if person.character}
									<p class="line-clamp-1 text-[10px] text-slate-500">{person.character}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
