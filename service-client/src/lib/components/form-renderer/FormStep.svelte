<script lang="ts">
	/**
	 * FormStep - Wrapper for a single form step
	 *
	 * Displays step title, description, and contains the step's fields.
	 * Premium typography and spacing.
	 */
	import type { Snippet } from "svelte";
	import type { FormStep as FormStepType } from "$lib/types/form-builder";

	interface Props {
		step: FormStepType;
		children: Snippet;
	}

	let { step, children }: Props = $props();
</script>

<div class="form-step">
	{#if step.title || step.description}
		<header class="step-header">
			{#if step.title}
				<h2 class="step-title">{step.title}</h2>
			{/if}

			{#if step.description}
				<p class="step-description">{step.description}</p>
			{/if}
		</header>
	{/if}

	<div class="step-content">
		{@render children()}
	</div>
</div>

<style>
	.form-step {
		width: 100%;
	}

	.step-header {
		margin-bottom: 1.75rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid hsla(var(--bc), 0.08);
	}

	.step-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: hsl(var(--bc));
		letter-spacing: -0.01em;
		line-height: 1.3;
		margin: 0;
	}

	.step-description {
		margin-top: 0.5rem;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: hsla(var(--bc), 0.6);
		margin-bottom: 0;
	}

</style>
