/**
 * Beta Invites Remote Functions
 *
 * Remote functions for managing beta tester invitations.
 * Super-admin functions require super admin access.
 * Token validation is public (no auth required).
 */

import { query, command } from "$app/server";
import { env } from "$env/dynamic/public";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { betaInvites, users } from "$lib/server/schema";
import { eq, desc, and, like, count } from "drizzle-orm";
import { requireSuperAdmin } from "$lib/server/super-admin";
import { sendEmail } from "$lib/server/services/email.service";
import { generateBetaInviteEmail } from "$lib/templates/email-templates";
import { error } from "@sveltejs/kit";

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateBetaInviteSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	notes: v.optional(v.string()),
});

const BetaInvitesFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		status: v.optional(v.picklist(["pending", "used", "expired", "revoked"])),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the base URL for invite links
 */
function getPublicBaseUrl(): string {
	return env.PUBLIC_CLIENT_URL || "https://app.leaplearn.au";
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
	return crypto.randomUUID();
}

/**
 * Calculate expiry date (30 days from now)
 */
function calculateExpiryDate(): Date {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 30);
	return expiresAt;
}

// =============================================================================
// Super-Admin Functions
// =============================================================================

/**
 * Create a new beta invite and send email
 */
export const createBetaInvite = command(CreateBetaInviteSchema, async (data) => {
	const { userId } = await requireSuperAdmin();

	const { email, notes } = data;

	// Check if there's already a pending invite for this email
	const [existingInvite] = await db
		.select({ id: betaInvites.id, status: betaInvites.status })
		.from(betaInvites)
		.where(and(eq(betaInvites.email, email.toLowerCase()), eq(betaInvites.status, "pending")))
		.limit(1);

	if (existingInvite) {
		throw error(
			400,
			"A pending invite already exists for this email. Revoke it first to create a new one.",
		);
	}

	// Generate token and expiry
	const token = generateToken();
	const expiresAt = calculateExpiryDate();

	// Insert the invite
	const [invite] = await db
		.insert(betaInvites)
		.values({
			email: email.toLowerCase(),
			token,
			status: "pending",
			createdBy: userId,
			expiresAt,
			notes: notes || null,
		})
		.returning();

	if (!invite) {
		throw error(500, "Failed to create invite");
	}

	// Build invite URL
	const inviteUrl = `${getPublicBaseUrl()}/invite/${token}`;

	// Generate and send email
	const emailContent = generateBetaInviteEmail({ inviteUrl, expiresAt });

	await sendEmail({
		to: email,
		subject: emailContent.subject,
		html: emailContent.bodyHtml,
	});

	return {
		id: invite.id,
		email: invite.email,
		token: invite.token,
		expiresAt: invite.expiresAt,
		createdAt: invite.createdAt,
	};
});

/**
 * Get all beta invites with optional filters
 */
export const getBetaInvites = query(BetaInvitesFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, status, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (status) {
		conditions.push(eq(betaInvites.status, status));
	}

	if (search) {
		conditions.push(like(betaInvites.email, `%${search}%`));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get invites with creator info
	const invites = await db
		.select({
			id: betaInvites.id,
			email: betaInvites.email,
			token: betaInvites.token,
			status: betaInvites.status,
			createdAt: betaInvites.createdAt,
			expiresAt: betaInvites.expiresAt,
			usedAt: betaInvites.usedAt,
			usedByOrganisationId: betaInvites.usedByOrganisationId,
			notes: betaInvites.notes,
			createdByEmail: users.email,
		})
		.from(betaInvites)
		.leftJoin(users, eq(betaInvites.createdBy, users.id))
		.where(whereClause)
		.orderBy(desc(betaInvites.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count
	const [countResult] = await db.select({ total: count() }).from(betaInvites).where(whereClause);

	// Calculate stats from all invites
	const allInvites = await db.select({ status: betaInvites.status }).from(betaInvites);
	const now = new Date();
	const statsCounts = {
		pending: 0,
		used: 0,
		expired: 0,
		revoked: 0,
	};

	for (const inv of allInvites) {
		if (inv.status === "pending") statsCounts.pending++;
		else if (inv.status === "used") statsCounts.used++;
		else if (inv.status === "expired") statsCounts.expired++;
		else if (inv.status === "revoked") statsCounts.revoked++;
	}

	return {
		invites: invites.map((inv) => ({
			...inv,
			// Check if invite is actually expired (status might not be updated)
			isExpired: inv.status === "pending" && inv.expiresAt && new Date(inv.expiresAt) < now,
		})),
		total: countResult?.total ?? 0,
		stats: statsCounts,
	};
});

/**
 * Revoke a pending invite
 */
export const revokeBetaInvite = command(v.pipe(v.string(), v.uuid()), async (inviteId) => {
	await requireSuperAdmin();

	const [invite] = await db
		.select({ id: betaInvites.id, status: betaInvites.status })
		.from(betaInvites)
		.where(eq(betaInvites.id, inviteId))
		.limit(1);

	if (!invite) {
		throw error(404, "Invite not found");
	}

	if (invite.status !== "pending") {
		throw error(400, `Cannot revoke invite with status: ${invite.status}`);
	}

	await db.update(betaInvites).set({ status: "revoked" }).where(eq(betaInvites.id, inviteId));

	return { success: true };
});

/**
 * Resend invite email for a pending invite
 */
export const resendBetaInvite = command(v.pipe(v.string(), v.uuid()), async (inviteId) => {
	await requireSuperAdmin();

	const [invite] = await db.select().from(betaInvites).where(eq(betaInvites.id, inviteId)).limit(1);

	if (!invite) {
		throw error(404, "Invite not found");
	}

	if (invite.status !== "pending") {
		throw error(400, `Cannot resend invite with status: ${invite.status}`);
	}

	// Check if expired
	if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
		throw error(400, "Invite has expired. Create a new invite instead.");
	}

	// Build invite URL
	const inviteUrl = `${getPublicBaseUrl()}/invite/${invite.token}`;

	// Generate and send email
	const emailContent = generateBetaInviteEmail({ inviteUrl, expiresAt: invite.expiresAt });

	await sendEmail({
		to: invite.email,
		subject: emailContent.subject,
		html: emailContent.bodyHtml,
	});

	return { success: true };
});

// =============================================================================
// Public Functions (No Auth Required)
// =============================================================================

/**
 * Validate an invite token
 * This is called by the invite page to check if token is valid
 */
export const validateInviteToken = query(v.string(), async (token) => {
	const [invite] = await db
		.select({
			id: betaInvites.id,
			email: betaInvites.email,
			status: betaInvites.status,
			expiresAt: betaInvites.expiresAt,
		})
		.from(betaInvites)
		.where(eq(betaInvites.token, token))
		.limit(1);

	if (!invite) {
		return { valid: false, reason: "Invalid invite token" };
	}

	if (invite.status === "used") {
		return { valid: false, reason: "This invite has already been used" };
	}

	if (invite.status === "revoked") {
		return { valid: false, reason: "This invite is no longer valid" };
	}

	if (invite.status === "expired") {
		return { valid: false, reason: "This invite has expired" };
	}

	// Check if expired by date
	if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
		// Update status to expired
		await db.update(betaInvites).set({ status: "expired" }).where(eq(betaInvites.id, invite.id));

		return { valid: false, reason: "This invite has expired" };
	}

	return { valid: true, email: invite.email };
});

/**
 * Get invite details by token (for displaying on invite page)
 * Returns minimal info for public display
 */
export const getInviteByToken = query(v.string(), async (token) => {
	const [invite] = await db
		.select({
			email: betaInvites.email,
			status: betaInvites.status,
			expiresAt: betaInvites.expiresAt,
		})
		.from(betaInvites)
		.where(eq(betaInvites.token, token))
		.limit(1);

	if (!invite) {
		return null;
	}

	// Check if expired
	const isExpired =
		invite.status === "pending" && invite.expiresAt && new Date(invite.expiresAt) < new Date();

	return {
		email: invite.email,
		status: isExpired ? "expired" : invite.status,
		expiresAt: invite.expiresAt,
	};
});
