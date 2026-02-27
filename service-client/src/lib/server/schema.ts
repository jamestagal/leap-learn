/**
 * Drizzle Schema for Remote Functions
 *
 * Mirrors the Go backend PostgreSQL schema exactly.
 * Used by remote functions for direct database access.
 */

import {
	pgTable,
	uuid,
	text,
	timestamp,
	integer,
	varchar,
	jsonb,
	boolean,
	bigint,
	unique,
	index,
} from "drizzle-orm/pg-core";
import type { RawFormSchema } from "$lib/types/form-builder";

// =============================================================================
// USER TABLE
// =============================================================================

// Users table (referenced by organisations)
export const users = pgTable("users", {
	id: uuid("id").primaryKey(),
	created: timestamp("created", { withTimezone: true }).notNull().defaultNow(),
	updated: timestamp("updated", { withTimezone: true }).notNull().defaultNow(),
	email: text("email").notNull(),
	phone: text("phone").notNull().default(""),
	access: bigint("access", { mode: "number" }).notNull(),
	sub: text("sub").notNull(),
	avatar: text("avatar").notNull().default(""),
	customerId: text("customer_id").notNull().default(""),
	subscriptionId: text("subscription_id").notNull().default(""),
	subscriptionEnd: timestamp("subscription_end", { withTimezone: true })
		.notNull()
		.default(new Date("2000-01-01")),
	apiKey: text("api_key").notNull().default(""),
	defaultOrganisationId: uuid("default_organisation_id"),
	// Suspension (super-admin controlled)
	suspended: boolean("suspended").notNull().default(false),
	suspendedAt: timestamp("suspended_at", { withTimezone: true }),
	suspendedReason: text("suspended_reason"),
});

// =============================================================================
// ORGANISATION / MULTI-TENANCY TABLES
// =============================================================================

// Organisations table - Core tenant table
export const organisations = pgTable("organisations", {
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

	// Basic Information
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),

	// Branding
	logoUrl: text("logo_url").notNull().default(""),
	logoAvatarUrl: text("logo_avatar_url").notNull().default(""),
	primaryColor: text("primary_color").notNull().default("#4F46E5"),
	secondaryColor: text("secondary_color").notNull().default("#1E40AF"),
	accentColor: text("accent_color").notNull().default("#F59E0B"),
	accentGradient: text("accent_gradient").notNull().default(""),

	// Contact
	email: text("email").notNull().default(""),
	phone: text("phone").notNull().default(""),
	website: text("website").notNull().default(""),

	// Status & Billing
	status: varchar("status", { length: 50 }).notNull().default("active"),
	subscriptionTier: varchar("subscription_tier", { length: 50 }).notNull().default("free"),
	subscriptionId: text("subscription_id").notNull().default(""),
	subscriptionEnd: timestamp("subscription_end", { withTimezone: true }),
	stripeCustomerId: text("stripe_customer_id").notNull().default(""),

	// AI Generation Rate Limiting
	aiGenerationsThisMonth: integer("ai_generations_this_month").notNull().default(0),
	aiGenerationsResetAt: timestamp("ai_generations_reset_at", { withTimezone: true }),

	// Freemium access (beta/partner programs)
	isFreemium: boolean("is_freemium").notNull().default(false),
	freemiumReason: varchar("freemium_reason", { length: 50 }),
	freemiumExpiresAt: timestamp("freemium_expires_at", { withTimezone: true }),
	freemiumGrantedAt: timestamp("freemium_granted_at", { withTimezone: true }),
	freemiumGrantedBy: varchar("freemium_granted_by", { length: 255 }),

	// Soft delete (GDPR compliance)
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
});

// Organisation Memberships table - User-Organisation relationships
export const organisationMemberships = pgTable(
	"organisation_memberships",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organisationId: uuid("organisation_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),

		// Role within organisation
		role: varchar("role", { length: 50 }).notNull().default("member"),

		// User-specific settings within organisation
		displayName: text("display_name").notNull().default(""),

		// Status
		status: varchar("status", { length: 50 }).notNull().default("active"),
		invitedAt: timestamp("invited_at", { withTimezone: true }),
		invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
	},
	(table) => ({
		uniqueUserOrganisation: unique().on(table.userId, table.organisationId),
	}),
);

// Organisation Form Options table - Configurable form presets per organisation
export const organisationFormOptions = pgTable(
	"organisation_form_options",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		organisationId: uuid("organisation_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),

		// Option category
		category: varchar("category", { length: 100 }).notNull(),

		// Option details
		value: text("value").notNull(),
		label: text("label").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		isDefault: boolean("is_default").notNull().default(false),
		isActive: boolean("is_active").notNull().default(true),

		// Optional metadata
		metadata: jsonb("metadata").notNull().default({}),
	},
	(table) => ({
		uniqueOrganisationCategoryValue: unique().on(table.organisationId, table.category, table.value),
	}),
);

// =============================================================================
// AUDIT TRAIL & COMPLIANCE
// =============================================================================

// Organisation Activity Log table - Audit trail for compliance
export const organisationActivityLog = pgTable("organisation_activity_log", {
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

	organisationId: uuid("organisation_id")
		.notNull()
		.references(() => organisations.id, { onDelete: "cascade" }),
	userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

	// Action details
	action: varchar("action", { length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: uuid("entity_id"),

	// Change details (for auditing)
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),

	// Request context (for security)
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),

	// Additional metadata
	metadata: jsonb("metadata").notNull().default({}),
});

// =============================================================================
// BETA INVITES (Super-Admin Feature)
// =============================================================================

// Beta Invites table - Manage beta tester invitations
export const betaInvites = pgTable(
	"beta_invites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

		// Invite target
		email: varchar("email", { length: 255 }).notNull(),

		// Token for URL (unique per invite, allows re-inviting same email)
		token: varchar("token", { length: 100 }).notNull().unique(),

		// Status: pending, used, expired, revoked
		status: varchar("status", { length: 20 }).notNull().default("pending"),

		// Who created this invite
		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

		// Usage tracking
		usedAt: timestamp("used_at", { withTimezone: true }),
		usedByOrganisationId: uuid("used_by_organisation_id").references(() => organisations.id, {
			onDelete: "set null",
		}),

		// Expiration (30 days from creation by default)
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

		// Optional notes for admin reference
		notes: text("notes"),
	},
	(table) => ({
		emailIdx: index("beta_invites_email_idx").on(table.email),
		tokenIdx: index("beta_invites_token_idx").on(table.token),
		statusIdx: index("beta_invites_status_idx").on(table.status),
	}),
);

// =============================================================================
// ORGANISATION PROFILE
// =============================================================================

// Organisation Profiles table - Extended business details for documents
export const organisationProfiles = pgTable("organisation_profiles", {
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

	organisationId: uuid("organisation_id")
		.notNull()
		.unique()
		.references(() => organisations.id, { onDelete: "cascade" }),

	// Business Registration
	abn: varchar("abn", { length: 20 }).notNull().default(""),
	acn: varchar("acn", { length: 20 }).notNull().default(""),
	legalEntityName: text("legal_entity_name").notNull().default(""),
	tradingName: text("trading_name").notNull().default(""),

	// Address
	addressLine1: text("address_line_1").notNull().default(""),
	addressLine2: text("address_line_2").notNull().default(""),
	city: varchar("city", { length: 100 }).notNull().default(""),
	state: varchar("state", { length: 50 }).notNull().default(""),
	postcode: varchar("postcode", { length: 20 }).notNull().default(""),
	country: varchar("country", { length: 100 }).notNull().default("Australia"),

	// Banking (for invoice display)
	bankName: varchar("bank_name", { length: 100 }).notNull().default(""),
	bsb: text("bsb").notNull().default(""),
	accountNumber: text("account_number").notNull().default(""),
	accountName: text("account_name").notNull().default(""),

	// Tax & GST
	gstRegistered: boolean("gst_registered").notNull().default(true),
	taxFileNumber: text("tax_file_number").notNull().default(""),

	// Social & Branding
	tagline: text("tagline").notNull().default(""),
	socialLinkedin: text("social_linkedin").notNull().default(""),
	socialFacebook: text("social_facebook").notNull().default(""),
	socialInstagram: text("social_instagram").notNull().default(""),
	socialTwitter: text("social_twitter").notNull().default(""),
	brandFont: varchar("brand_font", { length: 100 }).notNull().default(""),

	// Document Defaults
	defaultPaymentTerms: varchar("default_payment_terms", { length: 50 }).notNull().default("NET_14"),

	// Onboarding
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
});

// =============================================================================
// FORM BUILDER TABLES
// =============================================================================

// Organisation Forms table - Custom form definitions per organisation
export const organisationForms = pgTable(
	"organisation_forms",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organisationId: uuid("organisation_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),

		// Form Identification
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull(),
		description: text("description"),
		formType: varchar("form_type", { length: 50 }).notNull(),

		// Form Schema (Zod-compatible JSON)
		schema: jsonb("schema").$type<RawFormSchema>().notNull(),

		// UI Configuration
		uiConfig: jsonb("ui_config").notNull().default({
			layout: "single-column",
			showProgressBar: true,
			showStepNumbers: true,
			submitButtonText: "Submit",
			successMessage: "Thank you for your submission!",
		}),

		// Branding Overrides (inherits from organisation if null)
		branding: jsonb("branding"),

		// Form Settings
		isActive: boolean("is_active").notNull().default(true),
		isDefault: boolean("is_default").notNull().default(false),
		requiresAuth: boolean("requires_auth").notNull().default(false),

		// Template Tracking
		sourceTemplateId: uuid("source_template_id").references(() => formTemplates.id, { onDelete: "set null" }),
		isCustomized: boolean("is_customized").notNull().default(false),
		previousSchema: jsonb("previous_schema"),

		// Metadata
		version: integer("version").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
	},
	(table) => ({
		uniqueOrganisationSlug: unique().on(table.organisationId, table.slug),
		organisationTypeIdx: index("organisation_forms_organisation_type_idx").on(table.organisationId, table.formType),
		activeIdx: index("organisation_forms_active_idx").on(table.organisationId, table.isActive),
	}),
);

// Clients table - Client information per organisation
export const clients = pgTable(
	"clients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organisationId: uuid("organisation_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),

		// Client Information
		businessName: text("business_name").notNull(),
		email: varchar("email", { length: 255 }).notNull(),
		phone: varchar("phone", { length: 50 }),
		contactName: text("contact_name"),
		notes: text("notes"),
		website: text("website").notNull().default(""),

		// Status: 'active' | 'archived'
		status: varchar("status", { length: 20 }).notNull().default("active"),

		// Metadata
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		uniqueOrganisationEmail: unique().on(table.organisationId, table.email),
		organisationIdx: index("clients_organisation_idx").on(table.organisationId),
		emailIdx: index("clients_email_idx").on(table.email),
		statusIdx: index("clients_status_idx").on(table.organisationId, table.status),
	}),
);

// Form Submissions table - Submitted form data
export const formSubmissions = pgTable(
	"form_submissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		formId: uuid("form_id").references(() => organisationForms.id, { onDelete: "cascade" }),
		organisationId: uuid("organisation_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),

		// Public URL slug for sharing
		slug: varchar("slug", { length: 100 }).unique(),

		// Client linking
		clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
		clientBusinessName: text("client_business_name").notNull().default(""),
		clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),

		// Submission Data (flexible JSONB - matches form schema)
		data: jsonb("data").notNull(),

		// Progress tracking
		currentStep: integer("current_step").notNull().default(0),
		completionPercentage: integer("completion_percentage").notNull().default(0),
		startedAt: timestamp("started_at", { withTimezone: true }),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),

		// Submission Metadata
		metadata: jsonb("metadata").notNull().default({}),

		// Status: draft, completed, processing, processed, archived
		status: varchar("status", { length: 50 }).notNull().default("draft"),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		submittedAt: timestamp("submitted_at", { withTimezone: true }),
		processedAt: timestamp("processed_at", { withTimezone: true }),

		// Form version at time of submission (for schema evolution)
		formVersion: integer("form_version").notNull().default(1),
	},
	(table) => ({
		formIdx: index("form_submissions_form_idx").on(table.formId),
		organisationIdx: index("form_submissions_organisation_idx").on(table.organisationId),
		statusIdx: index("form_submissions_status_idx").on(table.status),
		submittedIdx: index("form_submissions_submitted_idx").on(table.submittedAt),
		clientIdx: index("form_submissions_client_idx").on(table.clientId),
		slugIdx: index("form_submissions_slug_idx").on(table.slug),
	}),
);

// Form Templates table - System-wide starting point templates
export const formTemplates = pgTable("form_templates", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Template Info
	name: varchar("name", { length: 255 }).notNull(),
	slug: varchar("slug", { length: 255 }).notNull().unique(),
	description: text("description"),
	category: varchar("category", { length: 100 }).notNull(),

	// Template Schema
	schema: jsonb("schema").$type<RawFormSchema>().notNull(),
	uiConfig: jsonb("ui_config").notNull(),

	// Display
	previewImageUrl: text("preview_image_url"),
	isFeatured: boolean("is_featured").notNull().default(false),
	displayOrder: integer("display_order").notNull().default(0),

	// Admin Controls
	newUntil: timestamp("new_until", { withTimezone: true }),
	usageCount: integer("usage_count").notNull().default(0),

	// Metadata
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Field Option Sets table - Reusable dropdown options
export const fieldOptionSets = pgTable(
	"field_option_sets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),

		// Option Set Info
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull(),
		description: text("description"),

		// Options as JSON array: [{"value": "tech", "label": "Technology"}, ...]
		options: jsonb("options").notNull(),

		// Metadata
		isSystem: boolean("is_system").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		uniqueOrganisationSlug: unique().on(table.organisationId, table.slug),
		organisationIdx: index("field_option_sets_organisation_idx").on(table.organisationId),
	}),
);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// User types
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// Organisation types
export type Organisation = typeof organisations.$inferSelect;
export type OrganisationInsert = typeof organisations.$inferInsert;
export type OrganisationMembership = typeof organisationMemberships.$inferSelect;
export type OrganisationMembershipInsert = typeof organisationMemberships.$inferInsert;
export type OrganisationFormOption = typeof organisationFormOptions.$inferSelect;
export type OrganisationFormOptionInsert = typeof organisationFormOptions.$inferInsert;

// Audit and compliance types
export type OrganisationActivityLog = typeof organisationActivityLog.$inferSelect;
export type OrganisationActivityLogInsert = typeof organisationActivityLog.$inferInsert;

// Beta invite types
export type BetaInvite = typeof betaInvites.$inferSelect;
export type BetaInviteInsert = typeof betaInvites.$inferInsert;
export type BetaInviteStatus = "pending" | "used" | "expired" | "revoked";
export type FreemiumReason =
	| "beta_tester"
	| "partner"
	| "promotional"
	| "early_signup"
	| "referral_reward"
	| "internal";

// Organisation profile types
export type OrganisationProfile = typeof organisationProfiles.$inferSelect;
export type OrganisationProfileInsert = typeof organisationProfiles.$inferInsert;

// Role and status types
export type OrganisationRole = "owner" | "admin" | "member";
export type OrganisationStatus = "active" | "suspended" | "cancelled";
export type MembershipStatus = "active" | "invited" | "suspended";

// Form types
export type OrganisationForm = typeof organisationForms.$inferSelect;
export type OrganisationFormInsert = typeof organisationForms.$inferInsert;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type FormSubmissionInsert = typeof formSubmissions.$inferInsert;
export type FormTemplate = typeof formTemplates.$inferSelect;
export type FormTemplateInsert = typeof formTemplates.$inferInsert;
export type FieldOptionSet = typeof fieldOptionSets.$inferSelect;
export type FieldOptionSetInsert = typeof fieldOptionSets.$inferInsert;

// Client types
export type Client = typeof clients.$inferSelect;
export type ClientInsert = typeof clients.$inferInsert;
export type ClientStatus = "active" | "archived";

// Form-related types
export type FormType = "questionnaire" | "consultation" | "feedback" | "intake" | "custom";
export type FormSubmissionStatus = "draft" | "completed" | "processing" | "processed" | "archived";

// Form option category type
export type FormOptionCategory =
	| "industry"
	| "business_type"
	| "website_status"
	| "primary_challenges"
	| "urgency_level"
	| "primary_goals"
	| "conversion_goal"
	| "budget_range"
	| "timeline"
	| "design_styles";
