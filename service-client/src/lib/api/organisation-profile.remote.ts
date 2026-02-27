/**
 * Organisation Profile Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for organisation profile operations.
 * Handles business registration, address, banking, tax, and branding.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	organisationProfiles,
	organisations,
} from "$lib/server/schema";
import { requireOrganisationRole, getOrganisationContext } from "$lib/server/organisation";
import { logActivity } from "$lib/server/db-helpers";
import { encrypt, decryptProfileFields } from "$lib/server/crypto";
import { eq } from "drizzle-orm";

// =============================================================================
// Validation Schemas
// =============================================================================

const UpdateProfileSchema = v.object({
	// Business Registration
	abn: v.optional(v.pipe(v.string(), v.maxLength(20))),
	acn: v.optional(v.pipe(v.string(), v.maxLength(20))),
	legalEntityName: v.optional(v.pipe(v.string(), v.maxLength(255))),
	tradingName: v.optional(v.pipe(v.string(), v.maxLength(255))),

	// Address
	addressLine1: v.optional(v.pipe(v.string(), v.maxLength(255))),
	addressLine2: v.optional(v.pipe(v.string(), v.maxLength(255))),
	city: v.optional(v.pipe(v.string(), v.maxLength(100))),
	state: v.optional(v.pipe(v.string(), v.maxLength(50))),
	postcode: v.optional(v.pipe(v.string(), v.maxLength(20))),
	country: v.optional(v.pipe(v.string(), v.maxLength(100))),

	// Banking
	bankName: v.optional(v.pipe(v.string(), v.maxLength(100))),
	bsb: v.optional(
		v.pipe(v.string(), v.regex(/^(\d{3}-?\d{3})?$/, "BSB must be 6 digits (e.g., 123-456)")),
	),
	accountNumber: v.optional(v.pipe(v.string(), v.maxLength(30))),
	accountName: v.optional(v.pipe(v.string(), v.maxLength(255))),

	// Tax & GST
	gstRegistered: v.optional(v.boolean()),
	taxFileNumber: v.optional(v.pipe(v.string(), v.maxLength(20))),
	gstRate: v.optional(
		v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/, "GST rate must be a decimal number")),
	),

	// Social & Branding
	tagline: v.optional(v.string()),
	socialLinkedin: v.optional(v.string()),
	socialFacebook: v.optional(v.string()),
	socialInstagram: v.optional(v.string()),
	socialTwitter: v.optional(v.string()),
	brandFont: v.optional(v.pipe(v.string(), v.maxLength(100))),

	// Payment Terms
	defaultPaymentTerms: v.optional(v.picklist(["DUE_ON_RECEIPT", "NET_7", "NET_14", "NET_30"])),
});

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get the organisation profile for the current organisation.
 * Returns null for profile if one doesn't exist - use ensureOrganisationProfile() to create.
 */
export const getOrganisationProfile = query(async () => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Try to get existing profile
	const [profile] = await db
		.select()
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, context.organisationId))
		.limit(1);

	// Also get organisation info for merged data
	const [organisation] = await db
		.select({
			name: organisations.name,
			email: organisations.email,
			phone: organisations.phone,
			website: organisations.website,
			logoUrl: organisations.logoUrl,
			logoAvatarUrl: organisations.logoAvatarUrl,
			primaryColor: organisations.primaryColor,
			secondaryColor: organisations.secondaryColor,
			accentColor: organisations.accentColor,
			accentGradient: organisations.accentGradient,
		})
		.from(organisations)
		.where(eq(organisations.id, context.organisationId))
		.limit(1);

	return {
		profile: profile ? decryptProfileFields(profile) : null,
		organisation,
	};
});

/**
 * Get just the profile data (for forms that don't need organisation data).
 * Returns null if no profile exists.
 */
export const getOrganisationProfileOnly = query(async () => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	const [profile] = await db
		.select()
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, context.organisationId))
		.limit(1);

	return profile ? decryptProfileFields(profile) : null;
});

/**
 * Ensure an organisation profile exists (creates if missing).
 * Call this before editing profile data.
 */
export const ensureOrganisationProfile = command(v.object({}), async () => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Check if profile exists
	const [existing] = await db
		.select({ id: organisationProfiles.id })
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, context.organisationId))
		.limit(1);

	if (existing) {
		return existing;
	}

	// Create new profile
	const [profile] = await db
		.insert(organisationProfiles)
		.values({ organisationId: context.organisationId })
		.returning();

	await logActivity("profile.created", "organisation_profile", profile?.id, {});

	return profile;
});

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Update the organisation profile (admin/owner only).
 * Creates a profile if one doesn't exist.
 */
export const updateOrganisationProfile = command(UpdateProfileSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Check if profile exists
	const [existing] = await db
		.select({ id: organisationProfiles.id })
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, context.organisationId))
		.limit(1);

	// Build update object with only provided fields
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	// Business Registration
	if (data.abn !== undefined) updates["abn"] = data.abn;
	if (data.acn !== undefined) updates["acn"] = data.acn;
	if (data.legalEntityName !== undefined) updates["legalEntityName"] = data.legalEntityName;
	if (data.tradingName !== undefined) updates["tradingName"] = data.tradingName;

	// Address
	if (data.addressLine1 !== undefined) updates["addressLine1"] = data.addressLine1;
	if (data.addressLine2 !== undefined) updates["addressLine2"] = data.addressLine2;
	if (data.city !== undefined) updates["city"] = data.city;
	if (data.state !== undefined) updates["state"] = data.state;
	if (data.postcode !== undefined) updates["postcode"] = data.postcode;
	if (data.country !== undefined) updates["country"] = data.country;

	// Banking — encrypt sensitive fields
	if (data.bankName !== undefined) updates["bankName"] = data.bankName;
	if (data.bsb !== undefined) updates["bsb"] = encrypt(data.bsb);
	if (data.accountNumber !== undefined) updates["accountNumber"] = encrypt(data.accountNumber);
	if (data.accountName !== undefined) updates["accountName"] = data.accountName;

	// Tax & GST
	if (data.gstRegistered !== undefined) updates["gstRegistered"] = data.gstRegistered;
	if (data.taxFileNumber !== undefined) updates["taxFileNumber"] = encrypt(data.taxFileNumber);
	if (data.gstRate !== undefined) updates["gstRate"] = data.gstRate;

	// Social & Branding
	if (data.tagline !== undefined) updates["tagline"] = data.tagline;
	if (data.socialLinkedin !== undefined) updates["socialLinkedin"] = data.socialLinkedin;
	if (data.socialFacebook !== undefined) updates["socialFacebook"] = data.socialFacebook;
	if (data.socialInstagram !== undefined) updates["socialInstagram"] = data.socialInstagram;
	if (data.socialTwitter !== undefined) updates["socialTwitter"] = data.socialTwitter;
	if (data.brandFont !== undefined) updates["brandFont"] = data.brandFont;

	// Payment Terms
	if (data.defaultPaymentTerms !== undefined)
		updates["defaultPaymentTerms"] = data.defaultPaymentTerms;

	let profile;
	if (existing) {
		// Update existing profile
		[profile] = await db
			.update(organisationProfiles)
			.set(updates)
			.where(eq(organisationProfiles.organisationId, context.organisationId))
			.returning();
	} else {
		// Create new profile with provided data
		[profile] = await db
			.insert(organisationProfiles)
			.values({
				organisationId: context.organisationId,
				...updates,
			})
			.returning();
	}

	// Log activity
	await logActivity("profile.updated", "organisation_profile", profile?.id, {
		newValues: updates,
	});

	return profile;
});

// =============================================================================
// Setup Status Query
// =============================================================================

import type { SetupChecklistItem } from "./organisation-profile.types";

/**
 * Get the organisation setup checklist status.
 * Returns a list of setup items with their completion status.
 */
export const getSetupChecklist = query(async () => {
	const context = await getOrganisationContext();
	const organisationId = context.organisationId;

	// Get organisation with branding info
	const [organisation] = await db
		.select({
			logoUrl: organisations.logoUrl,
			primaryColor: organisations.primaryColor,
			email: organisations.email,
			phone: organisations.phone,
		})
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	// Get profile
	const [profile] = await db
		.select()
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, organisationId))
		.limit(1);

	// Check profile completeness
	const hasBusinessInfo = !!(profile?.tradingName || profile?.legalEntityName);
	const hasAddress = !!(profile?.addressLine1 && profile?.city && profile?.postcode);
	const hasBanking = !!(profile?.bankName && profile?.bsb && profile?.accountNumber);
	const hasContact = !!(organisation?.email || organisation?.phone);
	const hasLogo = !!organisation?.logoUrl;

	const checklist: SetupChecklistItem[] = [
		{
			id: "profile",
			label: "Business Details",
			description: "Trading name, ABN, and legal entity",
			status: hasBusinessInfo ? "complete" : "incomplete",
			required: true,
			link: "profile",
		},
		{
			id: "contact",
			label: "Contact Information",
			description: "Email and phone number",
			status: hasContact ? "complete" : "incomplete",
			required: true,
			link: "profile",
		},
		{
			id: "address",
			label: "Business Address",
			description: "Organisation street address",
			status: hasAddress ? "complete" : "incomplete",
			required: true,
			link: "profile",
		},
		{
			id: "branding",
			label: "Organisation Logo",
			description: "Logo for your learning platform",
			status: hasLogo ? "complete" : "incomplete",
			required: false,
			link: "branding",
		},
		{
			id: "banking",
			label: "Banking Details",
			description: "Bank account for payments",
			status: hasBanking ? "complete" : "incomplete",
			required: true,
			link: "profile",
		},
	];

	// Calculate completion percentage (required items only)
	const requiredItems = checklist.filter((item) => item.required);
	const completedRequired = requiredItems.filter((item) => item.status === "complete");
	const completionPercent = Math.round((completedRequired.length / requiredItems.length) * 100);

	return {
		items: checklist,
		completionPercent,
		totalRequired: requiredItems.length,
		completedRequired: completedRequired.length,
		isReady: completedRequired.length === requiredItems.length,
	};
});

/**
 * Mark onboarding as complete for the current organisation.
 */
export const markOnboardingComplete = command(v.object({}), async () => {
	const context = await requireOrganisationRole(["owner"]);

	// Ensure profile exists
	const [existing] = await db
		.select({ id: organisationProfiles.id })
		.from(organisationProfiles)
		.where(eq(organisationProfiles.organisationId, context.organisationId))
		.limit(1);

	if (!existing) {
		await db
			.insert(organisationProfiles)
			.values({ organisationId: context.organisationId, onboardingCompletedAt: new Date() });
	} else {
		await db
			.update(organisationProfiles)
			.set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
			.where(eq(organisationProfiles.organisationId, context.organisationId));
	}

	await logActivity("organisation.onboarding_completed", "organisation", context.organisationId, {});

	return { success: true };
});
