<script lang="ts">
	import { slide } from "svelte/transition";

	type Props = {
		// required props
		name: string;
		label: string;
		value: string | number;
		type:
			| "text"
			| "email"
			| "password"
			| "number"
			| "date"
			| "time"
			| "datetime-local"
			| "search"
			| "tel"
			| "url";
		// optional props
		error?: string;
		required?: boolean;
		helper?: string;
		rows?: number;
		placeholder?: string;
		min?: number;
		max?: number;
		minlength?: number;
		maxlength?: number;
		pattern?: string;
		autocomplete?: HTMLInputElement["autocomplete"];
		class?: string;
	};

	let {
		name,
		label,
		value = $bindable(),
		type,
		placeholder,
		rows,
		error,
		helper,
		required,
		min,
		max,
		minlength,
		maxlength,
		pattern,
		autocomplete,
		...rest
	}: Props = $props();

	function typeAction(node: HTMLInputElement): void {
		node.type = type;
	}
</script>

<div class="w-full">
	<label for={name} class="mb-2 block text-sm font-medium">
		{label}
	</label>
	{#if !rows}
		<input
			use:typeAction
			bind:value
			id={name}
			{name}
			{placeholder}
			{autocomplete}
			class="block w-full rounded border-0 bg-gray-800 px-3 py-2 text-sm shadow-md placeholder:text-gray-400 focus:ring-2 focus:ring-gray-600 focus:ring-inset
            {error ? 'outline outline-1 outline-red-600' : ''}
            {rest['class']}"
			{required}
			{min}
			{max}
			{minlength}
			{maxlength}
			{pattern}
			aria-invalid={!!error}
			aria-describedby="{name}-description"
		/>
	{:else}
		<textarea
			bind:value
			id={name}
			{name}
			{placeholder}
			{rows}
			class="block w-full rounded border-0 bg-gray-800 px-3 py-2 text-sm shadow-md placeholder:text-gray-400 focus:ring-2 focus:ring-gray-600 focus:ring-inset
                {error ? 'outline outline-1 outline-red-600' : ''}"
			{required}
			{minlength}
			{maxlength}
			aria-invalid={!!error}
			aria-describedby="{name}-description"
		></textarea>
	{/if}
	{#if helper}
		<p id="{name}-description" class="mt-2 block text-sm text-gray-400">
			{helper}
		</p>
	{/if}
	{#if error}
		<p transition:slide class="mt-2 block text-sm text-red-600">
			{error}
		</p>
	{/if}
</div>
