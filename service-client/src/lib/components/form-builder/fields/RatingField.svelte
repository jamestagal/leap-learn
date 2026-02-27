<script lang="ts">
	/**
	 * RatingField - Star rating input (Custom for WebKit)
	 */
	import Star from "lucide-svelte/icons/star";

	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: number | undefined;
		max?: number | undefined;
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
		value = 0,
		max = 5,
		onchange,
	}: Props = $props();

	let hoverValue = $state(0);

	function handleClick(rating: number): void {
		if (!disabled) {
			onchange(rating);
		}
	}

	function handleMouseEnter(rating: number): void {
		if (!disabled) {
			hoverValue = rating;
		}
	}

	function handleMouseLeave(): void {
		hoverValue = 0;
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

	<div
		class="flex gap-1"
		role="radiogroup"
		aria-label={label}
		onmouseleave={handleMouseLeave}
	>
		{#each Array.from({ length: max }, (_, k) => k) as i (i)}
			{@const rating = i + 1}
			{@const displayValue = hoverValue || value || 0}
			{@const isFilled = rating <= displayValue}
			<button
				type="button"
				{id}
				class="btn btn-ghost btn-sm btn-square p-0 transition-colors"
				class:cursor-not-allowed={disabled}
				{disabled}
				onclick={() => handleClick(rating)}
				onmouseenter={() => handleMouseEnter(rating)}
				aria-label="Rate {rating} out of {max}"
			>
				<Star
					class="h-6 w-6 transition-colors {isFilled
						? 'fill-warning text-warning'
						: 'text-base-300 hover:text-warning/50'}"
				/>
			</button>
		{/each}
		<input type="hidden" {name} value={value || ""} />
	</div>

	{#if value}
		<p class="text-xs text-base-content/60 mt-1">{value} of {max} stars</p>
	{/if}

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
