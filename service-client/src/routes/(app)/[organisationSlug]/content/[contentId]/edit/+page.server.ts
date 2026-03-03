import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import type { EditorContentParams } from "$lib/api/h5p-content.types";
import { getContentUsageCounts } from "$lib/api/courses.remote";

export const load: PageServerLoad = async ({ parent, params, cookies }) => {
	const { organisation } = await parent();
	const accessToken = cookies.get("access_token");
	const contentId = params.contentId;

	// Fetch content params and usage counts in parallel
	let contentParams: EditorContentParams | undefined;
	let courseUsageCount = 0;

	try {
		const [paramsResponse, usageCounts] = await Promise.all([
			fetch(
				`${env.CORE_URL}/api/v1/h5p/editor/params/${contentId}?orgId=${organisation.id}`,
				{
					headers: {
						"Content-Type": "application/json",
						...(accessToken
							? { Authorization: `Bearer ${accessToken}` }
							: {}),
					},
				},
			),
			getContentUsageCounts([contentId]),
		]);

		if (!paramsResponse.ok) {
			throw error(404, "Content not found");
		}

		contentParams = await paramsResponse.json();
		courseUsageCount = usageCounts[contentId] || 0;
	} catch (err) {
		if ((err as any)?.status === 404) throw err;
		throw error(500, "Failed to load content parameters");
	}

	return {
		contentId,
		organisationId: organisation.id,
		contentParams,
		courseUsageCount,
	};
};
