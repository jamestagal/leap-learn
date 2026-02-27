import type { PageServerLoad } from "./$types";
import { getSubmissionBySlug } from "$lib/api/forms.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	try {
		const result = await getSubmissionBySlug(params.slug);
		return {
			submission: result.submission,
			form: result.form,
			organisation: result.organisation,
		};
	} catch {
		throw error(404, "Form not found");
	}
};
