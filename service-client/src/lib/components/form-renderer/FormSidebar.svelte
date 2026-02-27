<script lang="ts">
	/**
	 * FormSidebar - Sidebar navigation for wizard layout forms
	 *
	 * Displays step list with completion status, progress bar,
	 * and allows clicking to navigate between steps.
	 * Premium design with refined interactions.
	 */
	import type { FormStep } from "$lib/types/form-builder";
	import Check from "lucide-svelte/icons/check";

	interface Props {
		steps: FormStep[];
		currentStepIndex: number;
		stepCompletion: boolean[];
		completionPercentage: number;
		onStepClick: (stepIndex: number) => void;
		previewMode?: boolean;
	}

	let {
		steps,
		currentStepIndex,
		stepCompletion,
		completionPercentage,
		onStepClick,
		previewMode = false,
	}: Props = $props();

	// Only count steps as complete if the user has visited past them
	let completedCount = $derived(
		stepCompletion.filter((complete, index) => complete && index < currentStepIndex).length
	);
</script>

<div class="sidebar-container sticky top-4">
	<div class="sidebar-card">
		<!-- Progress Section -->
		<div class="progress-section">
			<div class="progress-header">
				<span class="progress-label">Your Progress</span>
				<span class="progress-value">{completionPercentage}%</span>
			</div>
			<div class="progress-bar-track">
				<div
					class="progress-bar-fill"
					style="width: {completionPercentage}%"
				></div>
			</div>
		</div>

		<!-- Divider -->
		<div class="sidebar-divider"></div>

		<!-- Step Navigation -->
		<nav class="steps-nav">
			{#each steps as step, index (step.id)}
				{@const isActive = currentStepIndex === index}
				{@const isVisited = index < currentStepIndex}
				{@const isComplete = isVisited && stepCompletion[index]}
				{@const canNavigate = previewMode || isVisited || isActive}

				<button
					type="button"
					class="step-item"
					class:active={isActive}
					class:complete={isComplete && !isActive}
					class:disabled={!canNavigate}
					onclick={() => canNavigate && onStepClick(index)}
					disabled={!canNavigate}
				>
					<!-- Step indicator -->
					<span class="step-indicator">
						{#if isComplete && !isActive}
							<Check class="h-3.5 w-3.5" strokeWidth={2.5} />
						{:else}
							<span class="step-number">{index + 1}</span>
						{/if}
					</span>

					<!-- Step title -->
					<span class="step-title">{step.title}</span>

					<!-- Active indicator dot -->
					{#if isActive}
						<span class="active-dot"></span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Completion Status -->
		<div class="sidebar-divider"></div>
		<div class="completion-status">
			<div class="completion-icon">
				<Check class="h-4 w-4" />
			</div>
			<span class="completion-text">
				{completedCount} of {steps.length} complete
			</span>
		</div>
	</div>
</div>

<style>
	.sidebar-container {
		width: 100%;
	}

	.sidebar-card {
		background: hsl(var(--b1));
		border-radius: 1rem;
		border: 1px solid hsla(var(--bc), 0.08);
		padding: 1.25rem;
		box-shadow:
			0 1px 3px hsla(var(--bc), 0.04),
			0 4px 12px hsla(var(--bc), 0.03);
		color: hsl(var(--bc));
	}

	/* Progress Section */
	.progress-section {
		margin-bottom: 1rem;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.625rem;
	}

	.progress-label {
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsla(var(--bc), 0.5);
	}

	.progress-value {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--p));
	}

	.progress-bar-track {
		height: 6px;
		background: hsla(var(--bc), 0.08);
		border-radius: 9999px;
		overflow: hidden;
	}

	.progress-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, hsl(var(--p)), hsla(var(--p), 0.8));
		border-radius: 9999px;
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Divider */
	.sidebar-divider {
		height: 1px;
		background: hsla(var(--bc), 0.08);
		margin: 1rem 0;
	}

	/* Steps Navigation */
	.steps-nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.step-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.625rem;
		text-align: left;
		width: 100%;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
	}

	.step-item:hover:not(.disabled) {
		background: hsla(var(--bc), 0.04);
	}

	.step-item.active {
		background: hsla(var(--p), 0.1);
	}

	.step-item.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Step Indicator */
	.step-indicator {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		transition: all 0.2s ease;
		background: hsla(var(--bc), 0.08);
		color: hsla(var(--bc), 0.5);
	}

	.step-item.active .step-indicator {
		background: hsl(var(--p));
		color: hsl(var(--pc, var(--b1)));
		box-shadow: 0 2px 8px hsla(var(--p), 0.3);
	}

	.step-item.complete .step-indicator {
		background: hsl(var(--su));
		color: hsl(var(--suc, var(--b1)));
	}

	.step-number {
		line-height: 1;
	}

	/* Step Title */
	.step-title {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		color: hsla(var(--bc), 0.7);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.2s ease;
	}

	.step-item.active .step-title {
		color: hsl(var(--p));
		font-weight: 600;
	}

	.step-item.complete .step-title {
		color: hsla(var(--bc), 0.8);
	}

	/* Active indicator dot */
	.active-dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: hsl(var(--p));
		flex-shrink: 0;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Completion Status */
	.completion-status {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.completion-icon {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 9999px;
		background: hsla(var(--su), 0.15);
		color: hsl(var(--su));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.completion-text {
		font-size: 0.8125rem;
		color: hsla(var(--bc), 0.5);
	}
</style>
