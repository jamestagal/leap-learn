<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { goto } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { deleteForm, duplicateForm, createFormFromTemplate, updateForm } from "$lib/api/forms.remote";
	import { formatDate } from '$lib/utils/formatting';
	import {
		Plus,
		FileStack,
		Star,
		Copy,
		Trash2,
		MoreVertical,
		Eye,
		EyeOff,
		ClipboardList,
		MessageSquare,
		ThumbsUp,
		UserPlus,
		Settings2,
		Layers,
		Download,
		Sparkles,
		ListOrdered,
		Lock,
		RefreshCw,
		PanelLeft,
		AlignJustify,
	} from "lucide-svelte";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);

	// Separate active and inactive forms
	let activeForms = $derived(data.forms.filter((f) => f.isActive));
	let inactiveForms = $derived(data.forms.filter((f) => !f.isActive));

	// Track which form is the active consultation form
	let activeConsultationForm = $derived(
		data.forms.find((f) => f.formType === "consultation" && f.isDefault && f.isActive),
	);
	// Which template is being used as fallback (if no custom consultation form)
	let consultationTemplateId = $derived.by(() => {
		if (activeConsultationForm) return null;
		// If no custom consultation form, Full Discovery template is the fallback
		const fd = data.templates.find((t) => t.slug === "full-discovery");
		return fd?.id ?? null;
	});

	// Form type icons
	const formTypeIcons: Record<string, typeof ClipboardList> = {
		questionnaire: ClipboardList,
		consultation: MessageSquare,
		feedback: ThumbsUp,
		intake: UserPlus,
		custom: Settings2,
	};

	// Category icons for templates
	const categoryIcons: Record<string, typeof ClipboardList> = {
		questionnaire: ClipboardList,
		consultation: MessageSquare,
		feedback: ThumbsUp,
		intake: UserPlus,
		general: Settings2,
	};

	function getFormTypeIcon(type: string) {
		return formTypeIcons[type] || Settings2;
	}

	function getCategoryIcon(category: string) {
		return categoryIcons[category] || Settings2;
	}

	async function handleDuplicate(id: string) {
		try {
			await duplicateForm({ formId: id });
			await invalidateAll();
			toast.success("Form duplicated");
		} catch (err) {
			toast.error("Failed to duplicate", err instanceof Error ? err.message : "");
		}
	}

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);

	function openDeleteModal(id: string, name: string) {
		deletingItem = { id, name };
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingItem = null;
	}

	async function confirmDelete() {
		if (!deletingItem) return;
		isDeleting = true;
		try {
			await deleteForm(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success("Form deleted");
		} catch (err) {
			toast.error("Failed to delete", err instanceof Error ? err.message : "");
		} finally {
			isDeleting = false;
		}
	}

	function handleDelete(id: string, name?: string) {
		openDeleteModal(id, name || "this form");
	}

	async function handleUseTemplate(templateId: string) {
		try {
			const form = await createFormFromTemplate({ templateId });
			if (!form) throw new Error("Form creation returned no result");
			if (form.isActive && form.isDefault) {
				toast.success("Form created and set as default");
			} else {
				toast.success("Form created from template");
			}
			goto(`/${organisationSlug}/settings/forms/${form.id}`);
		} catch (err) {
			toast.error("Failed to create form", err instanceof Error ? err.message : "");
		}
	}

	async function handleSetAsConsultationForm(formId: string) {
		try {
			await updateForm({ id: formId, formType: "consultation", isDefault: true, isActive: true });
			toast.success("Consultation form updated");
			invalidateAll();
		} catch (err) {
			toast.error("Failed to set consultation form", err instanceof Error ? err.message : "");
		}
	}

	async function handleUseAsConsultation(templateId: string) {
		try {
			const form = await createFormFromTemplate({ templateId, formType: "consultation" });
			if (!form) throw new Error("Form creation returned no result");
			// Ensure it's active and default
			if (!form.isActive || !form.isDefault) {
				await updateForm({ id: form.id, isDefault: true, isActive: true });
			}
			toast.success("Consultation form set");
			invalidateAll();
		} catch (err) {
			toast.error("Failed to set consultation form", err instanceof Error ? err.message : "");
		}
	}

	async function handleLayoutChange(formId: string, currentUiConfig: unknown, layout: "single-column" | "wizard" | "stepper") {
		try {
			const existing = (currentUiConfig && typeof currentUiConfig === "object" ? currentUiConfig : {}) as Record<string, unknown>;
			await updateForm({ id: formId, uiConfig: { ...existing, layout } });
			const layoutLabels: Record<string, string> = { wizard: "Wizard", stepper: "Stepper", "single-column": "Simple" };
		toast.success(`Layout changed to ${layoutLabels[layout] || "Simple"}`);
			invalidateAll();
		} catch (err) {
			toast.error("Failed to change layout", err instanceof Error ? err.message : "");
		}
	}

	function getFormLayout(uiConfig: unknown): string {
		if (uiConfig && typeof uiConfig === "object") {
			const config = uiConfig as Record<string, unknown>;
			return (config["layout"] as string) || "single-column";
		}
		return "single-column";
	}

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

	function getCategoryLabel(category: string) {
		const labels: Record<string, string> = {
			questionnaire: "Questionnaire",
			consultation: "Consultation",
			feedback: "Feedback",
			intake: "Intake",
			general: "General",
		};
		return labels[category] || category;
	}

	// Get step count from template schema
	function getStepCount(schema: unknown): number {
		if (!schema) return 0;
		try {
			const parsed = typeof schema === "string" ? JSON.parse(schema) : schema;
			if (parsed && Array.isArray(parsed.steps)) {
				return parsed.steps.length;
			}
			return 0;
		} catch {
			return 0;
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Form Templates</h1>
			<p class="text-base-content/70 mt-1">Create and manage client-facing forms</p>
		</div>
		<a href="/{organisationSlug}/settings/forms/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Form
		</a>
	</div>

	<!-- System Templates Section -->
	{#if data.templates.length > 0}
		<div>
			<div class="flex items-center gap-2 mb-3">
				<Sparkles class="h-4 w-4 text-primary" />
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
					System Templates ({data.templates.length})
				</h2>
			</div>
			<p class="text-sm text-base-content/60 mb-4">
				Pre-built templates you can use as starting points. Click "Use" to create a
				customizable copy.
			</p>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.templates as template (template.id)}
					{@const Icon = getCategoryIcon(template.category)}
					{@const stepCount = getStepCount(template.schema)}
					{@const isActiveConsultation = consultationTemplateId === template.id}
					<div
						class="card bg-gradient-to-br from-primary/5 to-base-100 border transition-colors overflow-hidden {isActiveConsultation ? 'border-success/40' : 'border-primary/20 hover:border-primary/40'}"
					>
						{#if isActiveConsultation}
							<div class="flex items-center gap-1.5 px-4 py-1.5 bg-success/10 border-b border-success/20">
								<MessageSquare class="h-3 w-3 text-success" />
								<span class="text-xs font-semibold text-success">Active Consultation Form</span>
							</div>
						{/if}
						<div class="card-body p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<h3 class="font-semibold truncate">{template.name}</h3>
										{#if template.newUntil && new Date(template.newUntil) > new Date()}
											<span class="badge badge-accent badge-sm">New</span>
										{/if}
										<span class="badge badge-ghost badge-sm text-base-content/50">System</span>
									</div>
									<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
										{template.description || "No description"}
									</p>
								</div>
								{#if !isActiveConsultation}
									<div class="dropdown dropdown-end">
										<button
											type="button"
											tabindex="0"
											class="btn btn-ghost btn-sm btn-square"
										>
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul
											class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
										>
											<li>
												<button type="button" onclick={() => handleUseAsConsultation(template.id)}>
													<MessageSquare class="h-4 w-4" />
													Set as Consultation Form
												</button>
											</li>
										</ul>
									</div>
								{/if}
							</div>

							<div class="flex items-center gap-2 mt-2 flex-wrap">
								<span class="badge badge-ghost badge-sm gap-1">
									<Icon class="h-3 w-3" />
									{getCategoryLabel(template.category)}
								</span>
								{#if stepCount > 0}
									<span class="badge badge-ghost badge-sm gap-1">
										<ListOrdered class="h-3 w-3" />
										{stepCount} {stepCount === 1 ? "step" : "steps"}
									</span>
								{/if}
							</div>

							<div class="flex gap-2 mt-3">
								<a
									href="/{organisationSlug}/settings/forms/preview/{template.slug}"
									class="btn btn-ghost btn-sm flex-1"
								>
									<Eye class="h-4 w-4" />
									Preview
								</a>
								<button
									type="button"
									class="btn btn-primary btn-sm flex-1"
									onclick={() => handleUseTemplate(template.id)}
								>
									<Download class="h-4 w-4" />
									Use
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Custom Forms Section -->
	{#if data.forms.length === 0}
		<!-- Empty state - only show if no system templates either -->
		{#if data.templates.length === 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body items-center text-center py-12">
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
					>
						<FileStack class="h-8 w-8" />
					</div>
					<h3 class="text-lg font-semibold">No forms yet</h3>
					<p class="text-base-content/60 max-w-sm">
						Create your first form to collect client information, feedback, or consultation
						requests.
					</p>
					<a href="/{organisationSlug}/settings/forms/new" class="btn btn-primary mt-4">
						<Plus class="h-4 w-4" />
						Create Form
					</a>
				</div>
			</div>
		{:else}
			<!-- Have templates but no custom forms yet -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body items-center text-center py-8">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/50 mb-3"
					>
						<Layers class="h-6 w-6" />
					</div>
					<h3 class="text-base font-semibold">No custom forms yet</h3>
					<p class="text-sm text-base-content/60 max-w-sm">
						Use a system template above to get started, or create a custom form from scratch.
					</p>
					<a href="/{organisationSlug}/settings/forms/new" class="btn btn-ghost btn-sm mt-3">
						<Plus class="h-4 w-4" />
						Create Custom Form
					</a>
				</div>
			</div>
		{/if}
	{:else}
		<!-- Active Forms -->
		{#if activeForms.length > 0}
			<div>
				<div class="flex items-center gap-2 mb-3">
					<Layers class="h-4 w-4 text-base-content/60" />
					<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
						Active Forms ({activeForms.length})
					</h2>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each activeForms as form (form.id)}
						{@const Icon = getFormTypeIcon(form.formType)}
						<div
							class="card bg-base-100 border border-base-300 hover:border-base-400 transition-colors"
						>
							<div class="card-body p-4">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<h3 class="font-semibold truncate">{form.name}</h3>
											<span class="badge badge-ghost badge-sm">Custom</span>
											{#if form.isDefault && form.formType === "consultation"}
												<span class="badge badge-primary badge-sm">
													<MessageSquare class="h-3 w-3 mr-1" />
													Consultation Form
												</span>
											{:else if form.isDefault}
												<span class="badge badge-primary badge-sm">
													<Star class="h-3 w-3 mr-1" />
													Default
												</span>
											{/if}
										</div>
										<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
											{form.description || "No description"}
										</p>
									</div>
									<div class="dropdown dropdown-end">
										<button
											type="button"
											tabindex="0"
											class="btn btn-ghost btn-sm btn-square"
										>
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul
											class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300"
										>
											<li>
												<a href="/{organisationSlug}/settings/forms/{form.id}"> Edit Form </a>
											</li>
											<li>
												<button type="button" onclick={() => handleDuplicate(form.id)}>
													<Copy class="h-4 w-4" />
													Duplicate
												</button>
											</li>
											{#if !(form.formType === "consultation" && form.isDefault)}
												<li>
													<button type="button" onclick={() => handleSetAsConsultationForm(form.id)}>
														<MessageSquare class="h-4 w-4" />
														Set as Consultation Form
													</button>
												</li>
											{/if}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button
													type="button"
													class="text-error"
													onclick={() => handleDelete(form.id)}
												>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										</ul>
									</div>
								</div>

								<div class="flex items-center gap-2 mt-2">
									<span class="badge badge-ghost badge-sm gap-1">
										<Icon class="h-3 w-3" />
										{getFormTypeLabel(form.formType)}
									</span>
									{#if form.requiresAuth}
										<span class="badge badge-warning badge-sm gap-1">
											<Eye class="h-3 w-3" />
											Auth Required
										</span>
									{/if}
								</div>

								{#if form.sourceTemplateId}
									<div class="flex items-center gap-1.5 mt-2 text-xs">
										{#if form.isCustomized}
											<span class="badge badge-ghost badge-sm gap-1">
												<Lock class="h-3 w-3" />
												Customized
											</span>
											<span class="text-base-content/50">Updates disabled</span>
										{:else}
											<span class="badge badge-info badge-sm gap-1">
												<RefreshCw class="h-3 w-3" />
												Synced
											</span>
											<span class="text-base-content/50">Receives system updates</span>
										{/if}
									</div>
								{/if}

								<!-- Layout Toggle -->
								<div class="flex items-center gap-2 mt-3 pt-3 border-t border-base-200">
									<span class="text-xs text-base-content/60 mr-auto">Layout:</span>
									<div class="join">
										<button
											type="button"
											class="join-item btn btn-xs {getFormLayout(form.uiConfig) === 'single-column' || (getFormLayout(form.uiConfig) !== 'wizard' && getFormLayout(form.uiConfig) !== 'stepper') ? 'btn-active' : 'btn-ghost'}"
											title="Simple layout"
											onclick={() => handleLayoutChange(form.id, form.uiConfig, "single-column")}
										>
											<AlignJustify class="h-3 w-3" />
											Simple
										</button>
										<button
											type="button"
											class="join-item btn btn-xs {getFormLayout(form.uiConfig) === 'stepper' ? 'btn-active' : 'btn-ghost'}"
											title="Stepper layout with numbered circles"
											onclick={() => handleLayoutChange(form.id, form.uiConfig, "stepper")}
										>
											<ListOrdered class="h-3 w-3" />
											Stepper
										</button>
										<button
											type="button"
											class="join-item btn btn-xs {getFormLayout(form.uiConfig) === 'wizard' ? 'btn-active' : 'btn-ghost'}"
											title="Wizard layout with sidebar"
											onclick={() => handleLayoutChange(form.id, form.uiConfig, "wizard")}
										>
											<PanelLeft class="h-3 w-3" />
											Wizard
										</button>
									</div>
								</div>

								<div class="flex items-center gap-4 mt-2 pt-2 border-t border-base-200">
									<span class="text-xs text-base-content/60"> v{form.version} </span>
									<span class="text-xs text-base-content/60">
										Updated {formatDate(form.updatedAt)}
									</span>
								</div>

								<a
									href="/{organisationSlug}/settings/forms/{form.id}"
									class="btn btn-ghost btn-sm mt-2 w-full"
								>
									Edit Form
								</a>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Inactive Forms -->
		{#if inactiveForms.length > 0}
			<div>
				<div class="flex items-center gap-2 mb-3">
					<EyeOff class="h-4 w-4 text-base-content/40" />
					<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
						Inactive Forms ({inactiveForms.length})
					</h2>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each inactiveForms as form (form.id)}
						{@const Icon = getFormTypeIcon(form.formType)}
						<div class="card bg-base-200/50 border border-base-300 opacity-60">
							<div class="card-body p-4">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<h3 class="font-semibold truncate">{form.name}</h3>
											<span class="badge badge-ghost badge-sm">Custom</span>
										</div>
										<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
											{form.description || "No description"}
										</p>
									</div>
									<div class="dropdown dropdown-end">
										<button
											type="button"
											tabindex="0"
											class="btn btn-ghost btn-sm btn-square"
										>
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul
											class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300"
										>
											<li>
												<a href="/{organisationSlug}/settings/forms/{form.id}"> Edit Form </a>
											</li>
											<li>
												<button type="button" onclick={() => handleDuplicate(form.id)}>
													<Copy class="h-4 w-4" />
													Duplicate
												</button>
											</li>
										</ul>
									</div>
								</div>
								<div class="flex items-center gap-2 mt-2">
									<span class="badge badge-ghost badge-sm gap-1">
										<Icon class="h-3 w-3" />
										{getFormTypeLabel(form.formType)}
									</span>
									<span class="badge badge-ghost badge-sm">Inactive</span>
								</div>

								{#if form.sourceTemplateId}
									<div class="flex items-center gap-1.5 mt-2 text-xs">
										{#if form.isCustomized}
											<span class="badge badge-ghost badge-sm gap-1">
												<Lock class="h-3 w-3" />
												Customized
											</span>
											<span class="text-base-content/50">Updates disabled</span>
										{:else}
											<span class="badge badge-info badge-sm gap-1">
												<RefreshCw class="h-3 w-3" />
												Synced
											</span>
											<span class="text-base-content/50">Receives system updates</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if showDeleteModal && deletingItem}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Form</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{deletingItem.name}</strong>? This action cannot
				be undone.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeDeleteModal} disabled={isDeleting}>
					Cancel
				</button>
				<button class="btn btn-error" onclick={confirmDelete} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeDeleteModal}></div>
	</div>
{/if}
