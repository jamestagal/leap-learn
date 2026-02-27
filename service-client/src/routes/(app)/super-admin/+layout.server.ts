import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { users } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import { isSuperAdmin, getImpersonatedOrganisationId } from "$lib/server/super-admin";

export const load: import("./$types").LayoutServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw redirect(302, "/");
	}

	// Check if user is super admin
	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			access: users.access,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user || !isSuperAdmin(user.access)) {
		throw redirect(302, "/");
	}

	// Check if currently impersonating an organisation
	const impersonatedOrganisationId = getImpersonatedOrganisationId();

	return {
		superAdmin: {
			id: user.id,
			email: user.email,
		},
		isImpersonating: !!impersonatedOrganisationId,
		impersonatedOrganisationId,
	};
};
