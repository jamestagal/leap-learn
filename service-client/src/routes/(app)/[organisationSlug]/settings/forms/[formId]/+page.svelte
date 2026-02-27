<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { Builder } from "$lib/components/form-builder";
	import { updateForm } from "$lib/api/forms.remote";
	import { buildFormSchema, extractUiConfig } from "$lib/components/form-builder/utils/schema-generator";
	import type { FormSchema } from "$lib/types/form-builder";
	import type { PageProps } from "./$types";
	import ChevronLeft from "lucide-svelte/icons/chevron-left";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);

	// Form metadata - sync from data when it changes
	let formName = $state("");
	let formSlug = $state("");
	let formDescription = $state("");
	let isActive = $state(false);
	let isDefault = $state(false);
	let requiresAuth = $state(false);

	// Sync form state when data changes
	$effect(() => {
		formName = data.form.name;
		formSlug = data.form.slug;
		formDescription = data.form.description || "";
		isActive = data.form.isActive;
		isDefault = data.form.isDefault;
		requiresAuth = data.form.requiresAuth;
	});

	// Settings modal
	let settingsModal = $state<HTMLDialogElement | null>(null);

	async function handleSave(schema: FormSchema) {
		try {
			const { schema: schemaOnly, uiConfig } = extractUiConfig(schema);
			await updateForm({
				id: data.form.id,
				name: formName,
				slug: formSlug,
				description: formDescription || null,
				schema: schemaOnly,
				uiConfig,
				isActive,
				isDefault,
				requiresAuth,
			});

			toast.success("Form saved successfully");
			await invalidateAll();
		} catch (err) {
			toast.error("Failed to save form", err instanceof Error ? err.message : "");
		}
	}

	async function handleSettingsSave() {
		try {
			await updateForm({
				id: data.form.id,
				name: formName,
				slug: formSlug,
				description: formDescription || null,
				isActive,
				isDefault,
				requiresAuth,
			});

			toast.success("Settings saved");
			settingsModal?.close();
			await invalidateAll();
		} catch (err) {
			toast.error("Failed to save settings", err instanceof Error ? err.message : "");
		}
	}

	// Merge the separate uiConfig column into the schema for the Builder
	let mergedSchema = $derived(buildFormSchema(data.form.schema, data.form.uiConfig));

	function getFormTypeLabel(type: string) {
		const labels: Record<string, string> = {
			questionnaire: "Questionnaire",
			consultation: "Consultation",
			feedback: "Feedback",
			intake: "Intake",
			custom: "Custom",
		};
		return labels[type] || type;
	}
</script>

<!-- Compact header bar -->
<div class="flex items-center gap-3 mb-2">
	<a
		href="/{organisationSlug}/settings/forms"
		class="btn btn-ghost btn-sm btn-square"
		title="Back to Forms"
	>
		<ChevronLeft class="h-5 w-5" />
	</a>
	<div class="flex items-center gap-2 min-w-0">
		<span class="font-medium truncate">{data.form.name}</span>
		<span class="badge badge-sm badge-ghost">{getFormTypeLabel(data.form.formType)}</span>
		<span class="text-xs text-base-content/50">v{data.form.version}</span>
	</div>
</div>

<!-- Builder - Full Height -->
<div class="flex-1 overflow-hidden border border-base-300 rounded-lg" style="height: calc(100vh - 10rem);">
	<Builder
		initialSchema={mergedSchema}
		onSave={handleSave}
		organisationLogoUrl={data.organisation.logoUrl}
		onOpenSettings={() => settingsModal?.showModal()}
	/>
</div>

<!-- Settings Modal -->
<dialog bind:this={settingsModal} class="modal">
	<div class="modal-box max-w-2xl">
		<h3 class="font-bold text-lg mb-4">Form Settings</h3>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="form-control">
				<label class="label" for="form-name">
					<span class="label-text">Form Name</span>
				</label>
				<input
					id="form-name"
					type="text"
					class="input input-bordered"
					bind:value={formName}
					placeholder="e.g., Client Discovery Questionnaire"
				/>
			</div>
			<div class="form-control">
				<label class="label" for="form-slug">
					<span class="label-text">URL Slug</span>
				</label>
				<input
					id="form-slug"
					type="text"
					class="input input-bordered font-mono"
					bind:value={formSlug}
					placeholder="e.g., client-discovery"
				/>
			</div>
			<div class="form-control sm:col-span-2">
				<label class="label" for="form-description">
					<span class="label-text">Description</span>
				</label>
				<input
					id="form-description"
					type="text"
					class="input input-bordered"
					bind:value={formDescription}
					placeholder="Brief description of the form"
				/>
			</div>
		</div>

		<div class="divider"></div>

		<div class="flex flex-wrap gap-6">
			<label class="label cursor-pointer gap-3">
				<input
					type="checkbox"
					class="toggle toggle-primary"
					bind:checked={isActive}
				/>
				<div>
					<span class="label-text font-medium">Active</span>
					<p class="text-xs text-base-content/60">Form is publicly accessible</p>
				</div>
			</label>
			<label class="label cursor-pointer gap-3">
				<input
					type="checkbox"
					class="toggle toggle-primary"
					bind:checked={isDefault}
				/>
				<div>
					<span class="label-text font-medium">Default</span>
					<p class="text-xs text-base-content/60">Use as default {getFormTypeLabel(data.form.formType).toLowerCase()}</p>
				</div>
			</label>
			<label class="label cursor-pointer gap-3">
				<input
					type="checkbox"
					class="toggle toggle-warning"
					bind:checked={requiresAuth}
				/>
				<div>
					<span class="label-text font-medium">Requires Auth</span>
					<p class="text-xs text-base-content/60">Users must be logged in</p>
				</div>
			</label>
		</div>

		<div class="modal-action">
			<button class="btn btn-ghost" onclick={() => settingsModal?.close()}>Cancel</button>
			<button class="btn btn-primary" onclick={handleSettingsSave}>Save Settings</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
