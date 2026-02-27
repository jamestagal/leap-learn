import type { PageServerLoad } from "./$types";
import { getOrganisationForms, getSystemFormTemplates } from "$lib/api/forms.remote";
import { getClients } from "$lib/api/clients.remote";

export const load: PageServerLoad = async () => {
	const [templates, customForms, clients] = await Promise.all([
		getSystemFormTemplates(),
		getOrganisationForms({ activeOnly: true }),
		getClients({ limit: 100 }),
	]);

	return { templates, customForms, clients };
};
