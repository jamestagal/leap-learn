import type { PageServerLoad } from "./$types";
import { getCourse } from "$lib/api/courses.remote";
import { getMyProgress } from "$lib/api/enrolments.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const courseId = params.courseId;

	try {
		const [course, progress] = await Promise.all([
			getCourse(courseId),
			getMyProgress(courseId),
		]);

		return {
			course,
			progress,
		};
	} catch (err) {
		throw error(404, "Course not found");
	}
};
