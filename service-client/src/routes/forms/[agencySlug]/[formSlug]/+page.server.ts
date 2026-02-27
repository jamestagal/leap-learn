import type { PageServerLoad, Actions } from "./$types";
import { getFormBySlug, submitForm } from "$lib/api/forms.remote";
import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisations } from "$lib/server/schema";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ params }) => {
	// Get organisation by slug
	const [organisation] = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			logoUrl: organisations.logoUrl,
			primaryColor: organisations.primaryColor,
			secondaryColor: organisations.secondaryColor,
			accentColor: organisations.accentColor,
			accentGradient: organisations.accentGradient,
		})
		.from(organisations)
		.where(eq(organisations.slug, params.agencySlug));

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	// Get form by slug (public endpoint)
	const form = await getFormBySlug({
		organisationSlug: params.agencySlug,
		formSlug: params.formSlug,
	});

	if (!form) {
		throw error(404, "Form not found");
	}

	// Check if form requires authentication
	if (form.requiresAuth) {
		// For now, we'll just show an error. In production, redirect to login.
		throw error(403, "This form requires authentication");
	}

	return {
		organisation: {
			id: organisation.id,
			name: organisation.name,
			slug: organisation.slug,
			logoUrl: organisation.logoUrl,
			primaryColor: organisation.primaryColor,
			secondaryColor: organisation.secondaryColor,
			accentColor: organisation.accentColor,
			accentGradient: organisation.accentGradient,
		},
		form,
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();
		const data = Object.fromEntries(formData.entries());

		// Get the form to get its ID
		const form = await getFormBySlug({
			organisationSlug: params.agencySlug,
			formSlug: params.formSlug,
		});

		if (!form) {
			return { success: false, error: "Form not found" };
		}

		try {
			await submitForm({
				formId: form.id,
				data,
				metadata: {
					userAgent: request.headers.get("user-agent"),
					submittedAt: new Date().toISOString(),
				},
			});

			return { success: true };
		} catch (err) {
			console.error("Form submission error:", err);
			return { success: false, error: "Failed to submit form" };
		}
	},
};
