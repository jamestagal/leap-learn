import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisationProfiles, organisations } from "$lib/server/schema";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	const { organisation, membership } = await parent();

	// Only owners can access onboarding
	if (membership.role !== "owner") {
		throw redirect(302, `/${organisation.slug}`);
	}

	// Check current setup status
	const [profile] = await db
		.select()
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, organisation.id))
		.limit(1);

	// If onboarding already completed, redirect to dashboard
	if (profile?.onboardingCompletedAt) {
		throw redirect(302, `/${organisation.slug}`);
	}

	// Get organisation details for branding step
	const [organisationDetails] = await db
		.select({
			logoUrl: organisations.logoUrl,
			primaryColor: organisations.primaryColor,
			email: organisations.email,
			phone: organisations.phone,
		})
		.from(organisations)
		.where(eq(organisations.id, organisation.id))
		.limit(1);

	const hasProfile = !!(profile?.legalEntityName || profile?.tradingName);
	const hasAddress = !!(profile?.addressLine1 && profile?.city);
	const hasBranding = !!organisationDetails?.logoUrl;

	return {
		profile: profile ?? null,
		organisationDetails,
		completionStatus: {
			hasProfile,
			hasAddress,
			hasBranding,
		},
	};
};
