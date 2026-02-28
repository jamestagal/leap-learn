import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import type { EditorContentParams } from "$lib/api/h5p-content.types";

export const load: PageServerLoad = async ({ parent, params, cookies }) => {
	const { organisation } = await parent();
	const accessToken = cookies.get("access_token");
	const contentId = params.contentId;

	// Fetch content params for the editor
	let contentParams: EditorContentParams | undefined;
	try {
		const response = await fetch(
			`${env.CORE_URL}/api/v1/h5p/editor/params/${contentId}?orgId=${organisation.id}`,
			{
				headers: {
					"Content-Type": "application/json",
					...(accessToken
						? { Authorization: `Bearer ${accessToken}` }
						: {}),
				},
			},
		);

		if (!response.ok) {
			throw error(404, "Content not found");
		}

		contentParams = await response.json();
	} catch (err) {
		if ((err as any)?.status === 404) throw err;
		throw error(500, "Failed to load content parameters");
	}

	return {
		contentId,
		organisationId: organisation.id,
		contentParams,
	};
};
