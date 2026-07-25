<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { toasts, type ToastType } from '$lib/stores/toasts.svelte';

	const styles: Record<ToastType, string> = {
		success: 'bg-emerald-500/95 text-white',
		error: 'bg-red-500/95 text-white',
		info: 'bg-slate-700/95 text-white'
	};
	const icons: Record<ToastType, string> = {
		success: '✓',
		error: '✕',
		info: 'ℹ'
	};
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
>
	{#each toasts.items as toast (toast.id)}
		<div
			role="status"
			in:fly={{ y: 24, duration: 250 }}
			out:fade={{ duration: 200 }}
			animate:flip={{ duration: 200 }}
			class="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg shadow-black/30 backdrop-blur {styles[
				toast.type
			]}"
		>
			<span class="text-base leading-none">{icons[toast.type]}</span>
			{toast.message}
		</div>
	{/each}
</div>
