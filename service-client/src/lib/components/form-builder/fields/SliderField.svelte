<script lang="ts">
	/**
	 * SliderField - Range slider input
	 */
	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: number | undefined;
		min?: number | undefined;
		max?: number | undefined;
		step?: number | undefined;
		showValue?: boolean | undefined;
		onchange: (value: number) => void;
	}

	let {
		id,
		name,
		label,
		description,
		required = false,
		disabled = false,
		error,
		value,
		min = 0,
		max = 100,
		step = 1,
		showValue = true,
		onchange,
	}: Props = $props();

	let displayValue = $derived(value ?? min);

	function handleInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		onchange(Number(target.value));
	}
</script>

<div class="form-control w-full">
	<label class="label" for={id}>
		<span class="label-text">
			{label}
			{#if required}
				<span class="text-error ml-1">*</span>
			{/if}
		</span>
	</label>

	{#if description}
		<p class="text-xs text-base-content/60 mb-1">{description}</p>
	{/if}

	<div class="flex items-center gap-4">
		<input
			{id}
			{name}
			type="range"
			class="range range-primary flex-1"
			class:range-error={!!error}
			{disabled}
			value={displayValue}
			{min}
			{max}
			{step}
			oninput={handleInput}
		/>
		{#if showValue}
			<span class="text-sm font-medium w-12 text-right tabular-nums">
				{displayValue}
			</span>
		{/if}
	</div>

	<div class="flex justify-between text-xs text-base-content/50 mt-1">
		<span>{min}</span>
		<span>{max}</span>
	</div>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
