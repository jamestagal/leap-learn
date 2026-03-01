import type { PageServerLoad } from "./$types";
import { getCourse } from "$lib/api/courses.remote";
import { listContent } from "$lib/api/h5p-content.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const courseId = params.courseId;

	try {
		const [course, contentResult] = await Promise.all([
			getCourse(courseId),
			listContent({ limit: 100 }),
		]);

		return {
			course,
			availableContent: contentResult.items,
		};
	} catch (err) {
		throw error(404, "Course not found");
	}
};
