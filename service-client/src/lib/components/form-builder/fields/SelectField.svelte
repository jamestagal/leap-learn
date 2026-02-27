<script lang="ts">
	/**
	 * SelectField - Single-select dropdown
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
		placeholder?: string | undefined;
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
		placeholder = "Select an option...",
		required = false,
		disabled = false,
		error,
		value = "",
		options = [],
		onchange,
	}: Props = $props();

	function handleChange(e: Event): void {
		const target = e.target as HTMLSelectElement;
		onchange(target.value);
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

	<select
		{id}
		{name}
		class="select select-bordered w-full"
		class:select-error={!!error}
		{disabled}
		{required}
		onchange={handleChange}
	>
		<option value="" disabled selected={!value}>
			{placeholder}
		</option>
		{#each options as option (option.value)}
			<option value={option.value} selected={value === option.value}>
				{option.label}
			</option>
		{/each}
	</select>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
