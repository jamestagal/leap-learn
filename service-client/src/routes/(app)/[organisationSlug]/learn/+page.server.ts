import type { PageServerLoad } from "./$types";
import { getMyEnrolments } from "$lib/api/enrolments.remote";
import { getCourses } from "$lib/api/courses.remote";

export const load: PageServerLoad = async () => {
	const [enrolmentsList, courseList] = await Promise.all([
		getMyEnrolments({ status: "active" }),
		getCourses({ status: "published" }),
	]);

	return {
		enrolments: enrolmentsList,
		publishedCourses: courseList,
	};
};
