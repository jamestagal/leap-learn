import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { verifyJWT } from "$lib/server/jwt";
import { db } from "$lib/server/db";
import { organisations, organisationMemberships } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import type { User } from "$lib/types";

export const load = async ({ cookies }: ServerLoadEvent) => {
	// If user has a valid session, redirect to their organisation dashboard
	const access_token = cookies.get("access_token");
	const refresh_token = cookies.get("refresh_token");

	if (refresh_token) {
		const user = await verifyJWT<User>(access_token ?? "");
		if (user?.id) {
			// Find user's primary organisation
			const memberships = await db
				.select({
					organisationSlug: organisations.slug,
					role: organisationMemberships.role,
				})
				.from(organisationMemberships)
				.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
				.where(
					and(
						eq(organisationMemberships.userId, user.id),
						eq(organisationMemberships.status, "active"),
						eq(organisations.status, "active"),
					),
				);

			if (memberships.length > 0) {
				const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
				const sorted = memberships.sort(
					(a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3),
				);
				throw redirect(302, `/${sorted[0]?.organisationSlug}`);
			}
		}
	}

	// Not authenticated — show landing page
	return {};
};
