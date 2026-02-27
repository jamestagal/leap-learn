<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { Builder } from "$lib/components/form-builder";
	import { createForm } from "$lib/api/forms.remote";
	import type { FormSchema } from "$lib/types/form-builder";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);

	// Get form type from URL params or default
	let formType = $derived(
		(page.url.searchParams.get("type") as
			| "questionnaire"
			| "consultation"
			| "feedback"
			| "intake"
			| "custom") || "questionnaire"
	);

	// Form metadata
	let formName = $state("Untitled Form");
	let formSlug = $state("");
	let formDescription = $state("");

	// Generate slug from name
	function generateSlug(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	}

	// Auto-generate slug when name changes
	$effect(() => {
		if (!formSlug || formSlug === generateSlug("Untitled Form")) {
			formSlug = generateSlug(formName);
		}
	});

	async function handleSave(schema: FormSchema) {
		if (!formName.trim()) {
			toast.error("Form name is required");
			return;
		}

		if (!formSlug.trim()) {
			toast.error("Form slug is required");
			return;
		}

		try {
			const form = await createForm({
				name: formName,
				slug: formSlug,
				description: formDescription || undefined,
				formType,
				schema,
				isActive: true,
			});

			toast.success("Form created successfully");
			goto(`/${organisationSlug}/settings/forms/${form!.id}`);
		} catch (err) {
			toast.error("Failed to create form", err instanceof Error ? err.message : "");
		}
	}

	function getFormTypeLabel(type: string) {
		const labels: Record<string, string> = {
			questionnaire: "Questionnaire",
			consultation: "Consultation Form",
			feedback: "Feedback Form",
			intake: "Intake Form",
			custom: "Custom Form",
		};
		return labels[type] || type;
	}
</script>

<div class="flex flex-col h-[calc(100vh-8rem)]">
	<!-- Compact Header with Form Metadata -->
	<div class="flex-shrink-0 mb-2 flex items-center justify-between gap-4 flex-wrap">
		<div class="flex items-center gap-4">
			<a href="/{organisationSlug}/settings/forms" class="btn btn-ghost btn-sm">
				← Back
			</a>
			<div>
				<h1 class="text-lg font-bold">Create New Form</h1>
				<p class="text-xs text-base-content/60">{getFormTypeLabel(formType)}</p>
			</div>
		</div>
		<div class="flex items-center gap-3 flex-wrap">
			<input
				id="form-name"
				type="text"
				class="input input-bordered input-sm w-48"
				bind:value={formName}
				placeholder="Form Name"
			/>
			<input
				id="form-slug"
				type="text"
				class="input input-bordered input-sm w-36 font-mono"
				bind:value={formSlug}
				placeholder="url-slug"
			/>
		</div>
	</div>

	<!-- Builder - Full Height -->
	<div class="flex-1 overflow-hidden border border-base-300 rounded-lg">
		<Builder
			onSave={handleSave}
			organisationLogoUrl={data.organisation.logoUrl}
		/>
	</div>
</div>
