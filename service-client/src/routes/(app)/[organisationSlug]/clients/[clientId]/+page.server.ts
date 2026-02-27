import type { PageServerLoad } from "./$types";
import { getClientById } from "$lib/api/clients.remote";

export const load: PageServerLoad = async ({ params }) => {
	const { clientId } = params;

	const client = await getClientById(clientId);

	return {
		client,
	};
};
