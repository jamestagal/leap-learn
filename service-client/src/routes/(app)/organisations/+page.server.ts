/**
 * Organisations List Page Server Load
 *
 * Lists all organisations the user belongs to.
 * Redirects to the user's default organisation if they only have one.
 */

import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisations, organisationMemberships, users } from "$lib/server/schema";
import { eq, and, asc } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw redirect(302, "/login");
	}

	// Get all organisations the user belongs to
	const userOrganisations = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			logoUrl: organisations.logoUrl,
			primaryColor: organisations.primaryColor,
			status: organisations.status,
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
		)
		.orderBy(asc(organisations.name));

	// Get user's default organisation
	const [user] = await db
		.select({ defaultOrganisationId: users.defaultOrganisationId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	// Check if user was redirected due to access revocation
	const reason = url.searchParams.get("reason");

	// If user has no organisations, they need to create one
	if (userOrganisations.length === 0) {
		return {
			organisations: [],
			defaultOrganisationId: null,
			reason,
			showCreatePrompt: true,
		};
	}

	// If user has only one organisation and no special reason, redirect to it
	const firstOrganisation = userOrganisations[0];
	if (userOrganisations.length === 1 && !reason && firstOrganisation) {
		throw redirect(302, `/${firstOrganisation.slug}`);
	}

	return {
		organisations: userOrganisations,
		defaultOrganisationId: user?.defaultOrganisationId ?? null,
		reason,
		showCreatePrompt: false,
	};
};
