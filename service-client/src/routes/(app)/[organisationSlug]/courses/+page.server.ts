import type { PageServerLoad } from "./$types";
import { getCourses } from "$lib/api/courses.remote";

export const load: PageServerLoad = async () => {
	const courseList = await getCourses(undefined);

	return {
		courses: courseList,
	};
};
