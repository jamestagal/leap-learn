import type { PageServerLoad } from "./$types";
import { getSubmissionById } from "$lib/api/forms.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const submission = await getSubmissionById(params.submissionId);

	if (!submission) {
		throw error(404, "Submission not found");
	}

	return { submission };
};
