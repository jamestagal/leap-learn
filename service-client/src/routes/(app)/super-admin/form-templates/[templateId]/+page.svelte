<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import Builder from '$lib/components/form-builder/Builder.svelte';
	import { getFormTemplateAdmin, updateFormTemplate } from '$lib/api/super-admin-templates.remote';
	import { buildFormSchema, extractUiConfig } from '$lib/components/form-builder/utils/schema-generator';
	import type { FormSchema } from '$lib/types/form-builder';

	const toast = getToast();

	let templateId = $derived(page.params.templateId as string);

	// Loading state
	let loading = $state(true);
	let notFound = $state(false);

	// Settings state
	let name = $state('');
	let slug = $state('');
	let description = $state('');
	let category = $state<'questionnaire' | 'consultation' | 'feedback' | 'intake' | 'general'>('questionnaire');
	let displayOrder = $state(0);
	let isFeatured = $state(false);
	let newUntil = $state('');
	let slugError = $state('');

	// Schema for Builder
	let initialSchema = $state<FormSchema | undefined>(undefined);

	onMount(async () => {
		try {
			const template = await getFormTemplateAdmin(templateId);
			name = template.name;
			slug = template.slug;
			description = template.description || '';
			category = template.category as typeof category;
			displayOrder = template.displayOrder;
			isFeatured = template.isFeatured;
			newUntil = template.newUntil ? (new Date(template.newUntil).toISOString().split('T')[0] ?? '') : '';
			initialSchema = buildFormSchema(template.schema, template.uiConfig);
		} catch {
			notFound = true;
		} finally {
			loading = false;
		}
	});

	function handleSlugInput() {
		slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
		slugError = '';
	}

	async function handleSave(schema: FormSchema) {
		if (!name.trim()) {
			toast.error('Validation', 'Template name is required');
			return;
		}

		try {
			const { schema: schemaOnly, uiConfig } = extractUiConfig(schema);
			await updateFormTemplate({
				id: templateId,
				name: name.trim(),
				slug,
				description: description.trim() || null,
				category,
				schema: schemaOnly,
				uiConfig: uiConfig || {
					layout: 'single-column',
					showProgressBar: true,
					showStepNumbers: true,
					submitButtonText: 'Submit',
					successMessage: 'Thank you for your submission!',
				},
				isFeatured,
				displayOrder,
				newUntil: newUntil || null,
			});
			toast.success('Saved', 'Template updated successfully');
			await goto('/super-admin/form-templates');
		} catch (e) {
			if (e instanceof Error && e.message.includes('slug')) {
				slugError = e.message;
			} else {
				toast.error('Error', e instanceof Error ? e.message : 'Failed to update template');
			}
		}
	}
</script>

{#if loading}
	<div class="flex justify-center py-12">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if notFound}
	<div class="rounded-lg bg-base-200 p-12 text-center">
		<h3 class="text-lg font-medium">Template not found</h3>
		<p class="text-base-content/60 mt-2">The template you're looking for doesn't exist.</p>
		<a href="/super-admin/form-templates" class="btn btn-primary mt-4">Back to Templates</a>
	</div>
{:else}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h2 class="text-2xl font-bold">Edit Template</h2>
			<a href="/super-admin/form-templates" class="btn btn-ghost">Cancel</a>
		</div>

		<!-- Settings Panel -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="card-title text-base">Template Settings</h3>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<!-- Name -->
					<div class="form-control">
						<label class="label" for="name">
							<span class="label-text">Name <span class="text-error">*</span></span>
						</label>
						<input
							id="name"
							type="text"
							class="input input-bordered"
							placeholder="e.g. Website Questionnaire"
							bind:value={name}
						/>
					</div>

					<!-- Slug -->
					<div class="form-control">
						<label class="label" for="slug">
							<span class="label-text">Slug</span>
						</label>
						<input
							id="slug"
							type="text"
							class="input input-bordered font-mono text-sm {slugError ? 'input-error' : ''}"
							bind:value={slug}
							oninput={handleSlugInput}
						/>
						{#if slugError}
							<label class="label">
								<span class="label-text-alt text-error">{slugError}</span>
							</label>
						{/if}
					</div>

					<!-- Category -->
					<div class="form-control">
						<label class="label" for="category">
							<span class="label-text">Category</span>
						</label>
						<select id="category" class="select select-bordered" bind:value={category}>
							<option value="questionnaire">Questionnaire</option>
							<option value="consultation">Consultation</option>
							<option value="feedback">Feedback</option>
							<option value="intake">Intake</option>
							<option value="general">General</option>
						</select>
					</div>

					<!-- Description -->
					<div class="form-control md:col-span-2">
						<label class="label" for="description">
							<span class="label-text">Description</span>
						</label>
						<textarea
							id="description"
							class="textarea textarea-bordered"
							placeholder="Brief description of this template..."
							bind:value={description}
							rows="2"
						></textarea>
					</div>

					<!-- Display Order -->
					<div class="form-control">
						<label class="label" for="displayOrder">
							<span class="label-text">Display Order</span>
						</label>
						<input
							id="displayOrder"
							type="number"
							class="input input-bordered"
							bind:value={displayOrder}
							min="0"
						/>
					</div>

					<!-- Is Featured -->
					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input type="checkbox" class="checkbox" bind:checked={isFeatured} />
							<span class="label-text">Featured Template</span>
						</label>
					</div>

					<!-- New Until -->
					<div class="form-control">
						<label class="label" for="newUntil">
							<span class="label-text">New Until</span>
						</label>
						<div class="flex gap-2">
							<input
								id="newUntil"
								type="date"
								class="input input-bordered flex-1"
								bind:value={newUntil}
							/>
							{#if newUntil}
								<button class="btn btn-ghost btn-sm" onclick={() => (newUntil = '')} title="Clear">
									&times;
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Builder -->
		{#if initialSchema}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-0">
					<Builder {initialSchema} onSave={handleSave} />
				</div>
			</div>
		{/if}
	</div>
{/if}
