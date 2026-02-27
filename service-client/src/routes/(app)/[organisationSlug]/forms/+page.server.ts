import type { PageServerLoad } from "./$types";
import { getOrganisationFormSubmissions, getOrganisationForms } from "$lib/api/forms.remote";

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get("status") as
		| "draft"
		| "completed"
		| "processing"
		| "processed"
		| "archived"
		| null;

	const [submissions, forms] = await Promise.all([
		getOrganisationFormSubmissions(statusFilter ? { status: statusFilter } : {}),
		getOrganisationForms({ activeOnly: true }),
	]);

	return {
		submissions,
		forms,
		statusFilter,
	};
};
