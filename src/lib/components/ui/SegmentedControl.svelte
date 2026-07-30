<script lang="ts">
	interface Option {
		value: string;
		label: string;
		count?: number;
	}

	interface Props {
		options: Option[];
		value: string;
	}

	let { options, value = $bindable() }: Props = $props();
</script>

<!-- `max-w-full` + horizontal scroll keeps a long set of options on one line on
     narrow screens instead of letting labels wrap mid-word. -->
<div
	class="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-800/70 p-1 ring-1 ring-white/5"
>
	{#each options as option (option.value)}
		<button
			type="button"
			onclick={() => (value = option.value)}
			class="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:text-sm
				{value === option.value
				? 'bg-sky-500 text-white shadow-sm'
				: 'text-slate-400 hover:text-slate-200'}"
		>
			{option.label}
			{#if option.count !== undefined}
				<span
					class="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums
						{value === option.value ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}"
				>
					{option.count}
				</span>
			{/if}
		</button>
	{/each}
</div>
