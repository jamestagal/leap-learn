<script lang="ts">
	/**
	 * Public Form Page
	 *
	 * Client-facing form page that renders a DynamicForm with full organisation branding.
	 * Supports auto-save progress and handles form submission.
	 */
	import DynamicForm from "$lib/components/form-renderer/DynamicForm.svelte";
	import { saveSubmissionProgress, completeSubmission } from "$lib/api/forms.remote";
	import type { FormSchema, UIConfig } from "$lib/types/form-builder";
	import type { ResolvedBranding } from "$lib/types/branding";
	import { defaultOrganisationBranding } from "$lib/types/branding";
	import { hexToHsl } from "$lib/components/form-renderer/utils/theme-generator";
	import { Check, AlertCircle } from "lucide-svelte";
	import SvelteSeo from "svelte-seo";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// Extract reactive values from data
	let submissionId = $derived(data.submission.id);
	let submissionStatus = $derived(data.submission.status);
	let submissionData = $derived(data.submission.data);
	let submissionCurrentStep = $derived(data.submission.currentStep);
	let form = $derived(data.form);
	let organisation = $derived(data.organisation);

	// Build organisation branding from database values
	let branding = $derived.by((): ResolvedBranding => {
		const colors = {
			...defaultOrganisationBranding.colors,
			// Convert hex colors to HSL if present
			primary: organisation.primaryColor ? hexToHsl(organisation.primaryColor) : defaultOrganisationBranding.colors.primary,
			secondary: organisation.secondaryColor ? hexToHsl(organisation.secondaryColor) : defaultOrganisationBranding.colors.secondary || "280 70% 50%",
			accent: organisation.accentColor ? hexToHsl(organisation.accentColor) : defaultOrganisationBranding.colors.accent || "45 100% 50%",
		};

		const result: ResolvedBranding = {
			...defaultOrganisationBranding,
			colors,
		};

		// Only add logo if URL exists
		if (organisation.logoUrl) {
			result.logo = { url: organisation.logoUrl, position: "center", height: 48 };
		}

		return result;
	});

	// Parse the form schema and inject header with form title/description
	let formSchema = $derived.by((): FormSchema | null => {
		if (!form?.schema) return null;
		try {
			const parsed = typeof form.schema === "string" ? JSON.parse(form.schema) : form.schema;
			// Validate it has required properties
			if (parsed && parsed.version && Array.isArray(parsed.steps)) {
				const schema = parsed as FormSchema;

				// Build header with form title and description
				const header: { title?: string; subtitle?: string; showLogo?: boolean } = {
					...schema.formOverrides?.header,
				};
				const formTitle = form.name || schema.formOverrides?.header?.title;
				const formSubtitle = form.description || schema.formOverrides?.header?.subtitle;
				if (formTitle) header.title = formTitle;
				if (formSubtitle) header.subtitle = formSubtitle;

				// Inject form title and description into formOverrides
				return {
					...schema,
					formOverrides: {
						...schema.formOverrides,
						header,
					},
				};
			}
			return null;
		} catch {
			return null;
		}
	});

	// Form state
	let formData = $state<Record<string, unknown>>({});
	let currentStep = $state(0);
	let saveStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let isCompleted = $state(false);
	let isSubmitted = $state(false);

	// Initialize state from props once
	$effect(() => {
		isCompleted = submissionStatus === "completed";
		if (submissionData && typeof submissionData === "object") {
			formData = submissionData as Record<string, unknown>;
		}
		currentStep = submissionCurrentStep || 0;
	});

	// Auto-save function
	async function autoSave(saveData: Record<string, unknown>, step: number) {
		if (isCompleted) return;

		saveStatus = "saving";

		try {
			// Calculate completion percentage
			const schema = formSchema;
			let totalRequired = 0;
			let filledRequired = 0;

			if (schema?.steps) {
				for (const s of schema.steps) {
					for (const field of s.fields) {
						if (
							field.required &&
							!["heading", "paragraph", "divider"].includes(field.type)
						) {
							totalRequired++;
							const value = saveData[field.name];
							if (value !== undefined && value !== null && value !== "") {
								if (!Array.isArray(value) || value.length > 0) {
									filledRequired++;
								}
							}
						}
					}
				}
			}

			const completionPercentage =
				totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;

			await saveSubmissionProgress({
				submissionId,
				data: saveData,
				currentStep: step,
				completionPercentage,
			});

			saveStatus = "saved";

			// Reset to idle after 2 seconds
			setTimeout(() => {
				if (saveStatus === "saved") {
					saveStatus = "idle";
				}
			}, 2000);
		} catch (err) {
			console.error("Auto-save failed:", err);
			saveStatus = "error";
		}
	}

	// Debounced auto-save when form data changes
	function scheduleAutoSave() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		saveTimeout = setTimeout(() => {
			autoSave(formData, currentStep);
		}, 2000); // Save 2 seconds after last change
	}

	// Watch for form data changes and trigger auto-save
	$effect(() => {
		// Create dependency on formData by serializing it
		JSON.stringify(formData);
		if (Object.keys(formData).length > 0 && !isCompleted) {
			scheduleAutoSave();
		}
	});

	// Handle final submission
	async function handleSubmit(submitData: Record<string, unknown>) {
		await completeSubmission({
			submissionId,
			data: submitData,
		});
		isSubmitted = true;
	}

	// Get UI config from form
	let uiConfig = $derived.by((): UIConfig => {
		if (!form?.uiConfig) {
			return {
				layout: "single-column",
				showProgressBar: true,
				showStepNumbers: true,
				submitButtonText: "Submit",
				successMessage: "Thank you for your submission!",
			};
		}
		return typeof form.uiConfig === "string" ? JSON.parse(form.uiConfig) : form.uiConfig;
	});
</script>

<SvelteSeo
	title="{form?.name || 'Form'} — {organisation.name}"
	description="Complete this form from {organisation.name}"
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: form?.name || "Form",
		description: form?.description || `Form from ${organisation.name}`,
	}}
/>

<svelte:head>
	<title>{form?.name || "Form"} - {organisation.name}</title>
</svelte:head>

{#if isCompleted && !isSubmitted}
	<!-- Already Completed State -->
	<div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
		<div class="card bg-base-100 shadow-lg max-w-md w-full">
			<div class="card-body items-center text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success mb-4"
				>
					<Check class="h-8 w-8" />
				</div>
				<h1 class="text-xl font-bold">Form Already Submitted</h1>
				<p class="text-base-content/70">
					This form has already been completed. Thank you for your submission!
				</p>
				{#if organisation.logoUrl}
					<div class="mt-6 opacity-60">
						<img src={organisation.logoUrl} alt={organisation.name} class="h-8 object-contain" />
					</div>
				{/if}
			</div>
		</div>
	</div>
{:else if formSchema}
	<!-- Form Render with Organisation Branding -->
	<!-- Auto-save Status Indicator -->
	{#if saveStatus !== "idle"}
		<div class="fixed top-4 right-4 z-50">
			<div
				class="badge gap-2 {saveStatus === 'saving'
					? 'badge-warning'
					: saveStatus === 'saved'
						? 'badge-success'
						: 'badge-error'}"
			>
				{#if saveStatus === "saving"}
					<span class="loading loading-spinner loading-xs"></span>
					Saving...
				{:else if saveStatus === "saved"}
					<Check class="h-3 w-3" />
					Saved
				{:else if saveStatus === "error"}
					<AlertCircle class="h-3 w-3" />
					Save failed
				{/if}
			</div>
		</div>
	{/if}

	<DynamicForm
		schema={formSchema}
		{branding}
		onSubmit={handleSubmit}
		submitButtonText={uiConfig.submitButtonText}
		successMessage={uiConfig.successMessage}
	/>
{:else}
	<!-- Error State -->
	<div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
		<div class="card bg-base-100 shadow-lg max-w-md w-full">
			<div class="card-body items-center text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error mb-4"
				>
					<AlertCircle class="h-8 w-8" />
				</div>
				<h1 class="text-xl font-bold">Form Not Found</h1>
				<p class="text-base-content/70">
					This form could not be loaded. It may have been deleted or the link may be incorrect.
				</p>
			</div>
		</div>
	</div>
{/if}
