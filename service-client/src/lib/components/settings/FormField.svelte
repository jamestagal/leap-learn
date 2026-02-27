<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		hint?: string;
		error?: string;
		required?: boolean;
		children: Snippet;
	}

	let { label, hint, error, required = false, children }: Props = $props();
</script>

<div class="form-control w-full">
	<label class="label">
		<span class="label-text font-medium">
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</label>
	{@render children()}
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{:else if hint}
		<label class="label">
			<span class="label-text-alt text-base-content/60">{hint}</span>
		</label>
	{/if}
</div>
