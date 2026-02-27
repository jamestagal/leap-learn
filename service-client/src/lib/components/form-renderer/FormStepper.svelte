<script lang="ts">
	/**
	 * FormStepper - Horizontal numbered step indicator for stepper layout forms
	 *
	 * Displays numbered circles with connecting lines above the form.
	 * Active step is filled primary, completed steps are clickable outlines,
	 * upcoming steps are gray and disabled.
	 */
	import type { FormStep } from "$lib/types/form-builder";
	import Check from "lucide-svelte/icons/check";

	interface Props {
		steps: FormStep[];
		currentStepIndex: number;
		stepCompletion: boolean[];
		onStepClick: (stepIndex: number) => void;
		previewMode?: boolean;
	}

	let {
		steps,
		currentStepIndex,
		stepCompletion,
		onStepClick,
		previewMode = false,
	}: Props = $props();
</script>

<div class="stepper-container">
	<!-- Step Circles + Lines -->
	<div class="stepper-track">
		{#each steps as step, index (step.id)}
			{@const isActive = currentStepIndex === index}
			{@const isVisited = index < currentStepIndex}
			{@const isComplete = isVisited && stepCompletion[index]}
			{@const canNavigate = previewMode || isVisited}

			<!-- Connecting line before (except first) -->
			{#if index > 0}
				<div class="stepper-line" class:completed={isVisited}></div>
			{/if}

			<!-- Step circle -->
			<button
				type="button"
				class="stepper-circle"
				class:active={isActive}
				class:complete={isComplete && !isActive}
				class:visited={isVisited && !isComplete && !isActive}
				class:upcoming={!isActive && !isVisited}
				disabled={!canNavigate && !isActive}
				onclick={() => canNavigate && onStepClick(index)}
				title={step.title}
			>
				{#if isComplete && !isActive}
					<Check class="h-4 w-4" strokeWidth={2.5} />
				{:else}
					<span class="circle-number">{index + 1}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Current Step Title -->
	<div class="stepper-title">
		{steps[currentStepIndex]?.title || ""}
	</div>
</div>

<style>
	.stepper-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 2rem;
		padding: 1.5rem 0 0.5rem;
	}

	.stepper-track {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
	}

	/* Connecting line */
	.stepper-line {
		width: 48px;
		height: 2px;
		background: hsla(var(--bc), 0.15);
		transition: background 0.3s ease;
	}

	.stepper-line.completed {
		background: hsl(var(--p));
	}

	/* Step circle */
	.stepper-circle {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		border: 2px solid transparent;
		cursor: default;
		transition: all 0.2s ease;
		background: transparent;
	}

	/* Active: filled primary circle */
	.stepper-circle.active {
		background: hsl(var(--p));
		color: hsl(var(--pc, var(--b1)));
		border-color: hsl(var(--p));
		box-shadow: 0 2px 8px hsla(var(--p), 0.3);
	}

	/* Complete: primary outline, clickable */
	.stepper-circle.complete {
		background: transparent;
		color: hsl(var(--p));
		border-color: hsl(var(--p));
		cursor: pointer;
	}

	.stepper-circle.complete:hover {
		background: hsla(var(--p), 0.1);
		transform: scale(1.05);
	}

	/* Visited but not complete */
	.stepper-circle.visited {
		background: transparent;
		color: hsla(var(--bc), 0.6);
		border-color: hsla(var(--bc), 0.3);
		cursor: pointer;
	}

	.stepper-circle.visited:hover {
		border-color: hsla(var(--bc), 0.5);
		background: hsla(var(--bc), 0.05);
	}

	/* Upcoming: gray, disabled */
	.stepper-circle.upcoming {
		background: transparent;
		color: hsla(var(--bc), 0.35);
		border-color: hsla(var(--bc), 0.15);
		opacity: 0.6;
		cursor: not-allowed;
	}

	.circle-number {
		line-height: 1;
	}

	/* Step title below */
	.stepper-title {
		margin-top: 0.75rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: hsla(var(--bc), 0.8);
		text-align: center;
	}

	/* Responsive: shrink line width on small screens */
	@media (max-width: 480px) {
		.stepper-line {
			width: 24px;
		}

		.stepper-circle {
			width: 32px;
			height: 32px;
			font-size: 0.75rem;
		}
	}
</style>
