<script lang="ts">
	/**
	 * RadioField - Single-select radio buttons
	 */
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: string | undefined;
		options: Option[];
		onchange: (value: string) => void;
	}

	let {
		id,
		name,
		label,
		description,
		required = false,
		disabled = false,
		error,
		value = "",
		options = [],
		onchange,
	}: Props = $props();

	function handleChange(optionValue: string): void {
		onchange(optionValue);
	}
</script>

<div class="form-control w-full">
	<label class="label">
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

	<div class="space-y-2">
		{#each options as option, index (option.value)}
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="radio"
					id="{id}-{index}"
					{name}
					class="radio radio-sm"
					{disabled}
					checked={value === option.value}
					onchange={() => handleChange(option.value)}
				/>
				<span class="label-text">{option.label}</span>
			</label>
		{/each}
	</div>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
