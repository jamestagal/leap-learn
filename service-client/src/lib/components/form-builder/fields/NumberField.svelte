<script lang="ts">
	/**
	 * NumberField - Numeric input with min/max validation
	 */
	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		placeholder?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: number | undefined;
		min?: number | undefined;
		max?: number | undefined;
		step?: number | undefined;
		onchange: (value: number | undefined) => void;
	}

	let {
		id,
		name,
		label,
		description,
		placeholder = "0",
		required = false,
		disabled = false,
		error,
		value,
		min,
		max,
		step = 1,
		onchange,
	}: Props = $props();

	function handleInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		const numValue = target.value ? Number(target.value) : undefined;
		onchange(numValue);
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

	<input
		{id}
		{name}
		type="number"
		class="input input-bordered w-full"
		class:input-error={!!error}
		{placeholder}
		{disabled}
		value={value ?? ""}
		{min}
		{max}
		{step}
		{required}
		oninput={handleInput}
	/>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
