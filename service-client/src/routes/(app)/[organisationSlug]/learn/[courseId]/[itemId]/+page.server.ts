import type { PageServerLoad } from "./$types";
import { getCourse } from "$lib/api/courses.remote";
import { getMyProgress } from "$lib/api/enrolments.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const { courseId, itemId } = params;

	try {
		const [course, progress] = await Promise.all([
			getCourse(courseId),
			getMyProgress(courseId),
		]);

		if (!progress) {
			throw error(403, "You must be enrolled to access this content");
		}

		// Find the current item
		const currentItem = course.items.find((item) => item.id === itemId);
		if (!currentItem) {
			throw error(404, "Course item not found");
		}

		// Find current item's progress
		const currentProgress = progress.find((p) => p.itemId === itemId);

		// Calculate prev/next
		const currentIndex = course.items.findIndex((item) => item.id === itemId);
		const prevItem = currentIndex > 0 ? course.items[currentIndex - 1] : null;
		const nextItem =
			currentIndex < course.items.length - 1 ? course.items[currentIndex + 1] : null;

		return {
			course,
			progress,
			currentItem,
			currentProgress: currentProgress || null,
			prevItem,
			nextItem,
			currentIndex,
		};
	} catch (err) {
		if (err && typeof err === "object" && "status" in err) throw err;
		throw error(404, "Content not found");
	}
};
