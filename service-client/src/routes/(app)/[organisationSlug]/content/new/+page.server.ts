import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
	const { organisation } = await parent();
	return { organisationId: organisation.id };
};
