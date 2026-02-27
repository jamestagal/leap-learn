import type { PageServerLoad } from "./$types";
import { getFormTemplateBySlug } from "$lib/api/forms.remote";

export const load: PageServerLoad = async ({ params }) => {
	const template = await getFormTemplateBySlug(params.slug);

	return {
		template,
	};
};
