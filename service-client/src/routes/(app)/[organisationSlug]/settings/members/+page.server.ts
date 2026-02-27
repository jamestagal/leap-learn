import { getOrganisationMembers } from "$lib/api/organisation.remote";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends }) => {
	depends("load:members");
	const members = await getOrganisationMembers();
	return { members };
};
