import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisations, organisationMemberships, users } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { verifyJWT } from "$lib/server/jwt";
import type { User } from "$lib/types";

/**
 * Root page handler: serves landing page (public) or redirects to organisation dashboard.
 *
 * Since "/" is a public route (no hooks auth), we manually verify the JWT here
 * to check if the user is logged in. This keeps the hooks auth flow completely
 * untouched for all other routes while allowing "/" to serve the landing page.
 */
export const load: import("./$types").PageServerLoad = async ({ cookies }) => {
	// Manually check auth — hooks skip auth for "/" (public route)
	const access_token = cookies.get("access_token") ?? "";
	const refresh_token = cookies.get("refresh_token") ?? "";

	// No tokens at all — show landing page
	if (!access_token && !refresh_token) {
		return { isAuthenticated: false, email: "", avatar: "", subscription_active: false };
	}

	// Try to verify the access token
	const user = await verifyJWT<User>(access_token);
	const userId = user?.id ?? "";

	if (userId) {
		// Get user's default organisation
		const [dbUser] = await db
			.select({ defaultOrganisationId: users.defaultOrganisationId })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		let organisationSlug: string | null = null;

		if (dbUser?.defaultOrganisationId) {
			// Get the default organisation's slug
			const [organisation] = await db
				.select({ slug: organisations.slug })
				.from(organisations)
				.where(and(eq(organisations.id, dbUser.defaultOrganisationId), eq(organisations.status, "active")))
				.limit(1);

			organisationSlug = organisation?.slug ?? null;
		}

		// If no default organisation, get organisation where user has highest role (owner > admin > member)
		if (!organisationSlug) {
			const memberships = await db
				.select({
					slug: organisations.slug,
					role: organisationMemberships.role,
				})
				.from(organisationMemberships)
				.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
				.where(
					and(
						eq(organisationMemberships.userId, userId),
						eq(organisationMemberships.status, "active"),
						eq(organisations.status, "active"),
					),
				);

			// Prioritize by role: owner first, then admin, then member
			const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
			const sorted = memberships.sort(
				(a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3),
			);

			organisationSlug = sorted[0]?.slug ?? null;
		}

		// Redirect to organisation dashboard if user has one
		if (organisationSlug) {
			throw redirect(302, `/${organisationSlug}`);
		}

		// Authenticated but no organisation — show create organisation page
		return {
			isAuthenticated: true,
			email: user?.email ?? "",
			avatar: user?.avatar ?? "",
			subscription_active: user?.subscription_active ?? false,
		};
	}

	// Token exists but expired/invalid — show landing page
	// (Don't attempt refresh here; they'll get refreshed when they visit any auth route)
	return { isAuthenticated: false, email: "", avatar: "", subscription_active: false };
};
