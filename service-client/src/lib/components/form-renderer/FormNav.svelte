<script lang="ts">
	/**
	 * FormNav - Navigation buttons for multi-step forms
	 *
	 * Previous/Next/Submit buttons with optional save status indicator.
	 * Premium button styling with smooth transitions.
	 */
	import ChevronLeft from "lucide-svelte/icons/chevron-left";
	import ChevronRight from "lucide-svelte/icons/chevron-right";
	import Check from "lucide-svelte/icons/check";
	import Loader2 from "lucide-svelte/icons/loader-2";

	interface Props {
		currentStepIndex: number;
		totalSteps: number;
		submitting: boolean;
		submitButtonText?: string;
		onPrevious: () => void;
		onNext: () => void;
		disabled?: boolean;
		saving?: boolean;
		hasUnsavedChanges?: boolean;
		showSaveStatus?: boolean;
		showSaveButton?: boolean;
		onSave?: (() => Promise<void>) | undefined;
		readOnly?: boolean;
	}

	let {
		currentStepIndex,
		totalSteps,
		submitting,
		submitButtonText = "Submit",
		onPrevious,
		onNext,
		disabled = false,
		saving = false,
		hasUnsavedChanges = false,
		showSaveStatus = false,
		showSaveButton = false,
		onSave,
		readOnly = false,
	}: Props = $props();

	let isFirstStep = $derived(currentStepIndex === 0);
	let isLastStep = $derived(currentStepIndex === totalSteps - 1);
</script>

<div class="nav-container">
	<div class="nav-inner">
		<!-- Previous Button -->
		<div class="nav-left">
			{#if !isFirstStep}
				<button
					type="button"
					class="nav-btn nav-btn-secondary"
					onclick={onPrevious}
					disabled={disabled || saving || submitting}
				>
					<ChevronLeft class="btn-icon" />
					<span>Back</span>
				</button>
			{:else}
				<div></div>
			{/if}
		</div>

		<!-- Save Status (optional) -->
		{#if showSaveStatus}
			<div class="save-status hidden sm:flex">
				{#if saving}
					<Loader2 class="status-icon animate-spin" />
					<span class="status-text">Saving...</span>
				{:else if hasUnsavedChanges}
					<span class="status-text status-warning">Unsaved changes</span>
				{:else}
					<span class="status-text">All changes saved</span>
				{/if}
			</div>
		{/if}

		<!-- Save + Next/Submit Buttons -->
		<div class="nav-right">
			{#if showSaveButton && onSave && !readOnly}
				<button
					type="button"
					class="nav-btn nav-btn-secondary"
					onclick={onSave}
					disabled={disabled || saving || submitting}
				>
					<span>Save</span>
				</button>
			{/if}
			{#if isLastStep && !readOnly}
				<button
					type="submit"
					class="nav-btn nav-btn-primary"
					disabled={disabled || saving || submitting}
				>
					{#if submitting}
						<Loader2 class="btn-icon animate-spin" />
						<span>Submitting...</span>
					{:else}
						<Check class="btn-icon" />
						<span>{submitButtonText}</span>
					{/if}
				</button>
			{:else if !isLastStep}
				<button
					type="button"
					class="nav-btn nav-btn-primary"
					onclick={onNext}
					disabled={disabled || saving || submitting}
				>
					<span>{readOnly ? "Next" : "Continue"}</span>
					<ChevronRight class="btn-icon" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Mobile Save Status -->
	{#if showSaveStatus}
		<div class="save-status-mobile sm:hidden">
			{#if saving}
				<span class="status-text">Saving...</span>
			{:else if hasUnsavedChanges}
				<span class="status-text status-warning">Unsaved changes</span>
			{:else}
				<span class="status-text">All changes saved</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.nav-container {
		margin-top: 2.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid hsla(var(--bc), 0.08);
		/* Explicit colors to prevent dark mode interference */
		color: hsl(var(--bc));
	}

	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.nav-left,
	.nav-right {
		flex-shrink: 0;
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Button Base */
	.nav-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 500;
		border-radius: 0.625rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.nav-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Primary Button (Continue/Submit) */
	.nav-btn-primary {
		background: hsl(var(--p));
		color: hsl(var(--pc));
		box-shadow:
			0 1px 2px hsla(var(--p), 0.2),
			0 4px 8px hsla(var(--p), 0.15);
	}

	.nav-btn-primary:hover:not(:disabled) {
		background: hsl(var(--pf, var(--p)));
		transform: translateY(-1px);
		box-shadow:
			0 2px 4px hsla(var(--p), 0.2),
			0 8px 16px hsla(var(--p), 0.2);
	}

	.nav-btn-primary:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 1px 2px hsla(var(--p), 0.2);
	}

	/* Secondary Button (Back) */
	.nav-btn-secondary {
		background: hsla(var(--bc), 0.05);
		color: hsla(var(--bc), 0.7);
		border: 1px solid hsla(var(--bc), 0.1);
	}

	.nav-btn-secondary:hover:not(:disabled) {
		background: hsla(var(--bc), 0.08);
		color: hsla(var(--bc), 0.9);
		border-color: hsla(var(--bc), 0.15);
	}

	/* Icon - use :global since applied to Lucide components */
	:global(.btn-icon) {
		width: 1.125rem;
		height: 1.125rem;
		flex-shrink: 0;
	}

	/* Save Status */
	.save-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.status-icon) {
		width: 1rem;
		height: 1rem;
		color: hsla(var(--bc), 0.4);
	}

	.status-text {
		font-size: 0.8125rem;
		color: hsla(var(--bc), 0.5);
	}

	.status-warning {
		color: hsl(var(--wa));
	}

	.save-status-mobile {
		margin-top: 1rem;
		text-align: center;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.nav-btn {
			padding: 0.625rem 1rem;
			font-size: 0.875rem;
		}

		.nav-btn span {
			display: none;
		}

		.nav-btn-primary span {
			display: inline;
		}
	}
</style>
