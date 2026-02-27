<script lang="ts">
	/**
	 * Form Builder - Main 3-Panel Builder UI
	 *
	 * Layout:
	 * - Left Panel: Field Library (drag source)
	 * - Center Panel: Form Canvas (drag target)
	 * - Right Panel: Field Properties / Preview
	 */

	import { PaneGroup, Pane, PaneResizer } from "paneforge";
	import { formBuilder } from "./state/form-builder.svelte";
	import FieldLibrary from "./FieldLibrary.svelte";
	import FormCanvas from "./FormCanvas.svelte";
	import FieldProperties from "./FieldProperties.svelte";
	import PaneHandle from "./PaneHandle.svelte";
	import DynamicForm from "$lib/components/form-renderer/DynamicForm.svelte";
	import type { FormSchema } from "$lib/types/form-builder";
	import type { OrganisationBranding, ResolvedBranding } from "$lib/types/branding";
	import { formTemplates } from "./templates";

	// Icons
	import Eye from "lucide-svelte/icons/eye";
	import EyeOff from "lucide-svelte/icons/eye-off";
	import Save from "lucide-svelte/icons/save";
	import RotateCcw from "lucide-svelte/icons/rotate-ccw";
	import Download from "lucide-svelte/icons/download";
	import Upload from "lucide-svelte/icons/upload";
	import FileText from "lucide-svelte/icons/file-text";
	import Info from "lucide-svelte/icons/info";
	import Settings from "lucide-svelte/icons/settings";

	interface Props {
		initialSchema?: FormSchema;
		organisationBranding?: OrganisationBranding;
		organisationLogoUrl?: string | null; // Logo URL is stored separately on organisation
		onSave?: (schema: FormSchema) => void;
		onOpenSettings?: () => void;
	}

	let { initialSchema, organisationBranding, organisationLogoUrl, onSave, onOpenSettings }: Props = $props();

	// Convert OrganisationBranding to ResolvedBranding for the preview, including logo
	let resolvedBranding = $derived.by<ResolvedBranding | undefined>(() => {
		if (!organisationBranding && !organisationLogoUrl) return undefined;

		// Start with organisation branding or defaults
		const base: OrganisationBranding = organisationBranding || {
			colors: { primary: "220 90% 56%", base100: "0 0% 100%" },
		};

		// Merge logo from separate prop if available
		const result: ResolvedBranding = {
			...base,
		};

		if (organisationLogoUrl) {
			result.logo = { url: organisationLogoUrl, position: "center", height: 50, ...(base.logo || {}) };
		}

		return result;
	});

	// Get live schema for preview (updates as fields change)
	let previewSchema = $derived(formBuilder.exportSchema());

	// Build enhanced preview schema with header/footer defaults for wizard layout
	let enhancedPreviewSchema = $derived.by(() => {
		const schemaOverrides = previewSchema.formOverrides || {};
		const isWizard = previewSchema.uiConfig?.layout === "wizard";

		// For wizard layout, ensure we have header title/subtitle
		if (isWizard && !schemaOverrides.header?.title) {
			return {
				...previewSchema,
				formOverrides: {
					...schemaOverrides,
					header: {
						title: "Form Preview",
						subtitle: "This is how your clients will see the form",
						showLogo: true,
						...schemaOverrides.header,
					},
					footer: {
						showPoweredBy: true,
						...schemaOverrides.footer,
					},
				},
			};
		}

		return previewSchema;
	});

	// Preview mode toggle
	let showPreview = $state(false);

	// Confirmation modal state
	let confirmModal = $state<HTMLDialogElement | null>(null);
	let confirmAction = $state<(() => void) | null>(null);
	let confirmTitle = $state("");
	let confirmMessage = $state("");
	let isErrorModal = $state(false);

	function showConfirm(title: string, message: string, action: () => void) {
		confirmTitle = title;
		confirmMessage = message;
		confirmAction = action;
		isErrorModal = false;
		confirmModal?.showModal();
	}

	function showError(title: string, message: string) {
		confirmTitle = title;
		confirmMessage = message;
		confirmAction = null;
		isErrorModal = true;
		confirmModal?.showModal();
	}

	function handleConfirm() {
		confirmAction?.();
		confirmModal?.close();
	}

	function handleCancelConfirm() {
		confirmModal?.close();
	}

	// Load initial schema if provided
	$effect(() => {
		if (initialSchema) {
			formBuilder.loadSchema(initialSchema);
		}
	});

	function handleSave() {
		const schema = formBuilder.exportSchema();
		onSave?.(schema);
	}

	function handleReset() {
		showConfirm(
			"Reset Form",
			"Are you sure you want to reset the form? All changes will be lost.",
			() => formBuilder.reset()
		);
	}

	function handleExport() {
		const schema = formBuilder.exportSchema();
		const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "form-schema.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImport() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const schema = JSON.parse(text) as FormSchema;
				formBuilder.loadSchema(schema);
			} catch {
				showError("Import Failed", "The selected file is not a valid JSON form schema.");
			}
		};
		input.click();
	}

	function handleLoadTemplate(templateId: string) {
		const template = formTemplates.find((t) => t.id === templateId);
		if (!template) return;

		if (formBuilder.totalFieldCount > 0) {
			showConfirm(
				"Load Template",
				`Loading "${template.name}" will replace your current form. Continue?`,
				() => formBuilder.loadSchema(template.schema)
			);
		} else {
			formBuilder.loadSchema(template.schema);
		}
	}
</script>

<div class="flex flex-col h-full bg-base-200">
	<!-- Toolbar -->
	<div class="flex items-center justify-between gap-4 p-3 border-b border-base-300 bg-base-100">
		<div class="flex items-center gap-2">
			<h2 class="text-lg font-semibold">Form Builder</h2>
			<span class="badge badge-neutral badge-sm">
				{formBuilder.totalFieldCount} field{formBuilder.totalFieldCount !== 1 ? "s" : ""}
			</span>
		</div>

		<div class="flex items-center gap-2">
			<button
				class="btn btn-ghost btn-sm"
				onclick={handleImport}
				title="Import JSON"
			>
				<Upload class="h-4 w-4" />
				Import
			</button>
			<button
				class="btn btn-ghost btn-sm"
				onclick={handleExport}
				title="Export JSON"
			>
				<Download class="h-4 w-4" />
				Export
			</button>
			<div class="dropdown dropdown-end">
				<button class="btn btn-ghost btn-sm" tabindex="0" title="Load Template">
					<FileText class="h-4 w-4" />
					Templates
				</button>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<ul
					tabindex="0"
					class="dropdown-content menu bg-base-100 rounded-box z-[1] w-72 p-2 shadow-lg border border-base-300"
				>
					{#each formTemplates as template (template.id)}
						<li>
							<button onclick={() => handleLoadTemplate(template.id)} class="flex flex-col items-start gap-1">
								<span class="font-medium">{template.name}</span>
								<span class="text-xs text-base-content/60 line-clamp-2">{template.description}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
			<div class="divider divider-horizontal mx-0"></div>
			<button
				class="btn btn-sm"
				class:btn-ghost={!showPreview}
				class:btn-secondary={showPreview}
				onclick={() => (showPreview = !showPreview)}
			>
				{#if showPreview}
					<EyeOff class="h-4 w-4" />
					Exit Preview
				{:else}
					<Eye class="h-4 w-4" />
					Preview
				{/if}
			</button>
			{#if onOpenSettings}
				<button class="btn btn-ghost btn-sm" onclick={onOpenSettings} title="Form Settings">
					<Settings class="h-4 w-4" />
					Settings
				</button>
			{/if}
			<button class="btn btn-ghost btn-sm" onclick={handleReset}>
				<RotateCcw class="h-4 w-4" />
				Reset
			</button>
			<button class="btn btn-primary btn-sm" onclick={handleSave}>
				<Save class="h-4 w-4" />
				Save Form
			</button>
		</div>
	</div>

	<!-- Main Content - 3 Panel Layout with Resizable Panes -->
	<PaneGroup direction="horizontal" class="flex-1">
		<!-- Left Panel: Field Library (smaller in preview mode) -->
		<Pane
			defaultSize={showPreview ? 15 : 20}
			minSize={10}
			maxSize={showPreview ? 20 : 30}
			class="bg-base-100 overflow-hidden"
		>
			<FieldLibrary />
		</Pane>

		<PaneResizer class="resizer-handle">
			<PaneHandle />
		</PaneResizer>

		<!-- Center Panel: Form Canvas or Preview (expands in preview mode) -->
		<Pane
			defaultSize={showPreview ? 85 : 45}
			minSize={30}
			class="bg-base-200/50 overflow-hidden"
		>
			{#if showPreview}
				<!-- Preview Mode - Live Form Renderer (full width, properly padded) -->
				<div class="h-full overflow-auto bg-base-100 flex flex-col">
					<!-- Preview Mode Banner -->
					<div class="bg-info text-info-content px-4 py-3 shrink-0">
						<div class="flex items-center gap-2">
							<Info class="h-5 w-5 shrink-0" />
							<div>
								<span class="font-medium">Preview Mode</span>
								<span class="hidden sm:inline"> - This is how your clients will see the form. Navigate freely without validation.</span>
							</div>
						</div>
					</div>

					{#if enhancedPreviewSchema.steps.length > 0 && (enhancedPreviewSchema.steps[0]?.fields?.length ?? 0) > 0}
						<div class="flex-1 min-h-0 overflow-auto">
							<DynamicForm
								schema={enhancedPreviewSchema}
								branding={resolvedBranding}
								previewMode={true}
								onSubmit={async (data) => {
									console.log("Preview form submitted:", data);
								}}
								submitButtonText="Submit (Preview)"
								successMessage="This is a preview - no data was submitted."
							/>
						</div>
					{:else}
						<div class="flex-1 flex items-center justify-center">
							<div class="text-center text-base-content/50 py-12">
								<Eye class="h-12 w-12 mx-auto mb-4" />
								<p class="text-sm">No fields added yet</p>
								<p class="text-xs mt-1">Add fields to see the live preview</p>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<FormCanvas />
			{/if}
		</Pane>

		<!-- Right Panel: Field Properties (hidden in preview mode) -->
		{#if !showPreview}
			<PaneResizer class="resizer-handle">
				<PaneHandle />
			</PaneResizer>

			<Pane defaultSize={35} minSize={20} maxSize={50} class="bg-base-100 overflow-hidden">
				<FieldProperties />
			</Pane>
		{/if}
	</PaneGroup>
</div>

<!-- Confirmation / Error Modal -->
<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box">
		<h3 class="font-bold text-lg">{confirmTitle}</h3>
		<p class="py-4 text-base-content/70">{confirmMessage}</p>
		<div class="modal-action">
			{#if isErrorModal}
				<button class="btn btn-primary" onclick={handleCancelConfirm}>OK</button>
			{:else}
				<button class="btn btn-ghost" onclick={handleCancelConfirm}>Cancel</button>
				<button class="btn btn-primary" onclick={handleConfirm}>Continue</button>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<style>
	/* Resizer handle track styling - visible colored gap */
	:global(.resizer-handle) {
		width: 12px;
		background-color: #e5e7eb;
		cursor: col-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s ease;
		position: relative;
	}

	:global(.resizer-handle:hover) {
		background-color: hsl(var(--p) / 0.25);
	}

	:global(.resizer-handle[data-state="dragging"]) {
		background-color: hsl(var(--p) / 0.35);
	}

	/* Ensure handle is absolutely centered */
	:global(.resizer-handle > div) {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
	}
</style>
