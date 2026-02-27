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
	numeric,
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
// H5P LIBRARY TABLES (Platform-wide)
// =============================================================================

// H5P Libraries — platform-wide registry (no org_id — libraries are shared)
export const h5pLibraries = pgTable(
	"h5p_libraries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		// Identity (composite unique)
		machineName: varchar("machine_name", { length: 255 }).notNull(),
		majorVersion: integer("major_version").notNull(),
		minorVersion: integer("minor_version").notNull(),
		patchVersion: integer("patch_version").notNull(),
		title: text("title").notNull().default(""),

		// Provenance
		origin: varchar("origin", { length: 20 }).notNull().default("official"),

		// Full library.json stored as JSONB
		metadataJson: jsonb("metadata_json"),

		// Discovery / filtering
		categories: text("categories").array(),
		keywords: text("keywords").array(),
		screenshots: text("screenshots").array(),
		description: text("description").notNull().default(""),
		iconPath: text("icon_path"),

		// R2 storage paths
		packagePath: text("package_path"),
		extractedPath: text("extracted_path"),

		// Flags
		runnable: boolean("runnable").notNull().default(false),
		restricted: boolean("restricted").notNull().default(false),
	},
	(table) => ({
		uniqueVersion: unique().on(table.machineName, table.majorVersion, table.minorVersion, table.patchVersion),
		machineNameIdx: index("h5p_libraries_machine_name_idx").on(table.machineName),
	}),
);

// H5P Library Dependencies — normalised dependency graph
export const h5pLibraryDependencies = pgTable(
	"h5p_library_dependencies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		libraryId: uuid("library_id")
			.notNull()
			.references(() => h5pLibraries.id, { onDelete: "cascade" }),
		dependsOnId: uuid("depends_on_id")
			.notNull()
			.references(() => h5pLibraries.id, { onDelete: "cascade" }),
		dependencyType: varchar("dependency_type", { length: 20 }).notNull(),
	},
	(table) => ({
		uniqueDep: unique().on(table.libraryId, table.dependsOnId, table.dependencyType),
		libraryIdx: index("h5p_lib_deps_library_idx").on(table.libraryId),
		dependsOnIdx: index("h5p_lib_deps_depends_on_idx").on(table.dependsOnId),
	}),
);

// H5P Org Libraries — per-org library enablement / restriction
export const h5pOrgLibraries = pgTable(
	"h5p_org_libraries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		libraryId: uuid("library_id")
			.notNull()
			.references(() => h5pLibraries.id, { onDelete: "cascade" }),
		enabled: boolean("enabled").notNull().default(true),
		restricted: boolean("restricted").notNull().default(false),
	},
	(table) => ({
		uniqueOrgLibrary: unique().on(table.orgId, table.libraryId),
		orgIdx: index("h5p_org_libs_org_idx").on(table.orgId),
		libraryIdx: index("h5p_org_libs_library_idx").on(table.libraryId),
	}),
);

// =============================================================================
// H5P CONTENT TABLES (Organisation-scoped)
// =============================================================================

// H5P Content — organisation-scoped content items
export const h5pContent = pgTable(
	"h5p_content",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		libraryId: uuid("library_id")
			.notNull()
			.references(() => h5pLibraries.id),
		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

		// Identity
		title: text("title").notNull(),
		slug: text("slug").notNull(),
		description: text("description").notNull().default(""),

		// Content payload (retrieve by ID only — never query into)
		contentJson: jsonb("content_json").notNull().default({}),

		// Discovery
		tags: text("tags").array(),

		// Virtual folder path (denormalised for fast listing)
		folderPath: text("folder_path"),

		// R2 storage location
		storagePath: text("storage_path"),

		// Status
		status: varchar("status", { length: 20 }).notNull().default("draft"),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => ({
		uniqueOrgSlug: unique().on(table.orgId, table.slug),
		orgIdx: index("h5p_content_org_idx").on(table.orgId),
		libraryIdx: index("h5p_content_library_idx").on(table.libraryId),
		statusIdx: index("h5p_content_status_idx").on(table.orgId, table.status),
		folderIdx: index("h5p_content_folder_idx").on(table.orgId, table.folderPath),
	}),
);

// H5P Content Folders — virtual folder tree for organising content
export const h5pContentFolders = pgTable(
	"h5p_content_folders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		parentId: uuid("parent_id"),
		name: text("name").notNull(),
	},
	(table) => ({
		uniqueOrgParentName: unique().on(table.orgId, table.parentId, table.name),
		orgIdx: index("h5p_folders_org_idx").on(table.orgId),
		parentIdx: index("h5p_folders_parent_idx").on(table.parentId),
	}),
);

// =============================================================================
// H5P HUB TABLES
// =============================================================================

// H5P Hub Registrations — per-org Hub API key
export const h5pHubRegistrations = pgTable("h5p_hub_registrations", {
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

	orgId: uuid("org_id")
		.notNull()
		.unique()
		.references(() => organisations.id, { onDelete: "cascade" }),

	siteKey: text("site_key").notNull().default(""),
	siteSecret: text("site_secret").notNull().default(""),
	hubUrl: text("hub_url").notNull().default("https://api.h5p.org"),
});

// H5P Hub Cache — cached Hub content-type responses (TTL-based)
export const h5pHubCache = pgTable("h5p_hub_cache", {
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

	cacheKey: text("cache_key").notNull().unique(),
	data: jsonb("data").notNull().default({}),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// =============================================================================
// COURSE TABLES
// =============================================================================

// Courses — org-scoped containers of learning content
export const courses = pgTable(
	"courses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

		title: text("title").notNull(),
		slug: text("slug").notNull(),
		description: text("description").notNull().default(""),
		coverImage: text("cover_image"),

		status: varchar("status", { length: 20 }).notNull().default("draft"),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => ({
		uniqueOrgSlug: unique().on(table.orgId, table.slug),
		orgIdx: index("courses_org_idx").on(table.orgId),
		statusIdx: index("courses_status_idx").on(table.orgId, table.status),
	}),
);

// Course Items — ordered items within a course
export const courseItems = pgTable(
	"course_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		courseId: uuid("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		contentId: uuid("content_id").references(() => h5pContent.id, { onDelete: "set null" }),

		sortOrder: integer("sort_order").notNull().default(0),
		title: text("title").notNull().default(""),
		itemType: varchar("item_type", { length: 20 }).notNull().default("h5p"),
	},
	(table) => ({
		courseIdx: index("course_items_course_idx").on(table.courseId),
		contentIdx: index("course_items_content_idx").on(table.contentId),
		sortIdx: index("course_items_sort_idx").on(table.courseId, table.sortOrder),
	}),
);

// =============================================================================
// ANALYTICS TABLES
// =============================================================================

// Enrolments — learner enrolments in courses
export const enrolments = pgTable(
	"enrolments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		courseId: uuid("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		status: varchar("status", { length: 20 }).notNull().default("active"),
		enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => ({
		uniqueCourseUser: unique().on(table.courseId, table.userId),
		orgIdx: index("enrolments_org_idx").on(table.orgId),
		courseIdx: index("enrolments_course_idx").on(table.courseId),
		userIdx: index("enrolments_user_idx").on(table.userId),
		statusIdx: index("enrolments_status_idx").on(table.orgId, table.status),
	}),
);

// Progress Records — per-content progress tracking
export const progressRecords = pgTable(
	"progress_records",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		enrolmentId: uuid("enrolment_id")
			.notNull()
			.references(() => enrolments.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => h5pContent.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		score: numeric("score", { precision: 5, scale: 2 }),
		maxScore: numeric("max_score", { precision: 5, scale: 2 }),
		completion: numeric("completion", { precision: 5, scale: 4 }).notNull().default("0"),
		completed: boolean("completed").notNull().default(false),
		attempts: integer("attempts").notNull().default(0),
		timeSpent: integer("time_spent").notNull().default(0), // seconds
	},
	(table) => ({
		uniqueEnrolmentContent: unique().on(table.enrolmentId, table.contentId),
		orgIdx: index("progress_org_idx").on(table.orgId),
		enrolmentIdx: index("progress_enrolment_idx").on(table.enrolmentId),
		contentIdx: index("progress_content_idx").on(table.contentId),
		userIdx: index("progress_user_idx").on(table.userId),
	}),
);

// xAPI Statements — append-only log
// Future: consider time-based partitioning for large deployments
export const xapiStatements = pgTable(
	"xapi_statements",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

		orgId: uuid("org_id")
			.notNull()
			.references(() => organisations.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		contentId: uuid("content_id").references(() => h5pContent.id, { onDelete: "set null" }),

		verb: varchar("verb", { length: 255 }).notNull(),
		statement: jsonb("statement").notNull(),
	},
	(table) => ({
		orgIdx: index("xapi_org_idx").on(table.orgId),
		userIdx: index("xapi_user_idx").on(table.userId),
		contentIdx: index("xapi_content_idx").on(table.contentId),
		orgCreatedIdx: index("xapi_org_created_idx").on(table.orgId, table.createdAt),
		verbIdx: index("xapi_verb_idx").on(table.verb),
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

// H5P Library types
export type H5pLibrary = typeof h5pLibraries.$inferSelect;
export type H5pLibraryInsert = typeof h5pLibraries.$inferInsert;
export type H5pLibraryDependency = typeof h5pLibraryDependencies.$inferSelect;
export type H5pLibraryDependencyInsert = typeof h5pLibraryDependencies.$inferInsert;
export type H5pOrgLibrary = typeof h5pOrgLibraries.$inferSelect;
export type H5pOrgLibraryInsert = typeof h5pOrgLibraries.$inferInsert;
export type H5pLibraryOrigin = "official" | "custom";
export type H5pDependencyType = "preloaded" | "dynamic" | "editor";

// H5P Content types
export type H5pContent = typeof h5pContent.$inferSelect;
export type H5pContentInsert = typeof h5pContent.$inferInsert;
export type H5pContentFolder = typeof h5pContentFolders.$inferSelect;
export type H5pContentFolderInsert = typeof h5pContentFolders.$inferInsert;
export type H5pContentStatus = "draft" | "published" | "archived";

// H5P Hub types
export type H5pHubRegistration = typeof h5pHubRegistrations.$inferSelect;
export type H5pHubRegistrationInsert = typeof h5pHubRegistrations.$inferInsert;
export type H5pHubCacheEntry = typeof h5pHubCache.$inferSelect;
export type H5pHubCacheEntryInsert = typeof h5pHubCache.$inferInsert;

// Course types
export type Course = typeof courses.$inferSelect;
export type CourseInsert = typeof courses.$inferInsert;
export type CourseItem = typeof courseItems.$inferSelect;
export type CourseItemInsert = typeof courseItems.$inferInsert;
export type CourseStatus = "draft" | "published" | "archived";
export type CourseItemType = "h5p" | "text" | "video" | "link";

// Analytics types
export type Enrolment = typeof enrolments.$inferSelect;
export type EnrolmentInsert = typeof enrolments.$inferInsert;
export type ProgressRecord = typeof progressRecords.$inferSelect;
export type ProgressRecordInsert = typeof progressRecords.$inferInsert;
export type XapiStatement = typeof xapiStatements.$inferSelect;
export type XapiStatementInsert = typeof xapiStatements.$inferInsert;
export type EnrolmentStatus = "active" | "completed" | "withdrawn";
