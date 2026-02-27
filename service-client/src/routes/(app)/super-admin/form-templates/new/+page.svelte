<script lang="ts">
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import Builder from '$lib/components/form-builder/Builder.svelte';
	import { createFormTemplate } from '$lib/api/super-admin-templates.remote';
	import type { FormSchema } from '$lib/types/form-builder';

	const toast = getToast();

	// Settings state
	let name = $state('');
	let slug = $state('');
	let slugManuallyEdited = $state(false);
	let description = $state('');
	let category = $state<'questionnaire' | 'consultation' | 'feedback' | 'intake' | 'general'>('questionnaire');
	let displayOrder = $state(0);
	let isFeatured = $state(false);
	let newUntil = $state('');
	let slugError = $state('');

	// Auto-generate slug from name (debounced)
	let slugTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleNameInput() {
		if (!slugManuallyEdited) {
			clearTimeout(slugTimeout);
			slugTimeout = setTimeout(() => {
				slug = generateSlug(name);
			}, 300);
		}
	}

	function handleSlugInput() {
		slugManuallyEdited = true;
		slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
		slugError = '';
	}

	function generateSlug(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 255);
	}

	async function handleSave(schema: FormSchema) {
		if (!name.trim()) {
			toast.error('Validation', 'Template name is required');
			return;
		}

		try {
			await createFormTemplate({
				name: name.trim(),
				slug: slug || undefined,
				description: description.trim() || undefined,
				category,
				schema,
				uiConfig: schema.uiConfig || {
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
			toast.success('Created', 'Form template created successfully');
			await goto('/super-admin/form-templates');
		} catch (e) {
			if (e instanceof Error && e.message.includes('slug')) {
				slugError = e.message;
			} else {
				toast.error('Error', e instanceof Error ? e.message : 'Failed to create template');
			}
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Create Form Template</h2>
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
						oninput={handleNameInput}
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
						placeholder="auto-generated-from-name"
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
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body p-0">
			<Builder onSave={handleSave} />
		</div>
	</div>
</div>
