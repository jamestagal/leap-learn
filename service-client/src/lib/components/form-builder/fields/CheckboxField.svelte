<script lang="ts">
	/**
	 * CheckboxField - Single checkbox for boolean values
	 */
	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: boolean | undefined;
		onchange: (value: boolean) => void;
	}

	let {
		id,
		name,
		label,
		description,
		required = false,
		disabled = false,
		error,
		value = false,
		onchange,
	}: Props = $props();

	function handleChange(e: Event): void {
		const target = e.target as HTMLInputElement;
		onchange(target.checked);
	}
</script>

<div class="form-control w-full">
	<label class="flex items-start gap-3 cursor-pointer p-3 border border-base-300 rounded-lg hover:bg-base-200/50 transition-colors">
		<input
			type="checkbox"
			{id}
			{name}
			class="checkbox mt-0.5"
			class:checkbox-error={!!error}
			{disabled}
			checked={value}
			{required}
			onchange={handleChange}
		/>
		<div class="flex-1">
			<span class="label-text font-medium">
				{label}
				{#if required}
					<span class="text-error ml-1">*</span>
				{/if}
			</span>
			{#if description}
				<p class="text-xs text-base-content/60 mt-0.5">{description}</p>
			{/if}
		</div>
	</label>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
