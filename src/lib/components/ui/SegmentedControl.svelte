<script lang="ts">
	interface Option {
		value: string;
		label: string;
		count?: number;
	}

	interface Props {
		options: Option[];
		value: string;
		/** Describes the group for screen readers, e.g. "Filter by status". */
		label: string;
	}

	let { options, value = $bindable(), label }: Props = $props();

	let buttons: HTMLButtonElement[] = $state([]);

	const selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);

	/**
	 * Keyboard model for a radio group, which the `role` alone does not provide:
	 * declaring `role="radio"` promises this behaviour to assistive tech, so not
	 * implementing it is worse than using plain buttons.
	 *
	 * Arrows move selection (and focus) between options and wrap around; combined
	 * with the roving tabindex below, the whole group is one Tab stop rather than
	 * five, which is what a native radio group does.
	 */
	function onKeyDown(event: KeyboardEvent) {
		const { key } = event;
		const last = options.length - 1;

		let next: number | null = null;
		if (key === 'ArrowRight' || key === 'ArrowDown')
			next = selectedIndex === last ? 0 : selectedIndex + 1;
		else if (key === 'ArrowLeft' || key === 'ArrowUp')
			next = selectedIndex === 0 ? last : selectedIndex - 1;
		else if (key === 'Home') next = 0;
		else if (key === 'End') next = last;

		if (next === null) return;
		event.preventDefault();
		value = options[next].value;
		buttons[next]?.focus();
	}
</script>

<!--
	`overflow-x-auto` keeps a long set of options on one line on narrow screens
	instead of letting labels wrap mid-word.

	The group carries `tabindex={-1}` rather than `0`: it is not a tab stop of its
	own — focus lives on the radios via the roving tabindex above, so Tab enters
	the group once and arrows move within it.
-->
<div
	role="radiogroup"
	aria-label={label}
	onkeydown={onKeyDown}
	tabindex={-1}
	class="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-line"
>
	{#each options as option, index (option.value)}
		{@const selected = value === option.value}
		<button
			bind:this={buttons[index]}
			type="button"
			role="radio"
			aria-checked={selected}
			tabindex={index === selectedIndex ? 0 : -1}
			onclick={() => (value = option.value)}
			class="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200 sm:text-sm
				{selected ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:bg-surface-hi hover:text-ink'}"
		>
			{option.label}
			{#if option.count !== undefined}
				<span
					class="rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums transition-colors duration-200
						{selected ? 'bg-white/25 text-white' : 'bg-surface-hi text-ink-faint'}"
				>
					{option.count}
				</span>
			{/if}
		</button>
	{/each}
</div>
