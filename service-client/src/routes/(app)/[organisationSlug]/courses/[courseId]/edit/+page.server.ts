import type { PageServerLoad } from "./$types";
import { getCourse, getContentUsageCounts } from "$lib/api/courses.remote";
import { listContent } from "$lib/api/h5p-content.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const courseId = params.courseId;

	try {
		const [course, contentResult] = await Promise.all([
			getCourse(courseId),
			listContent({ limit: 100 }),
		]);

		// Get usage counts for all available content
		const contentIds = contentResult.items.map((c) => c.id);
		const contentUsageCounts = contentIds.length > 0
			? await getContentUsageCounts(contentIds)
			: {};

		return {
			course,
			availableContent: contentResult.items,
			contentUsageCounts,
		};
	} catch (err) {
		throw error(404, "Course not found");
	}
};
