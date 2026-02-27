/**
 * Organisation Slug Layout Server Load
 *
 * Loads organisation context based on URL slug parameter.
 * Verifies user has access to the requested organisation.
 */

import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisations, organisationMemberships, organisationFormOptions, organisationProfiles, users } from "$lib/server/schema";
import { eq, and, asc } from "drizzle-orm";
import { groupOptionsByCategory, mergeWithDefaults } from "$lib/stores/organisation-config.svelte";
import type { OrganisationConfig } from "$lib/stores/organisation-config.svelte";
import type { LayoutServerLoad } from "./$types";
import { isSuperAdmin, getImpersonatedOrganisationId } from "$lib/server/super-admin";

export const load: LayoutServerLoad = async ({ locals, params, cookies, url }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw redirect(302, "/login");
	}

	const { organisationSlug } = params;

	// Get organisation by slug
	const [organisation] = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			logoUrl: organisations.logoUrl,
			logoAvatarUrl: organisations.logoAvatarUrl,
			primaryColor: organisations.primaryColor,
			secondaryColor: organisations.secondaryColor,
			accentColor: organisations.accentColor,
			status: organisations.status,
			deletedAt: organisations.deletedAt,
		})
		.from(organisations)
		.where(eq(organisations.slug, organisationSlug))
		.limit(1);

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	if (organisation.deletedAt) {
		throw error(410, "This organisation has been deleted");
	}

	if (organisation.status !== "active") {
		throw error(403, "This organisation is currently suspended");
	}

	// Check if user is super admin and impersonating this organisation
	const userAccess = locals.user?.access ?? 0;
	const isUserSuperAdmin = isSuperAdmin(userAccess);
	const impersonatedOrganisationId = getImpersonatedOrganisationId();
	const isImpersonating = isUserSuperAdmin && impersonatedOrganisationId === organisation.id;

	// Verify user has access to this organisation (or is super admin impersonating)
	const [membership] = await db
		.select({
			id: organisationMemberships.id,
			role: organisationMemberships.role,
			status: organisationMemberships.status,
			displayName: organisationMemberships.displayName,
		})
		.from(organisationMemberships)
		.where(
			and(
				eq(organisationMemberships.userId, userId),
				eq(organisationMemberships.organisationId, organisation.id),
				eq(organisationMemberships.status, "active"),
			),
		)
		.limit(1);

	// Allow access if user has membership OR is super admin impersonating
	if (!membership && !isImpersonating) {
		throw error(403, "You do not have access to this organisation");
	}

	// For super admin impersonation, create virtual owner membership
	const effectiveMembership = membership || {
		id: "virtual",
		role: "owner" as const,
		status: "active" as const,
		displayName: "Super Admin",
	};

	// Onboarding redirect for owners who haven't completed setup
	if (effectiveMembership.role === "owner") {
		const currentPath = url.pathname;
		const isExemptRoute =
			currentPath.includes("/onboarding") ||
			currentPath.includes("/settings") ||
			currentPath.startsWith("/api");

		if (!isExemptRoute) {
			const [onboardingProfile] = await db
				.select({ onboardingCompletedAt: organisationProfiles.onboardingCompletedAt })
				.from(organisationProfiles)
				.where(eq(organisationProfiles.organisationId, organisation.id))
				.limit(1);

			// Redirect to onboarding if not completed (null or no profile)
			if (!onboardingProfile?.onboardingCompletedAt) {
				throw redirect(302, `/${organisation.slug}/onboarding`);
			}
		}
	}

	// Set the current organisation cookie
	cookies.set("current_organisation_id", organisation.id, {
		path: "/",
		httpOnly: true,
		secure: process.env["NODE_ENV"] === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});

	// Load form options for this organisation
	const options = await db
		.select({
			category: organisationFormOptions.category,
			value: organisationFormOptions.value,
			label: organisationFormOptions.label,
			isDefault: organisationFormOptions.isDefault,
			sortOrder: organisationFormOptions.sortOrder,
			metadata: organisationFormOptions.metadata,
		})
		.from(organisationFormOptions)
		.where(and(eq(organisationFormOptions.organisationId, organisation.id), eq(organisationFormOptions.isActive, true)))
		.orderBy(asc(organisationFormOptions.category), asc(organisationFormOptions.sortOrder));

	// Group by category and merge with defaults
	const grouped = groupOptionsByCategory(
		options.map((opt) => ({
			...opt,
			metadata: opt.metadata as Record<string, unknown>,
		})),
	);
	const organisationConfig: OrganisationConfig = mergeWithDefaults(grouped);

	// Get user's default organisation for comparison
	const [user] = await db
		.select({ defaultOrganisationId: users.defaultOrganisationId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	// Get all organisations the user belongs to (for the organisation switcher)
	const userOrganisations = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			logoUrl: organisations.logoUrl,
			logoAvatarUrl: organisations.logoAvatarUrl,
			primaryColor: organisations.primaryColor,
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

	return {
		organisation: {
			id: organisation.id,
			name: organisation.name,
			slug: organisation.slug,
			logoUrl: organisation.logoUrl,
			logoAvatarUrl: organisation.logoAvatarUrl,
			primaryColor: organisation.primaryColor,
			secondaryColor: organisation.secondaryColor,
			accentColor: organisation.accentColor,
		},
		membership: {
			id: effectiveMembership.id,
			userId,
			role: effectiveMembership.role as "owner" | "admin" | "member",
			displayName: effectiveMembership.displayName,
		},
		organisationConfig,
		isDefaultOrganisation: user?.defaultOrganisationId === organisation.id,
		userOrganisations: userOrganisations.map((a) => ({
			...a,
			role: a.role as "owner" | "admin" | "member",
		})),
		isSuperAdmin: isUserSuperAdmin,
		isImpersonating,
	};
};
