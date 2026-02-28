import type { PageServerLoad } from "./$types";
import { hasPermission } from "$lib/server/permissions";
import { env } from "$env/dynamic/private";
import type { ContentTypeCacheEntry, LibraryInfo } from "$lib/api/h5p.types";

async function fetchH5P<T>(endpoint: string, accessToken: string | undefined): Promise<T[]> {
	try {
		const response = await fetch(`${env.CORE_URL}/api/v1/h5p${endpoint}`, {
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
		});

		if (!response.ok) return [];

		const body = await response.json();
		return body?.data ?? [];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { membership } = await parent();
	const isAdmin = hasPermission(membership.role, "settings:edit");
	const accessToken = cookies.get("access_token");

	const [contentTypes, installedLibraries] = await Promise.all([
		fetchH5P<ContentTypeCacheEntry>("/content-type-cache", accessToken),
		fetchH5P<LibraryInfo>("/libraries", accessToken),
	]);

	return {
		contentTypes,
		installedLibraries,
		hasAdminPermission: isAdmin,
	};
};
