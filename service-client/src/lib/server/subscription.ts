/**
 * Subscription Tier Enforcement
 *
 * Defines subscription tiers and their limits.
 * Provides functions to check and enforce limits.
 *
 * IMPORTANT: Limits should be enforced in the service layer,
 * not just in the UI, to prevent bypass.
 */

import { db } from "$lib/server/db";
import { organisations, organisationMemberships } from "$lib/server/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getOrganisationContext } from "$lib/server/organisation";
import { formatDate } from "$lib/utils/formatting";

// =============================================================================
// Tier Definitions
// =============================================================================

export type SubscriptionTier = "free" | "starter" | "growth" | "enterprise";

export interface TierLimits {
	maxMembers: number; // -1 = unlimited
	maxAIGenerationsPerMonth: number; // -1 = unlimited
	maxTemplates: number; // -1 = unlimited
	maxStorageMB: number; // -1 = unlimited
	features: TierFeature[];
}

export type TierFeature =
	| "custom_branding"
	| "analytics"
	| "white_label"
	| "api_access"
	| "priority_support"
	| "custom_domain"
	| "sso"
	| "ai_proposal_generation"
	| "seo_audits"
	| "backlink_analysis";

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierLimits> = {
	free: {
		maxMembers: 1,
		maxAIGenerationsPerMonth: 5,
		maxTemplates: 3,
		maxStorageMB: 100,
		features: ["ai_proposal_generation"],
	},
	starter: {
		maxMembers: 3,
		maxAIGenerationsPerMonth: 25,
		maxTemplates: 5,
		maxStorageMB: 1024, // 1GB
		features: ["ai_proposal_generation"],
	},
	growth: {
		maxMembers: 10,
		maxAIGenerationsPerMonth: 100,
		maxTemplates: 20,
		maxStorageMB: 10240, // 10GB
		features: [
			"custom_branding",
			"analytics",
			"white_label",
			"api_access",
			"ai_proposal_generation",
		],
	},
	enterprise: {
		maxMembers: -1,
		maxAIGenerationsPerMonth: -1,
		maxTemplates: -1,
		maxStorageMB: -1,
		features: [
			"custom_branding",
			"analytics",
			"white_label",
			"api_access",
			"priority_support",
			"custom_domain",
			"sso",
			"ai_proposal_generation",
		],
	},
};

// =============================================================================
// Freemium Support
// =============================================================================

/**
 * Get the effective tier for an organisation, considering freemium status.
 * Freemium users get enterprise-level access regardless of actual subscription.
 */
export async function getEffectiveTier(organisationId: string): Promise<SubscriptionTier> {
	const [organisation] = await db
		.select({
			subscriptionTier: organisations.subscriptionTier,
			isFreemium: organisations.isFreemium,
			freemiumExpiresAt: organisations.freemiumExpiresAt,
		})
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) return "free";

	// Check freemium status
	if (organisation.isFreemium) {
		// Check if expired (null = no expiry)
		if (organisation.freemiumExpiresAt && new Date() > organisation.freemiumExpiresAt) {
			// Freemium expired, fall back to actual tier
			return (organisation.subscriptionTier as SubscriptionTier) || "free";
		}
		// Active freemium - grant enterprise access
		return "enterprise";
	}

	return (organisation.subscriptionTier as SubscriptionTier) || "free";
}

// =============================================================================
// Tier Information Functions
// =============================================================================

/**
 * Get the tier limits for a specific tier.
 */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
	return TIER_DEFINITIONS[tier] || TIER_DEFINITIONS.free;
}

/**
 * Get the current organisation's tier and limits.
 * Respects freemium status - freemium users get enterprise limits.
 */
export async function getOrganisationTierLimits(): Promise<{
	tier: SubscriptionTier;
	limits: TierLimits;
}> {
	const context = await getOrganisationContext();

	// Use getEffectiveTier to respect freemium status
	const tier = await getEffectiveTier(context.organisationId);
	return { tier, limits: getTierLimits(tier) };
}

/**
 * Check if a feature is available for a tier.
 */
export function tierHasFeature(tier: SubscriptionTier, feature: TierFeature): boolean {
	const limits = getTierLimits(tier);
	return limits.features.includes(feature);
}

// =============================================================================
// Limit Checking Functions
// =============================================================================

/**
 * Get current member count for an organisation.
 */
export async function getMemberCount(organisationId: string): Promise<number> {
	const [result] = await db
		.select({ count: count() })
		.from(organisationMemberships)
		.where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.status, "active")));

	return result?.count ?? 0;
}


/**
 * Check if organisation can add more members.
 */
export async function canAddMember(organisationId?: string): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
}> {
	const context = await getOrganisationContext();
	const targetOrganisationId = organisationId || context.organisationId;

	const { limits } = await getOrganisationTierLimits();
	const currentCount = await getMemberCount(targetOrganisationId);

	if (limits.maxMembers === -1) {
		return { allowed: true, current: currentCount, limit: -1, unlimited: true };
	}

	return {
		allowed: currentCount < limits.maxMembers,
		current: currentCount,
		limit: limits.maxMembers,
		unlimited: false,
	};
}


/**
 * Get AI generation count for current month.
 * Uses the aiGenerationsThisMonth counter on the organisations table.
 */
export async function getMonthlyAIGenerationCount(organisationId: string): Promise<number> {
	const [organisation] = await db
		.select({
			aiGenerationsThisMonth: organisations.aiGenerationsThisMonth,
			aiGenerationsResetAt: organisations.aiGenerationsResetAt,
		})
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) return 0;

	// Check if counter needs to be reset (new month)
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	if (!organisation.aiGenerationsResetAt || organisation.aiGenerationsResetAt < startOfMonth) {
		// Reset counter for new month
		await db
			.update(organisations)
			.set({
				aiGenerationsThisMonth: 0,
				aiGenerationsResetAt: now,
			})
			.where(eq(organisations.id, organisationId));
		return 0;
	}

	return organisation.aiGenerationsThisMonth ?? 0;
}

/**
 * Check if organisation can generate more AI proposals this month.
 */
export async function canGenerateWithAI(organisationId?: string): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
	resetsAt: Date;
}> {
	const context = await getOrganisationContext();
	const targetOrganisationId = organisationId || context.organisationId;

	const { limits } = await getOrganisationTierLimits();
	const currentCount = await getMonthlyAIGenerationCount(targetOrganisationId);

	// Calculate when limit resets (start of next month)
	const resetsAt = new Date();
	resetsAt.setMonth(resetsAt.getMonth() + 1);
	resetsAt.setDate(1);
	resetsAt.setHours(0, 0, 0, 0);

	if (limits.maxAIGenerationsPerMonth === -1) {
		return { allowed: true, current: currentCount, limit: -1, unlimited: true, resetsAt };
	}

	return {
		allowed: currentCount < limits.maxAIGenerationsPerMonth,
		current: currentCount,
		limit: limits.maxAIGenerationsPerMonth,
		unlimited: false,
		resetsAt,
	};
}

/**
 * Increment AI generation counter for an organisation.
 * Call this after a successful AI generation.
 * Uses atomic SQL to prevent race conditions with concurrent requests.
 */
export async function incrementAIGenerationCount(organisationId: string): Promise<void> {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	await db.execute(sql`
		UPDATE organisations
		SET ai_generations_this_month = CASE
			WHEN ai_generations_reset_at IS NULL OR ai_generations_reset_at < ${startOfMonth}
			THEN 1
			ELSE ai_generations_this_month + 1
		END,
		ai_generations_reset_at = CASE
			WHEN ai_generations_reset_at IS NULL OR ai_generations_reset_at < ${startOfMonth}
			THEN ${now}
			ELSE ai_generations_reset_at
		END
		WHERE id = ${organisationId}
	`);
}


// =============================================================================
// Limit Enforcement Functions (Throws on Violation)
// =============================================================================

/**
 * Enforce member limit - throws if limit exceeded.
 */
export async function enforceMemberLimit(organisationId?: string): Promise<void> {
	const result = await canAddMember(organisationId);

	if (!result.allowed) {
		throw error(
			403,
			`Member limit reached (${result.current}/${result.limit}). Upgrade your plan to add more members.`,
		);
	}
}


/**
 * Enforce AI generation limit - throws if limit exceeded.
 */
export async function enforceAIGenerationLimit(organisationId?: string): Promise<void> {
	const result = await canGenerateWithAI(organisationId);

	if (!result.allowed) {
		throw error(
			403,
			`Monthly AI generation limit reached (${result.current}/${result.limit}). ` +
				`Limit resets on ${formatDate(result.resetsAt)}. ` +
				`Upgrade your plan for more AI generations.`,
		);
	}
}

/**
 * Require a specific feature - throws if not available.
 */
export async function requireFeature(feature: TierFeature): Promise<void> {
	const { tier, limits } = await getOrganisationTierLimits();

	if (!limits.features.includes(feature)) {
		throw error(
			403,
			`The "${feature}" feature is not available on the ${tier} plan. Please upgrade to access this feature.`,
		);
	}
}

/**
 * Check if current organisation has a feature.
 * Returns false instead of throwing.
 */
export async function hasFeature(feature: TierFeature): Promise<boolean> {
	const { limits } = await getOrganisationTierLimits();
	return limits.features.includes(feature);
}

// =============================================================================
// Usage Statistics
// =============================================================================

/**
 * Get comprehensive usage statistics for an organisation.
 */
export async function getOrganisationUsageStats(organisationId?: string): Promise<{
	tier: SubscriptionTier;
	limits: TierLimits;
	usage: {
		members: { current: number; limit: number; percentage: number };
		aiGenerationsThisMonth: { current: number; limit: number; percentage: number };
	};
}> {
	const context = await getOrganisationContext();
	const targetOrganisationId = organisationId || context.organisationId;

	const { tier, limits } = await getOrganisationTierLimits();
	const memberCount = await getMemberCount(targetOrganisationId);
	const aiGenerationCount = await getMonthlyAIGenerationCount(targetOrganisationId);

	const memberPercentage =
		limits.maxMembers === -1 ? 0 : Math.round((memberCount / limits.maxMembers) * 100);

	const aiGenerationPercentage =
		limits.maxAIGenerationsPerMonth === -1
			? 0
			: Math.round((aiGenerationCount / limits.maxAIGenerationsPerMonth) * 100);

	return {
		tier,
		limits,
		usage: {
			members: {
				current: memberCount,
				limit: limits.maxMembers,
				percentage: memberPercentage,
			},
			aiGenerationsThisMonth: {
				current: aiGenerationCount,
				limit: limits.maxAIGenerationsPerMonth,
				percentage: aiGenerationPercentage,
			},
		},
	};
}

// =============================================================================
// Tier Comparison (for upgrade prompts)
// =============================================================================

/**
 * Get comparison between current tier and available upgrades.
 */
export function getTierComparison(currentTier: SubscriptionTier): Array<{
	tier: SubscriptionTier;
	name: string;
	limits: TierLimits;
	isCurrentTier: boolean;
	isUpgrade: boolean;
}> {
	const tierOrder: SubscriptionTier[] = ["free", "starter", "growth", "enterprise"];
	const currentIndex = tierOrder.indexOf(currentTier);

	return tierOrder.map((tier, index) => ({
		tier,
		name: tier.charAt(0).toUpperCase() + tier.slice(1),
		limits: TIER_DEFINITIONS[tier],
		isCurrentTier: tier === currentTier,
		isUpgrade: index > currentIndex,
	}));
}

/**
 * Get the next tier up from current tier.
 */
export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
	const tierOrder: SubscriptionTier[] = ["free", "starter", "growth", "enterprise"];
	const currentIndex = tierOrder.indexOf(currentTier);

	if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
		return null;
	}

	return tierOrder[currentIndex + 1] ?? null;
}
