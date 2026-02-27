<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDate } from '$lib/utils/formatting';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { Star, ChevronUp, ChevronDown, MoreHorizontal, Pencil, Upload, Undo2, Trash2, FileText } from 'lucide-svelte';
	import {
		getFormTemplatesAdmin,
		updateFormTemplate,
		deleteFormTemplate,
		reorderFormTemplates,
		getTemplatePushPreview,
		pushTemplateUpdate,
		rollbackTemplatePush,
	} from '$lib/api/super-admin-templates.remote';

	const toast = getToast();

	let loading = $state(true);
	let templates = $state<any[]>([]);
	let errorMsg = $state<string | null>(null);

	// Modal state
	let showPushModal = $state(false);
	let showRollbackModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedTemplate = $state<any>(null);
	let pushPreviewCount = $state(0);
	let actionLoading = $state(false);

	// Track which templates have had recent pushes (for rollback visibility)
	let pushedTemplateIds = $state<Set<string>>(new Set());

	onMount(() => {
		loadTemplates();
	});

	async function loadTemplates() {
		loading = true;
		errorMsg = null;
		try {
			templates = await getFormTemplatesAdmin();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Failed to load templates';
		} finally {
			loading = false;
		}
	}

	async function handleToggleFeatured(template: any) {
		try {
			await updateFormTemplate({ id: template.id, isFeatured: !template.isFeatured });
			template.isFeatured = !template.isFeatured;
		} catch (e) {
			toast.error('Error', 'Failed to update featured status');
		}
	}

	async function handleMoveUp(index: number) {
		if (index === 0) return;
		const items = [...templates];
		[items[index - 1], items[index]] = [items[index], items[index - 1]];
		const reorder = items.map((t, i) => ({ id: t.id, displayOrder: i }));
		templates = items;
		try {
			await reorderFormTemplates(reorder);
		} catch (e) {
			toast.error('Error', 'Failed to reorder');
			await loadTemplates();
		}
	}

	async function handleMoveDown(index: number) {
		if (index === templates.length - 1) return;
		const items = [...templates];
		[items[index], items[index + 1]] = [items[index + 1], items[index]];
		const reorder = items.map((t, i) => ({ id: t.id, displayOrder: i }));
		templates = items;
		try {
			await reorderFormTemplates(reorder);
		} catch (e) {
			toast.error('Error', 'Failed to reorder');
			await loadTemplates();
		}
	}

	async function openPushModal(template: any) {
		selectedTemplate = template;
		actionLoading = true;
		showPushModal = true;
		try {
			const result = await getTemplatePushPreview(template.id);
			pushPreviewCount = result.count;
		} catch (e) {
			pushPreviewCount = 0;
		} finally {
			actionLoading = false;
		}
	}

	async function handlePush() {
		if (!selectedTemplate) return;
		actionLoading = true;
		try {
			const result = await pushTemplateUpdate(selectedTemplate.id);
			pushedTemplateIds = new Set([...pushedTemplateIds, selectedTemplate.id]);
			toast.success('Push Complete', `Updated ${result.updatedCount} forms`);
			showPushModal = false;
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Push failed');
		} finally {
			actionLoading = false;
		}
	}

	function openRollbackModal(template: any) {
		selectedTemplate = template;
		showRollbackModal = true;
	}

	async function handleRollback() {
		if (!selectedTemplate) return;
		actionLoading = true;
		try {
			const result = await rollbackTemplatePush(selectedTemplate.id);
			pushedTemplateIds.delete(selectedTemplate.id);
			pushedTemplateIds = new Set(pushedTemplateIds);
			toast.success('Rollback Complete', `Rolled back ${result.rolledBackCount} forms`);
			showRollbackModal = false;
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Rollback failed');
		} finally {
			actionLoading = false;
		}
	}

	function openDeleteModal(template: any) {
		selectedTemplate = template;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedTemplate) return;
		actionLoading = true;
		try {
			await deleteFormTemplate(selectedTemplate.id);
			templates = templates.filter((t) => t.id !== selectedTemplate.id);
			toast.success('Deleted', `Template "${selectedTemplate.name}" deleted`);
			showDeleteModal = false;
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Delete failed');
		} finally {
			actionLoading = false;
		}
	}

	function getStepCount(schema: any): number {
		if (!schema?.steps) return 0;
		return Array.isArray(schema.steps) ? schema.steps.length : 0;
	}

	function isNewBadgeActive(newUntil: string | null): boolean {
		if (!newUntil) return false;
		return new Date(newUntil) > new Date();
	}

	// formatDate imported from '$lib/utils/formatting'
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Form Templates</h2>
		<a href="/super-admin/form-templates/new" class="btn btn-primary">
			Create Template
		</a>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if errorMsg}
		<div class="alert alert-error">
			<span>{errorMsg}</span>
		</div>
	{:else if templates.length === 0}
		<div class="rounded-lg bg-base-200 p-12 text-center">
			<FileText class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No form templates</h3>
			<p class="text-base-content/60">Create your first system form template to get started.</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead>
					<tr>
						<th class="w-20">#</th>
						<th>Name</th>
						<th>Slug</th>
						<th>Category</th>
						<th>Steps</th>
						<th>Featured</th>
						<th>New Badge</th>
						<th>Usage</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each templates as template, index (template.id)}
						<tr class="hover">
							<!-- Display Order -->
							<td>
								<div class="flex items-center gap-1">
									<button
										class="btn btn-ghost btn-xs"
										disabled={index === 0}
										onclick={() => handleMoveUp(index)}
										title="Move up"
									>
										<ChevronUp class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs"
										disabled={index === templates.length - 1}
										onclick={() => handleMoveDown(index)}
										title="Move down"
									>
										<ChevronDown class="h-3 w-3" />
									</button>
								</div>
							</td>

							<!-- Name -->
							<td class="font-medium">{template.name}</td>

							<!-- Slug -->
							<td>
								<code class="text-xs text-base-content/60">{template.slug}</code>
							</td>

							<!-- Category -->
							<td>
								<span class="badge badge-outline badge-sm">{template.category}</span>
							</td>

							<!-- Steps -->
							<td>{getStepCount(template.schema)}</td>

							<!-- Featured -->
							<td>
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => handleToggleFeatured(template)}
									title={template.isFeatured ? 'Remove featured' : 'Set featured'}
								>
									<Star
										class="h-4 w-4 {template.isFeatured ? 'fill-warning text-warning' : 'text-base-content/30'}"
									/>
								</button>
							</td>

							<!-- New Badge -->
							<td>
								{#if isNewBadgeActive(template.newUntil)}
									<div class="flex flex-col">
										<span class="badge badge-accent badge-sm">New</span>
										<span class="text-xs text-base-content/50 mt-0.5">{formatDate(template.newUntil)}</span>
									</div>
								{:else}
									<span class="text-base-content/30">---</span>
								{/if}
							</td>

							<!-- Usage -->
							<td>{template.usageCount}</td>

							<!-- Actions -->
							<td>
								<div class="dropdown dropdown-end">
									<div tabindex="0" role="button" class="btn btn-ghost btn-xs">
										<MoreHorizontal class="h-4 w-4" />
									</div>
									<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
									<ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-10 w-48 p-2 shadow border border-base-300">
										<li>
											<a href="/super-admin/form-templates/{template.id}">
												<Pencil class="h-4 w-4" />
												Edit
											</a>
										</li>
										<li>
											<button onclick={() => openPushModal(template)}>
												<Upload class="h-4 w-4" />
												Push Update
											</button>
										</li>
										{#if pushedTemplateIds.has(template.id)}
											<li>
												<button onclick={() => openRollbackModal(template)}>
													<Undo2 class="h-4 w-4" />
													Rollback
												</button>
											</li>
										{/if}
										<li>
											<button class="text-error" onclick={() => openDeleteModal(template)}>
												<Trash2 class="h-4 w-4" />
												Delete
											</button>
										</li>
									</ul>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Push Update Modal -->
{#if showPushModal && selectedTemplate}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Push Template Update</h3>
			{#if actionLoading && pushPreviewCount === 0}
				<div class="flex justify-center py-4">
					<span class="loading loading-spinner"></span>
				</div>
			{:else}
				<p class="py-2">
					Push update to <strong>{pushPreviewCount}</strong> organisation form{pushPreviewCount !== 1 ? 's' : ''}?
				</p>
				<div class="alert alert-warning mt-2">
					<span class="text-sm">Only forms that haven't been customized will be updated. Previous schemas will be saved for rollback.</span>
				</div>
			{/if}
			<div class="modal-action">
				<button class="btn" onclick={() => (showPushModal = false)}>Cancel</button>
				<button
					class="btn btn-primary"
					onclick={handlePush}
					disabled={actionLoading || pushPreviewCount === 0}
				>
					{#if actionLoading && pushPreviewCount > 0}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Push Update
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showPushModal = false)}></div>
	</div>
{/if}

<!-- Rollback Modal -->
{#if showRollbackModal && selectedTemplate}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Rollback Push Update</h3>
			<p class="py-2">Rollback the last push update for <strong>{selectedTemplate.name}</strong>?</p>
			<div class="alert alert-warning mt-2">
				<span class="text-sm">This will restore the previous schema for all affected organisation forms.</span>
			</div>
			<div class="modal-action">
				<button class="btn" onclick={() => (showRollbackModal = false)}>Cancel</button>
				<button class="btn btn-warning" onclick={handleRollback} disabled={actionLoading}>
					{#if actionLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Rollback
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showRollbackModal = false)}></div>
	</div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && selectedTemplate}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Template</h3>
			<p class="py-2">
				Are you sure you want to delete <strong>{selectedTemplate.name}</strong>?
			</p>
			{#if selectedTemplate.usageCount > 0}
				<div class="alert alert-warning mt-2">
					<span class="text-sm">
						This template is used by <strong>{selectedTemplate.usageCount}</strong> organisation form{selectedTemplate.usageCount !== 1 ? 's' : ''}. They will retain their copies but lose the connection to this template.
					</span>
				</div>
			{/if}
			<div class="modal-action">
				<button class="btn" onclick={() => (showDeleteModal = false)}>Cancel</button>
				<button class="btn btn-error" onclick={handleDelete} disabled={actionLoading}>
					{#if actionLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showDeleteModal = false)}></div>
	</div>
{/if}
