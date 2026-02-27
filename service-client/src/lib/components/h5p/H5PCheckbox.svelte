<script>
	/**
	 * H5P Checkbox Component
	 * Enhanced checkbox with indeterminate state support for multi-select operations
	 */

	let {
		checked = $bindable(false),
		indeterminate = false,
		disabled = false,
		label = '',
		name = '',
		value = '',
		size = 'md', // 'sm', 'md', 'lg'
		variant = 'default', // 'default', 'primary'
		onchange = () => {},
		class: className = '',
		children,
		...restProps
	} = $props();

	let inputRef = $state();

	// Set indeterminate state on the DOM element
	$effect(() => {
		if (inputRef) {
			inputRef.indeterminate = indeterminate;
		}
	});

	// Size classes
	const sizeClasses = {
		sm: 'h-3 w-3',
		md: 'h-4 w-4',
		lg: 'h-5 w-5'
	};

	// Variant classes  
	const variantClasses = {
		default: 'border-primary-3 text-primary-accent focus:ring-primary-accent',
		primary: 'border-primary-accent text-primary-accent focus:ring-primary-accent'
	};

	// Label size classes
	const labelSizeClasses = {
		sm: 'text-xs',
		md: 'text-sm', 
		lg: 'text-base'
	};

	function handleChange(event) {
		checked = event.target.checked;
		onchange(event);
	}

	// ARIA attributes
	let ariaChecked = $derived(
		indeterminate ? 'mixed' : checked.toString()
	);
</script>

<label 
	class="inline-flex items-center gap-2 cursor-pointer select-none {className}" 
	class:opacity-50={disabled}
	class:cursor-not-allowed={disabled}
>
	<input
		bind:this={inputRef}
		type="checkbox"
		{checked}
		{disabled}
		{name}
		{value}
		onchange={handleChange}
		aria-checked={ariaChecked}
		class="
			{sizeClasses[size]} 
			{variantClasses[variant]}
			rounded border-2 
			focus:ring-2 focus:ring-offset-2 focus:outline-none
			disabled:cursor-not-allowed disabled:opacity-50
			transition-colors duration-150
		"
		{...restProps}
	/>
	
	{#if label}
		<span class="
			{labelSizeClasses[size]} 
			text-secondary 
			{disabled ? 'text-secondary-4' : ''}
		">
			{label}
		</span>
	{/if}
	
	<!-- Custom content -->
	{@render children?.()}
</label>

<style>
	/* Custom indeterminate styling */
	input[type="checkbox"]:indeterminate {
		background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M4 8h8'/%3e%3c/svg%3e");
	}
	
	/* Better focus ring */
	input[type="checkbox"]:focus-visible {
		outline: 2px solid transparent;
		outline-offset: 2px;
	}
</style>