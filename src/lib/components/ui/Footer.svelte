<script lang="ts">
	import { resolve } from '$app/paths';
	import tmdbLogo from '$lib/assets/tmdb.svg';

	/**
	 * Attribution and the legal links.
	 *
	 * The TMDB notice is not decoration: their API terms require this exact
	 * sentence and their unmodified logo, kept less prominent than the app's own
	 * branding. Every title, poster, rating and air date in here comes from them,
	 * so the credit belongs on every page rather than buried on one.
	 */
</script>

<footer class="mt-auto border-t border-line/70">
	<div
		class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-7 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6"
	>
		<div class="flex items-start gap-3">
			<!-- Linked and unmodified, at a size that stays below the app wordmark. -->
			<a
				href="https://www.themoviedb.org"
				target="_blank"
				rel="noopener noreferrer"
				class="mt-0.5 flex-shrink-0 transition-opacity duration-200 hover:opacity-80"
			>
				<img src={tmdbLogo} alt="The Movie Database" width="72" height="9" />
			</a>
			<p class="max-w-sm leading-relaxed">
				This product uses the TMDB API but is not endorsed or certified by TMDB.
			</p>
		</div>

		<nav aria-label="Legal" class="flex flex-shrink-0 items-center gap-4">
			<a href={resolve('/terms')} class="transition-colors duration-200 hover:text-ink">Terms</a>
			<a href={resolve('/privacy')} class="transition-colors duration-200 hover:text-ink">
				Privacy
			</a>
		</nav>
	</div>
</footer>
