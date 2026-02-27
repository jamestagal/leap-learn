<script lang="ts">
	/**
	 * DynamicForm - Main Form Renderer Component
	 *
	 * Renders a form schema with multi-step support, validation,
	 * organisation branding, and submission handling.
	 *
	 * Supports two layout modes:
	 * - "wizard": Full-featured with sidebar navigation
	 * - Others: Simple centered form layout
	 */
	import type { FormSchema, FormField, FieldOption, UIConfig } from "$lib/types/form-builder";
	import type { ResolvedBranding } from "$lib/types/branding";
	import { validateFormData, getInitialFormData } from "$lib/components/form-builder/utils/schema-generator";
	import FormBranding from "./FormBranding.svelte";
	import FormStep from "./FormStep.svelte";
	import FieldRenderer from "./FieldRenderer.svelte";
	import FormSidebar from "./FormSidebar.svelte";
	import FormStepper from "./FormStepper.svelte";
	import FormNav from "./FormNav.svelte";
	import ArrowLeft from "lucide-svelte/icons/arrow-left";
	import ArrowRight from "lucide-svelte/icons/arrow-right";
	import Check from "lucide-svelte/icons/check";
	import Loader2 from "lucide-svelte/icons/loader-2";

	interface Props {
		schema: FormSchema;
		branding?: ResolvedBranding | undefined;
		options?: Record<string, FieldOption[]> | undefined; // Option sets keyed by slug
		optionSets?: { slug: string; options: unknown }[] | undefined; // Raw DB option sets
		onSubmit?: (data: Record<string, unknown>) => Promise<void>;
		onSuccess?: (() => void) | undefined;
		submitButtonText?: string | undefined;
		successMessage?: string | undefined;
		previewMode?: boolean | undefined; // Skip validation, allow free navigation
		onStepChange?: ((direction: "next" | "prev", stepIndex: number, data: Record<string, unknown>) => Promise<void>) | undefined;
		readOnly?: boolean | undefined;
		showSaveButton?: boolean | undefined;
		onSave?: ((data: Record<string, unknown>) => Promise<void>) | undefined;
		initialData?: Record<string, unknown> | undefined;
	}

	let {
		schema,
		branding,
		options = {},
		optionSets,
		onSubmit,
		onSuccess,
		submitButtonText,
		successMessage,
		previewMode = false,
		onStepChange,
		readOnly = false,
		showSaveButton = false,
		onSave,
		initialData,
	}: Props = $props();

	// Merge optionSets (raw DB format) into options record
	let resolvedOptions = $derived.by(() => {
		const base: Record<string, FieldOption[]> = { ...options };
		if (optionSets) {
			for (const set of optionSets) {
				if (set.slug && Array.isArray(set.options)) {
					base[set.slug] = set.options as FieldOption[];
				}
			}
		}
		return base;
	});

	// Form state - using $derived.by to properly capture schema reactively
	let formData = $state<Record<string, unknown>>({});
	let errors = $state<Record<string, string>>({});
	let submitting = $state(false);
	let submitted = $state(false);

	// Initialize form data when schema changes (merge initialData if provided)
	$effect(() => {
		const defaults = getInitialFormData(schema);
		formData = initialData ? { ...defaults, ...initialData } : defaults;
	});

	// Multi-step state
	let currentStepIndex = $state(0);
	let totalSteps = $derived(schema.steps.length);
	// currentStep is guaranteed to exist when schema has steps (which it always should)
	let currentStep = $derived.by(() => {
		const step = schema.steps[currentStepIndex];
		if (step) return step;
		// Fallback to first step if index is out of bounds
		return schema.steps[0] ?? { id: "default", title: "Form", fields: [] };
	});
	let isFirstStep = $derived(currentStepIndex === 0);
	let isLastStep = $derived(currentStepIndex === totalSteps - 1);

	// UI config
	let uiConfig = $derived<UIConfig>(
		schema.uiConfig || {
			layout: "single-column",
			showProgressBar: true,
			showStepNumbers: true,
			submitButtonText: "Submit",
			successMessage: "Thank you for your submission!",
		}
	);

	// Get options for a field (from optionSetSlug or field.options)
	function getFieldOptions(field: FormField): FieldOption[] {
		if (field.optionSetSlug) {
			const optionSet = resolvedOptions[field.optionSetSlug];
			if (optionSet) return optionSet;
		}
		return field.options || [];
	}

	// Validate current step fields
	function validateStep(): boolean {
		if (!currentStep) return false;

		const stepFieldNames = currentStep.fields
			.filter((f) => !["heading", "paragraph", "divider"].includes(f.type))
			.map((f) => f.name);

		const stepData: Record<string, unknown> = {};
		for (const name of stepFieldNames) {
			stepData[name] = formData[name];
		}

		const result = validateFormData(schema, stepData, stepFieldNames);

		if (result.success) {
			// Clear errors for this step
			for (const name of stepFieldNames) {
				delete errors[name];
			}
			return true;
		}

		// Set errors
		for (const name of stepFieldNames) {
			const fieldError = result.errors[name];
			if (fieldError) {
				errors[name] = fieldError;
			} else {
				delete errors[name];
			}
		}

		return false;
	}

	// Handle next/submit
	async function handleNext() {
		if (readOnly) {
			// In readOnly mode, just navigate without saving
			if (!isLastStep) currentStepIndex++;
			return;
		}
		// Skip validation in preview mode
		if (!previewMode && !validateStep()) return;

		if (isLastStep) {
			// Submit the form
			submitting = true;
			try {
				if (onStepChange) {
					await onStepChange("next", currentStepIndex, formData);
				}
				await onSubmit?.(formData);
				submitted = true;
				onSuccess?.();
			} catch (err) {
				console.error("Form submission failed:", err);
			} finally {
				submitting = false;
			}
		} else {
			// Call onStepChange before advancing
			if (onStepChange) {
				try {
					await onStepChange("next", currentStepIndex, formData);
				} catch (err) {
					console.error("Step change failed:", err);
					return; // Abort navigation if step change throws
				}
			}
			currentStepIndex++;
		}
	}

	// Handle back
	async function goBack() {
		if (!isFirstStep) {
			if (onStepChange) {
				try {
					await onStepChange("prev", currentStepIndex, formData);
				} catch (err) {
					console.error("Step change failed:", err);
					return;
				}
			}
			currentStepIndex--;
		}
	}

	// Handle field change
	function handleFieldChange(fieldName: string, value: unknown) {
		formData[fieldName] = value;
		// Clear error when field changes
		if (errors[fieldName]) {
			delete errors[fieldName];
		}
	}

	// Handle explicit save
	async function handleSave() {
		if (onSave) {
			await onSave(formData);
		}
	}

	// Progress percentage
	let progressPercent = $derived(((currentStepIndex + 1) / totalSteps) * 100);

	// Final submit button text
	let finalSubmitText = $derived(submitButtonText || uiConfig.submitButtonText || "Submit");

	// Final success message
	let finalSuccessMessage = $derived(
		successMessage || uiConfig.successMessage || "Thank you for your submission!"
	);

	// Check if using wizard layout
	let isWizardLayout = $derived(uiConfig.layout === "wizard");
	let isStepperLayout = $derived(uiConfig.layout === "stepper");

	// Merged form overrides - combine schema overrides + branding overrides + layout width
	let mergedFormOverrides = $derived.by(() => {
		const base = { ...branding?.formOverrides, ...schema.formOverrides };
		if ((isWizardLayout || readOnly) && !base.layout?.maxWidth) {
			return {
				...base,
				layout: {
					...base.layout,
					maxWidth: readOnly ? "900px" : "1024px",
				},
			};
		}
		if (isStepperLayout && !base.layout?.maxWidth) {
			return {
				...base,
				layout: {
					...base.layout,
					maxWidth: "800px",
				},
			};
		}
		return base;
	});

	// Step completion tracking - check if all required fields in step are filled
	// In preview mode, never mark steps as complete (no real data being entered)
	let stepCompletion = $derived.by(() => {
		if (previewMode) return schema.steps.map(() => false);
		return schema.steps.map((step) => {
			const requiredFields = step.fields.filter(
				(f) => f.required && !["heading", "paragraph", "divider"].includes(f.type)
			);
			if (requiredFields.length === 0) return true;
			return requiredFields.every((field) => {
				const value = formData[field.name];
				if (value === undefined || value === null || value === "") return false;
				if (Array.isArray(value) && value.length === 0) return false;
				return true;
			});
		});
	});

	// Overall completion percentage (only count visited steps as complete)
	let completionPercentage = $derived.by(() => {
		if (previewMode) return 0;
		const completed = stepCompletion.filter((complete, index) => complete && index < currentStepIndex).length;
		return Math.round((completed / schema.steps.length) * 100);
	});

	// Navigate to a specific step (for sidebar click)
	function goToStep(stepIndex: number) {
		// In preview mode or readOnly, allow free navigation to any step
		if (previewMode || readOnly) {
			currentStepIndex = stepIndex;
			return;
		}
		// Only allow navigating to previously visited steps or current step
		if (stepIndex <= currentStepIndex) {
			currentStepIndex = stepIndex;
		}
	}
</script>

<FormBranding {branding} formOverrides={mergedFormOverrides}>
	{#if submitted}
		<!-- Success State -->
		<div class="text-center py-12">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success mx-auto mb-4"
			>
				<Check class="h-8 w-8" />
			</div>
			<h2 class="text-xl font-semibold mb-2">Success!</h2>
			<p class="text-base-content/70">{finalSuccessMessage}</p>
		</div>
	{:else if isWizardLayout}
		<!-- Wizard Layout with Sidebar -->
		<div class="flex flex-col lg:flex-row gap-6">
			<!-- Sidebar (desktop only) -->
			<aside class="hidden lg:block lg:w-64 shrink-0">
				<FormSidebar
					steps={schema.steps}
					{currentStepIndex}
					{stepCompletion}
					{completionPercentage}
					onStepClick={goToStep}
					previewMode={previewMode || readOnly}
				/>
			</aside>

			<!-- Mobile Progress (mobile only) -->
			<div class="lg:hidden mb-4">
				<div class="flex justify-between text-sm text-base-content/70 mb-2">
					<span>Step {currentStepIndex + 1} of {totalSteps}</span>
					<span>{completionPercentage}% complete</span>
				</div>
				<progress
					class="progress progress-primary w-full"
					value={completionPercentage}
					max="100"
				></progress>
			</div>

			<!-- Main Form Content -->
			<div class="flex-1 min-w-0">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleNext();
					}}
				>
					<!-- Step Content -->
					<FormStep step={currentStep}>
						<div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
							{#each currentStep.fields as field (field.id)}
								<FieldRenderer
									{field}
									value={formData[field.name]}
									error={errors[field.name]}
									options={getFieldOptions(field)}
									onchange={(value) => handleFieldChange(field.name, value)}
									{readOnly}
								/>
							{/each}
						</div>
					</FormStep>

					<!-- Navigation -->
					<FormNav
						{currentStepIndex}
						{totalSteps}
						submitting={readOnly ? false : submitting}
						submitButtonText={finalSubmitText}
						onPrevious={goBack}
						onNext={handleNext}
						showSaveButton={readOnly ? false : showSaveButton}
						onSave={readOnly ? undefined : handleSave}
						{readOnly}
					/>
				</form>
			</div>
		</div>
	{:else if isStepperLayout}
		<!-- Stepper Layout (horizontal numbered circles) -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleNext();
			}}
		>
			<!-- Progress Header + Bar -->
			{#if totalSteps > 1 && uiConfig.showProgressBar}
				<div class="mb-6">
					<div class="flex justify-between text-sm text-base-content/70 mb-2">
						<span>Step {currentStepIndex + 1} of {totalSteps}</span>
						<span>{Math.round(progressPercent)}% Complete</span>
					</div>
					<div class="h-2 bg-base-200 rounded-full overflow-hidden">
						<div
							class="h-full bg-primary transition-all duration-300 ease-out"
							style="width: {progressPercent}%"
						></div>
					</div>
				</div>
			{/if}

			<!-- Stepper Navigation -->
			{#if totalSteps > 1}
				<FormStepper
					steps={schema.steps}
					{currentStepIndex}
					{stepCompletion}
					onStepClick={goToStep}
					previewMode={previewMode || readOnly}
				/>
			{/if}

			<!-- Step Content -->
			<FormStep step={currentStep}>
				<div class="grid gap-4 grid-cols-1">
					{#each currentStep.fields as field (field.id)}
						<FieldRenderer
							{field}
							value={formData[field.name]}
							error={errors[field.name]}
							options={getFieldOptions(field)}
							onchange={(value) => handleFieldChange(field.name, value)}
							{readOnly}
						/>
					{/each}
				</div>
			</FormStep>

			<!-- Navigation -->
			<FormNav
				{currentStepIndex}
				{totalSteps}
				submitting={readOnly ? false : submitting}
				submitButtonText={finalSubmitText}
				onPrevious={goBack}
				onNext={handleNext}
				showSaveButton={readOnly ? false : showSaveButton}
				onSave={readOnly ? undefined : handleSave}
				{readOnly}
			/>
		</form>
	{:else}
		<!-- Simple Layout (single-column, two-column, card) -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleNext();
			}}
		>
			<!-- Progress Bar -->
			{#if totalSteps > 1 && uiConfig.showProgressBar}
				<div class="mb-8">
					<div class="flex justify-between text-sm text-base-content/70 mb-2">
						{#if uiConfig.showStepNumbers}
							<span>Step {currentStepIndex + 1} of {totalSteps}</span>
						{/if}
						<span>{currentStep.title}</span>
					</div>
					<div class="h-2 bg-base-200 rounded-full overflow-hidden">
						<div
							class="h-full bg-primary transition-all duration-300 ease-out"
							style="width: {progressPercent}%"
						></div>
					</div>
				</div>
			{/if}

			<!-- Step Content -->
			<FormStep step={currentStep}>
				<div
					class="grid gap-4 grid-cols-1 {uiConfig.layout === 'two-column' || readOnly ? 'sm:grid-cols-2' : ''}"
				>
					{#each currentStep.fields as field (field.id)}
						<FieldRenderer
							{field}
							value={formData[field.name]}
							error={errors[field.name]}
							options={getFieldOptions(field)}
							onchange={(value) => handleFieldChange(field.name, value)}
							{readOnly}
						/>
					{/each}
				</div>
			</FormStep>

			<!-- Navigation Buttons -->
			{#if totalSteps > 1}
				<div class="flex justify-between mt-8 pt-6 border-t border-base-300">
					{#if !isFirstStep}
						<button type="button" class="btn btn-ghost" onclick={goBack}>
							<ArrowLeft class="w-4 h-4 mr-2" />
							Back
						</button>
					{:else}
						<div></div>
					{/if}

					<div class="flex gap-2">
						{#if showSaveButton && !readOnly}
							<button type="button" class="btn btn-outline" onclick={handleSave}>
								Save
							</button>
						{/if}
						{#if !readOnly}
							<button type="submit" class="btn btn-primary" disabled={submitting}>
								{#if submitting}
									<Loader2 class="w-4 h-4 mr-2 animate-spin" />
									{isLastStep ? "Submitting..." : "Validating..."}
								{:else if isLastStep}
									<Check class="w-4 h-4 mr-2" />
									{finalSubmitText}
								{:else}
									Continue
									<ArrowRight class="w-4 h-4 ml-2" />
								{/if}
							</button>
						{:else if !isLastStep}
							<button type="button" class="btn btn-primary" onclick={handleNext}>
								Next
								<ArrowRight class="w-4 h-4 ml-2" />
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</form>
	{/if}
</FormBranding>
