import type { PageServerLoad } from "./$types";
import { getClients } from "$lib/api/clients.remote";

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get("status") as "active" | "archived" | null;
	const search = url.searchParams.get("search") || undefined;

	// Get clients with optional status filter (defaults to 'active' if not specified)
	const clients = await getClients({
		status: statusFilter || undefined,
		search,
	});

	return {
		clients,
		statusFilter,
		search,
	};
};
