import type { PageServerLoad } from "./$types";
import { hasPermission } from "$lib/server/permissions";
import { env } from "$env/dynamic/private";
import type { ContentInfo } from "$lib/api/h5p-content.types";

type ContentListData = {
	items: ContentInfo[];
	total: number;
};

async function fetchH5P<T>(
	endpoint: string,
	accessToken: string | undefined,
): Promise<T | null> {
	try {
		const response = await fetch(`${env.CORE_URL}/api/v1/h5p${endpoint}`, {
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
		});

		if (!response.ok) return null;

		const body = await response.json();
		return body?.data ?? null;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { membership, organisation } = await parent();
	const isAdmin = hasPermission(membership.role, "settings:edit");
	const accessToken = cookies.get("access_token");

	const data = await fetchH5P<ContentListData>(
		`/content?orgId=${organisation.id}&limit=50&offset=0`,
		accessToken,
	);

	return {
		contentItems: data?.items ?? [],
		total: data?.total ?? 0,
		hasAdminPermission: isAdmin,
		organisationId: organisation.id,
	};
};
