import type { PageServerLoad } from "./$types";
import { getOrganisationForms, getFormTemplates } from "$lib/api/forms.remote";

export const load: PageServerLoad = async () => {
	const [forms, templates] = await Promise.all([getOrganisationForms({}), getFormTemplates({})]);

	return { forms, templates };
};
