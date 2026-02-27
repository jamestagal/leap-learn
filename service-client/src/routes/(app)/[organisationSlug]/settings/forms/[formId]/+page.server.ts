import type { PageServerLoad } from "./$types";
import { getFormById } from "$lib/api/forms.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const form = await getFormById(params.formId);

	if (!form) {
		throw error(404, "Form not found");
	}

	return { form };
};
