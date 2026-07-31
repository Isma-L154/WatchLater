<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import Toaster from '$lib/components/ui/Toaster.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<AppShell user={data.user} authAvailable={data.authAvailable} watchlistCount={data.watchlistCount}>
	{@render children()}
</AppShell>

<Toaster />
