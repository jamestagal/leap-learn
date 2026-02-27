<script lang="ts">
	/**
	 * Public Form Page
	 *
	 * Renders a public form with organisation branding for client submissions.
	 */
	import { DynamicForm } from "$lib/components/form-renderer";
	import { submitForm } from "$lib/api/forms.remote";
	import { buildFormSchema } from "$lib/components/form-builder/utils/schema-generator";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import type { PageProps } from "./$types";
	import type { ResolvedBranding } from "$lib/types/branding";
	import type { FormUIConfig } from "$lib/types/form-builder";
	import { defaultOrganisationBranding } from "$lib/types/branding";
	import { hexToHsl } from "$lib/components/form-renderer/utils/theme-generator";

	const toast = getToast();
	let { data }: PageProps = $props();

	// Build resolved branding from organisation data columns
	// Colors from DB are hex - convert to HSL for theme generator
	function toHsl(hex: string | null | undefined): string | undefined {
		if (!hex) return undefined;
		return hex.startsWith("#") ? hexToHsl(hex) : hex;
	}

	let branding = $derived.by((): ResolvedBranding => {
		const colors: ResolvedBranding["colors"] = {
			...defaultOrganisationBranding.colors,
			primary: toHsl(data.organisation.primaryColor) || defaultOrganisationBranding.colors.primary,
		};
		const sec = toHsl(data.organisation.secondaryColor);
		if (sec) colors.secondary = sec;
		const acc = toHsl(data.organisation.accentColor);
		if (acc) colors.accent = acc;

		return {
			...defaultOrganisationBranding,
			colors,
			logo: data.organisation.logoUrl ? { url: data.organisation.logoUrl, position: "center" as const } : undefined,
		} as ResolvedBranding;
	});

	// Handle form submission
	async function handleSubmit(formData: Record<string, unknown>) {
		try {
			await submitForm({
				formId: data.form.id,
				data: formData,
				metadata: {
					submittedAt: new Date().toISOString(),
				},
			});
		} catch (err) {
			toast.error("Failed to submit form", err instanceof Error ? err.message : "");
			throw err; // Re-throw to let DynamicForm handle the error state
		}
	}

	function handleSuccess() {
		// Optional: Additional success handling like analytics
	}
</script>

<svelte:head>
	<title>{data.form.name} | {data.organisation.name}</title>
	<meta name="description" content={data.form.description || `${data.form.name} - ${data.organisation.name}`} />
</svelte:head>

<div class="min-h-screen bg-base-200">
	<DynamicForm
		schema={buildFormSchema(data.form.schema, data.form.uiConfig)}
		branding={branding}
		onSubmit={handleSubmit}
		onSuccess={handleSuccess}
		submitButtonText={(data.form.uiConfig as FormUIConfig | null)?.submitButtonText}
		successMessage={(data.form.uiConfig as FormUIConfig | null)?.successMessage}
	/>
</div>
