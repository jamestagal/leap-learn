<script lang="ts">
	import { ArrowLeft, Info, PanelLeft, AlignJustify, ListOrdered } from "lucide-svelte";
	import DynamicForm from "$lib/components/form-renderer/DynamicForm.svelte";
	import { buildFormSchema } from "$lib/components/form-builder/utils/schema-generator";
	import type { PageProps } from "./$types";
	import type { FormSchema } from "$lib/types/form-builder";
	import type { ResolvedBranding } from "$lib/types/branding";

	let { data }: PageProps = $props();

	// Layout toggle state - default to template's configured layout
	let layoutOverride = $state<"wizard" | "single-column" | "stepper" | null>(null);

	// Build schema by merging the separate uiConfig column
	let schema = $derived.by((): FormSchema | null => {
		if (!data.template.schema) return null;
		try {
			return buildFormSchema(data.template.schema, data.template.uiConfig);
		} catch {
			return null;
		}
	});

	// Build branding with organisation logo for preview
	// Colors are optional - DynamicForm will use defaults
	let branding = $derived.by((): ResolvedBranding | undefined => {
		if (!data.organisation.logoUrl) return undefined;

		return {
			colors: { primary: "220 90% 56%", base100: "0 0% 100%" },
			logo: {
				url: data.organisation.logoUrl,
				position: "center",
				height: 50,
			},
		};
	});

	// Get template's default layout
	let templateLayout = $derived(schema?.uiConfig?.layout || "single-column");

	// Effective layout (override or template default)
	let effectiveLayout = $derived(layoutOverride || templateLayout);

	// Check if this is a multi-step form (layout toggle only makes sense for multi-step)
	let isMultiStep = $derived((schema?.steps.length || 0) > 1);

	// Enhanced schema with layout override and header info
	let enhancedSchema = $derived.by((): FormSchema | null => {
		const baseSchema = schema;
		if (!baseSchema) return null;

		const isWizard = effectiveLayout === "wizard";

		// Build the enhanced schema with layout override
		const finalLayout = effectiveLayout || "single-column";

		// Build uiConfig with only defined properties (for exactOptionalPropertyTypes)
		const newUiConfig: FormSchema["uiConfig"] = {
			layout: finalLayout as "single-column" | "two-column" | "card" | "wizard" | "stepper",
		};
		if (baseSchema.uiConfig?.showProgressBar !== undefined)
			newUiConfig.showProgressBar = baseSchema.uiConfig.showProgressBar;
		if (baseSchema.uiConfig?.showStepNumbers !== undefined)
			newUiConfig.showStepNumbers = baseSchema.uiConfig.showStepNumbers;
		if (baseSchema.uiConfig?.submitButtonText !== undefined)
			newUiConfig.submitButtonText = baseSchema.uiConfig.submitButtonText;
		if (baseSchema.uiConfig?.successMessage !== undefined)
			newUiConfig.successMessage = baseSchema.uiConfig.successMessage;
		if (baseSchema.uiConfig?.successRedirectUrl !== undefined)
			newUiConfig.successRedirectUrl = baseSchema.uiConfig.successRedirectUrl;

		const enhanced: FormSchema = {
			...baseSchema,
			uiConfig: newUiConfig,
			// Set wider container for better two-column field layout
			formOverrides: {
				...baseSchema.formOverrides,
				layout: {
					...baseSchema.formOverrides?.layout,
					maxWidth: isWizard ? "1200px" : "800px",
				},
			},
		};

		// Add header info for wizard layout
		if (isWizard) {
			enhanced.formOverrides = {
				...enhanced.formOverrides,
				header: {
					title: data.template.name,
					subtitle: data.template.description || "Preview how your clients will see this form",
					showLogo: true,
					...baseSchema.formOverrides?.header,
				},
			};
		}

		return enhanced;
	});

	// Handle preview submit (does nothing in preview mode)
	async function handleSubmit(_data: Record<string, unknown>) {
		// Preview mode - no actual submission
		console.log("Preview submit (not saved)");
	}
</script>

<svelte:head>
	<title>Preview: {data.template.name} | {data.organisation.name}</title>
</svelte:head>

<!-- Preview Mode Banner -->
<div class="bg-info text-info-content px-4 py-3">
	<div class="container mx-auto flex items-center justify-between gap-4">
		<div class="flex items-center gap-2">
			<Info class="h-5 w-5 shrink-0" />
			<span class="font-medium">Preview Mode</span>
		</div>

		<div class="flex items-center gap-2">
			<!-- Layout Toggle (only for multi-step forms) -->
			{#if isMultiStep}
				<div class="join hidden sm:flex">
					<button
						type="button"
						class="join-item btn btn-sm"
						class:btn-active={effectiveLayout === "wizard"}
						onclick={() => (layoutOverride = "wizard")}
						title="Sidebar navigation"
					>
						<PanelLeft class="h-4 w-4" />
						<span class="hidden md:inline">Sidebar</span>
					</button>
					<button
						type="button"
						class="join-item btn btn-sm"
						class:btn-active={effectiveLayout === "stepper"}
						onclick={() => (layoutOverride = "stepper")}
						title="Stepper navigation"
					>
						<ListOrdered class="h-4 w-4" />
						<span class="hidden md:inline">Stepper</span>
					</button>
					<button
						type="button"
						class="join-item btn btn-sm"
						class:btn-active={effectiveLayout === "single-column"}
						onclick={() => (layoutOverride = "single-column")}
						title="Compact navigation"
					>
						<AlignJustify class="h-4 w-4" />
						<span class="hidden md:inline">Compact</span>
					</button>
				</div>
			{/if}

			<a href="/{data.organisation.slug}/settings/forms" class="btn btn-sm btn-ghost gap-1">
				<ArrowLeft class="h-4 w-4" />
				<span class="hidden sm:inline">Exit Preview</span>
			</a>
		</div>
	</div>
</div>

<!-- Form Preview -->
{#if enhancedSchema}
	<DynamicForm
		schema={enhancedSchema}
		branding={branding}
		onSubmit={handleSubmit}
		previewMode={true}
	/>
{:else}
	<div class="flex items-center justify-center min-h-[400px]">
		<div class="text-center">
			<p class="text-base-content/60">Unable to load form schema</p>
			<a href="/{data.organisation.slug}/settings/forms" class="btn btn-ghost btn-sm mt-4">
				<ArrowLeft class="h-4 w-4" />
				Back to Form Templates
			</a>
		</div>
	</div>
{/if}
