import type { PageServerLoad } from "./$types";
import { getCourse } from "$lib/api/courses.remote";
import { getCourseEnrolments, getCourseProgress } from "$lib/api/enrolments.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const courseId = params.courseId;

	try {
		const [course, enrolmentsList, progressStats] = await Promise.all([
			getCourse(courseId),
			getCourseEnrolments(courseId),
			getCourseProgress(courseId),
		]);

		return {
			course,
			enrolments: enrolmentsList,
			progressStats,
		};
	} catch (err) {
		throw error(404, "Course not found");
	}
};
