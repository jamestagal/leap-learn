<script lang="ts">
	/**
	 * TextField - Basic text input field
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
		value?: string | undefined;
		minLength?: number | undefined;
		maxLength?: number | undefined;
		pattern?: string | undefined;
		onchange: (value: string) => void;
	}

	let {
		id,
		name,
		label,
		description,
		placeholder,
		required = false,
		disabled = false,
		error,
		value = "",
		minLength,
		maxLength,
		pattern,
		onchange,
	}: Props = $props();

	function handleInput(e: Event): void {
		const target = e.target as HTMLInputElement;
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

	<input
		{id}
		{name}
		type="text"
		class="input input-bordered w-full"
		class:input-error={!!error}
		{placeholder}
		{disabled}
		{value}
		minlength={minLength}
		maxlength={maxLength}
		{pattern}
		{required}
		oninput={handleInput}
	/>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
