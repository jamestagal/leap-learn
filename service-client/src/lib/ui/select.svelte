<script lang="ts">
	import type { Snippet } from "svelte";
	import { slide } from "svelte/transition";

	type Props = {
		// required props
		name: string;
		label: string;
		value: string | number;
		children: Snippet;
		// optional props
		error?: string;
		helper?: string;
		required?: boolean;
		class?: string;
	};

	let {
		name,
		label,
		value = $bindable(),
		children,
		error,
		helper,
		required,
		...rest
	}: Props = $props();
</script>

<div>
	<label for={name} class="mb-2 block text-sm font-medium">
		{label}
	</label>
	<select
		bind:value
		id={name}
		{name}
		{required}
		class="block w-full rounded border-0 bg-gray-800 px-3 py-2 text-sm shadow-md focus:ring-2 focus:ring-gray-600
        {error ? 'outline outline-1 outline-red-600' : ''}
        {rest.class}"
		aria-invalid={!!error}
		aria-describedby="{name}-description"
	>
		{@render children()}
	</select>
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
