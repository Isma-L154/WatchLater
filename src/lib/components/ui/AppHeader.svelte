<script lang="ts">
	import AccountChip from '$lib/components/auth/AccountChip.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import type { SessionUser } from '$lib/types';

	interface Props {
		user: SessionUser | null;
		/** False when the deployment has no Google credentials configured. */
		authAvailable: boolean;
	}

	let { user, authAvailable }: Props = $props();
</script>

<header class="pt-6 pb-4 sm:pt-10">
	<div class="flex items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="text-3xl">🎬</span>
				<h1 class="text-2xl font-black tracking-tight sm:text-4xl">
					Watch<span
						class="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent"
						>Later</span
					>
				</h1>
			</div>
			<p class="mt-2 max-w-md text-sm text-slate-400 sm:text-base">
				Discover movies & TV shows and build your personal watchlist.
			</p>
		</div>

		<div class="flex-shrink-0 pt-1">
			{#if user}
				<AccountChip {user} />
			{:else if authAvailable}
				<GoogleButton />
			{/if}
		</div>
	</div>
</header>
