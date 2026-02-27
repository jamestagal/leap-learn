<script>
	let { 
		progress = 0,
		max = 100,
		variant = 'default',
		size = 'md',
		showLabel = true,
		children
	} = $props();

	// Calculate percentage
	let percentage = $derived(Math.min((progress / max) * 100, 100));

	// Variant styles
	const variants = {
		default: 'bg-primary-accent',
		success: 'bg-green-500',
		warning: 'bg-yellow-500',
		danger: 'bg-red-500'
	};

	// Size styles
	const sizes = {
		sm: 'h-2',
		md: 'h-3',
		lg: 'h-4'
	};
</script>

<div class="w-full">
	{#if showLabel}
		<div class="flex justify-between items-center mb-1">
			<span class="text-sm text-secondary-4">
				{@render children?.()}
			</span>
			<span class="text-sm font-medium">
				{Math.round(percentage)}%
			</span>
		</div>
	{/if}
	
	<div class="w-full bg-primary-2 rounded-full overflow-hidden {sizes[size]}">
		<div 
			class="transition-all duration-300 ease-in-out {variants[variant]} {sizes[size]} rounded-full"
			style="width: {percentage}%"
		></div>
	</div>
</div>