<script lang="ts">
	import type { SessionUser } from '$lib/types';

	interface Props {
		user: SessionUser;
	}

	let { user }: Props = $props();

	/** Fallback avatar when Google has no picture (or it fails to load). */
	const initial = $derived(user.name.trim().charAt(0).toUpperCase() || '?');
	let avatarFailed = $state(false);
</script>

<div class="flex items-center gap-2">
	<div
		class="flex items-center gap-2 rounded-full bg-white/5 py-1 pr-1 pl-1 ring-1 ring-white/10 sm:pr-3"
		title={user.email}
	>
		{#if user.avatarUrl && !avatarFailed}
			<img
				src={user.avatarUrl}
				alt=""
				width="28"
				height="28"
				class="h-7 w-7 rounded-full object-cover"
				referrerpolicy="no-referrer"
				onerror={() => (avatarFailed = true)}
			/>
		{:else}
			<span
				class="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300"
			>
				{initial}
			</span>
		{/if}
		<span class="hidden max-w-[10rem] truncate text-sm font-medium text-slate-200 sm:block">
			{user.name}
		</span>
	</div>

	<!-- Plain POST form: no JavaScript required, and CSRF-protected by SvelteKit. -->
	<form method="POST" action="/auth/logout">
		<button
			type="submit"
			class="rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200 sm:px-3 sm:py-1.5 sm:text-xs sm:font-semibold"
			aria-label="Sign out"
		>
			<span class="hidden sm:inline">Sign out</span>
			<span class="sm:hidden" aria-hidden="true">⏻</span>
		</button>
	</form>
</div>
