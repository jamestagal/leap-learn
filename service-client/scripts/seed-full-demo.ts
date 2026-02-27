/**
 * Full Demo Seed Script (Master Orchestrator)
 *
 * Creates a complete Murray's Plumbing demo including all entities:
 * 1. Agency (Plentify Web Designs) with packages and addons
 * 2. Consultation (completed Murray's Plumbing consultation)
 * 3. Proposal (comprehensive website redesign proposal)
 * 4. Contract (ready-to-sign service agreement)
 * 5. Questionnaire (completed Initial Website Questionnaire)
 * 6. Invoice (50% deposit invoice)
 *
 * This script combines all modular seed scripts into one convenient command.
 *
 * Run with: npx tsx scripts/seed-full-demo.ts <user-email>
 * Example: npx tsx scripts/seed-full-demo.ts ben@plentify.au
 *
 * Or run individual scripts:
 *   npx tsx scripts/seed-demo-data.ts <user-email>  (agency + packages + proposal)
 *   npx tsx scripts/seed-consultation.ts <agency-slug>
 *   npx tsx scripts/seed-contract.ts <agency-slug>
 *   npx tsx scripts/seed-questionnaire.ts <agency-slug>
 *   npx tsx scripts/seed-invoice.ts <agency-slug>
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
	pgTable,
	uuid,
	text,
	jsonb,
	timestamp,
	varchar,
	boolean,
	decimal,
	integer,
	unique,
} from "drizzle-orm/pg-core";

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const users = pgTable("users", {
	id: uuid("id").primaryKey(),
	email: text("email").notNull(),
	defaultAgencyId: uuid("default_agency_id"),
});

const agencies = pgTable("agencies", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logoUrl: text("logo_url").notNull().default(""),
	primaryColor: text("primary_color").notNull().default("#4F46E5"),
	secondaryColor: text("secondary_color").notNull().default("#1E40AF"),
	accentColor: text("accent_color").notNull().default("#F59E0B"),
	email: text("email").notNull().default(""),
	phone: text("phone").notNull().default(""),
	website: text("website").notNull().default(""),
	status: varchar("status", { length: 50 }).notNull().default("active"),
	subscriptionTier: varchar("subscription_tier", { length: 50 }).notNull().default("free"),
});

const agencyMemberships = pgTable("agency_memberships", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	userId: uuid("user_id").notNull(),
	agencyId: uuid("agency_id").notNull(),
	role: varchar("role", { length: 50 }).notNull().default("member"),
	displayName: text("display_name").notNull().default(""),
	status: varchar("status", { length: 50 }).notNull().default("active"),
	acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

const agencyProfiles = pgTable("agency_profiles", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull().unique(),
	abn: varchar("abn", { length: 20 }).notNull().default(""),
	legalEntityName: text("legal_entity_name").notNull().default(""),
	tradingName: text("trading_name").notNull().default(""),
	addressLine1: text("address_line_1").notNull().default(""),
	city: varchar("city", { length: 100 }).notNull().default(""),
	state: varchar("state", { length: 50 }).notNull().default(""),
	postcode: varchar("postcode", { length: 20 }).notNull().default(""),
	country: varchar("country", { length: 100 }).notNull().default("Australia"),
	bankName: varchar("bank_name", { length: 100 }).notNull().default(""),
	bsb: varchar("bsb", { length: 10 }).notNull().default(""),
	accountNumber: varchar("account_number", { length: 30 }).notNull().default(""),
	accountName: text("account_name").notNull().default(""),
	gstRegistered: boolean("gst_registered").notNull().default(true),
	gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),
	tagline: text("tagline").notNull().default(""),
	defaultPaymentTerms: varchar("default_payment_terms", { length: 50 }).notNull().default("NET_14"),
	invoicePrefix: varchar("invoice_prefix", { length: 20 }).notNull().default("INV"),
	nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
	contractPrefix: varchar("contract_prefix", { length: 20 }).notNull().default("CON"),
	nextContractNumber: integer("next_contract_number").notNull().default(1),
	proposalPrefix: varchar("proposal_prefix", { length: 20 }).notNull().default("PROP"),
	nextProposalNumber: integer("next_proposal_number").notNull().default(1),
});

const agencyPackages = pgTable("agency_packages", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	slug: varchar("slug", { length: 50 }).notNull(),
	description: text("description").notNull().default(""),
	pricingModel: varchar("pricing_model", { length: 50 }).notNull(),
	setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
	monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
	oneTimePrice: decimal("one_time_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
	hostingFee: decimal("hosting_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
	minimumTermMonths: integer("minimum_term_months").notNull().default(12),
	includedFeatures: jsonb("included_features").notNull().default([]),
	maxPages: integer("max_pages"),
	displayOrder: integer("display_order").notNull().default(0),
	isFeatured: boolean("is_featured").notNull().default(false),
	isActive: boolean("is_active").notNull().default(true),
});

const agencyAddons = pgTable("agency_addons", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	slug: varchar("slug", { length: 50 }).notNull(),
	description: text("description").notNull().default(""),
	price: decimal("price", { precision: 10, scale: 2 }).notNull(),
	pricingType: varchar("pricing_type", { length: 50 }).notNull(),
	unitLabel: varchar("unit_label", { length: 50 }),
	availablePackages: jsonb("available_packages").notNull().default([]),
	displayOrder: integer("display_order").notNull().default(0),
	isActive: boolean("is_active").notNull().default(true),
});

const consultations = pgTable("consultations", {
	id: uuid("id").primaryKey(),
	userId: uuid("user_id").notNull(),
	agencyId: uuid("agency_id"),
	contactInfo: jsonb("contact_info").notNull().default({}),
	businessContext: jsonb("business_context").notNull().default({}),
	painPoints: jsonb("pain_points").notNull().default({}),
	goalsObjectives: jsonb("goals_objectives").notNull().default({}),
	status: varchar("status", { length: 50 }).notNull().default("draft"),
	completionPercentage: integer("completion_percentage").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true }),
});

const proposals = pgTable("proposals", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
	consultationId: uuid("consultation_id"),
	proposalNumber: varchar("proposal_number", { length: 50 }).notNull(),
	slug: varchar("slug", { length: 100 }).notNull().unique(),
	status: varchar("status", { length: 50 }).notNull().default("draft"),
	title: text("title").notNull().default(""),
	coverImage: text("cover_image"),
	executiveSummary: text("executive_summary").notNull().default(""),
	performanceData: jsonb("performance_data").notNull().default({}),
	opportunityContent: text("opportunity_content").notNull().default(""),
	currentIssues: jsonb("current_issues").notNull().default([]),
	complianceIssues: jsonb("compliance_issues").notNull().default([]),
	roiAnalysis: jsonb("roi_analysis").notNull().default({}),
	performanceStandards: jsonb("performance_standards").notNull().default([]),
	localAdvantageContent: text("local_advantage_content").notNull().default(""),
	proposedPages: jsonb("proposed_pages").notNull().default([]),
	timeline: jsonb("timeline").notNull().default([]),
	closingContent: text("closing_content").notNull().default(""),
	nextSteps: jsonb("next_steps").notNull().default([]),
	consultationPainPoints: jsonb("consultation_pain_points").notNull().default({}),
	consultationGoals: jsonb("consultation_goals").notNull().default({}),
	consultationChallenges: jsonb("consultation_challenges").notNull().default([]),
	clientBusinessName: text("client_business_name").notNull().default(""),
	clientContactName: text("client_contact_name").notNull().default(""),
	clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),
	clientPhone: varchar("client_phone", { length: 50 }).notNull().default(""),
	clientWebsite: text("client_website").notNull().default(""),
	selectedPackageId: uuid("selected_package_id"),
	selectedAddons: jsonb("selected_addons").notNull().default([]),
	validUntil: timestamp("valid_until", { withTimezone: true }),
	viewCount: integer("view_count").notNull().default(0),
	sentAt: timestamp("sent_at", { withTimezone: true }),
	createdBy: uuid("created_by"),
});

const contracts = pgTable("contracts", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
	proposalId: uuid("proposal_id").notNull(),
	templateId: uuid("template_id"),
	contractNumber: varchar("contract_number", { length: 50 }).notNull(),
	slug: varchar("slug", { length: 100 }).notNull().unique(),
	version: integer("version").notNull().default(1),
	status: varchar("status", { length: 50 }).notNull().default("draft"),
	clientBusinessName: text("client_business_name").notNull().default(""),
	clientContactName: text("client_contact_name").notNull().default(""),
	clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),
	clientPhone: varchar("client_phone", { length: 50 }).notNull().default(""),
	clientAddress: text("client_address").notNull().default(""),
	servicesDescription: text("services_description").notNull().default(""),
	commencementDate: timestamp("commencement_date", { withTimezone: true }),
	completionDate: timestamp("completion_date", { withTimezone: true }),
	specialConditions: text("special_conditions").notNull().default(""),
	totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
	priceIncludesGst: boolean("price_includes_gst").notNull().default(true),
	paymentTerms: text("payment_terms").notNull().default(""),
	validUntil: timestamp("valid_until", { withTimezone: true }),
	agencySignatoryName: varchar("agency_signatory_name", { length: 255 }),
	agencySignatoryTitle: varchar("agency_signatory_title", { length: 100 }),
	agencySignedAt: timestamp("agency_signed_at", { withTimezone: true }),
	viewCount: integer("view_count").notNull().default(0),
	visibleFields: jsonb("visible_fields").notNull().default([]),
	includedScheduleIds: jsonb("included_schedule_ids").notNull().default([]),
	createdBy: uuid("created_by"),
});

const questionnaireResponses = pgTable("questionnaire_responses", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
	slug: varchar("slug", { length: 100 }).notNull().unique(),
	contractId: uuid("contract_id"),
	proposalId: uuid("proposal_id"),
	consultationId: uuid("consultation_id"),
	clientBusinessName: text("client_business_name").notNull().default(""),
	clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),
	responses: jsonb("responses").notNull().default({}),
	currentSection: integer("current_section").notNull().default(0),
	completionPercentage: integer("completion_percentage").notNull().default(0),
	status: varchar("status", { length: 50 }).notNull().default("not_started"),
	startedAt: timestamp("started_at", { withTimezone: true }),
	completedAt: timestamp("completed_at", { withTimezone: true }),
	lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
});

const invoices = pgTable("invoices", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
	proposalId: uuid("proposal_id"),
	contractId: uuid("contract_id"),
	invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
	slug: varchar("slug", { length: 100 }).notNull().unique(),
	status: varchar("status", { length: 50 }).notNull().default("draft"),
	clientBusinessName: text("client_business_name").notNull(),
	clientContactName: text("client_contact_name").notNull().default(""),
	clientEmail: varchar("client_email", { length: 255 }).notNull(),
	clientPhone: varchar("client_phone", { length: 50 }).notNull().default(""),
	clientAddress: text("client_address").notNull().default(""),
	clientAbn: varchar("client_abn", { length: 20 }).notNull().default(""),
	issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
	dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
	subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
	discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
	discountDescription: text("discount_description").notNull().default(""),
	gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
	total: decimal("total", { precision: 10, scale: 2 }).notNull(),
	gstRegistered: boolean("gst_registered").notNull().default(true),
	gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),
	paymentTerms: varchar("payment_terms", { length: 50 }).notNull().default("NET_14"),
	paymentTermsCustom: text("payment_terms_custom").notNull().default(""),
	notes: text("notes").notNull().default(""),
	publicNotes: text("public_notes").notNull().default(""),
	viewCount: integer("view_count").notNull().default(0),
	onlinePaymentEnabled: boolean("online_payment_enabled").notNull().default(true),
	createdBy: uuid("created_by"),
});

const invoiceLineItems = pgTable("invoice_line_items", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	invoiceId: uuid("invoice_id").notNull(),
	description: text("description").notNull(),
	quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1.00"),
	unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
	amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
	isTaxable: boolean("is_taxable").notNull().default(true),
	sortOrder: integer("sort_order").notNull().default(0),
	category: varchar("category", { length: 50 }),
	packageId: uuid("package_id"),
	addonId: uuid("addon_id"),
});

// ============================================================================
// FIXED IDs FOR CONSISTENCY
// ============================================================================

const IDS = {
	AGENCY: "aaaaaaaa-1111-1111-1111-111111111111",
	AGENCY_PROFILE: "aaaaaaaa-1111-1111-1111-222222222222",
	MEMBERSHIP: "aaaaaaaa-1111-1111-1111-333333333333",
	CONSULTATION: "eeeeeeee-5555-5555-5555-111111111111",
	PROPOSAL: "bbbbbbbb-2222-2222-2222-222222222222",
	CONTRACT: "ffffffff-6666-6666-6666-111111111111",
	QUESTIONNAIRE: "99999999-7777-7777-7777-111111111111",
	INVOICE: "aaaaaaaa-8888-8888-8888-111111111111",
	// Packages
	LUMP_SUM_PACKAGE: "cccccccc-3333-3333-3333-111111111111",
	HYBRID_PACKAGE: "cccccccc-3333-3333-3333-222222222222",
	SUBSCRIPTION_PACKAGE: "cccccccc-3333-3333-3333-333333333333",
	// Addons
	SEO_ADDON: "dddddddd-4444-4444-4444-111111111111",
	COPYWRITING_ADDON: "dddddddd-4444-4444-4444-222222222222",
	EXTRA_PAGES_ADDON: "dddddddd-4444-4444-4444-333333333333",
	LOGO_DESIGN_ADDON: "dddddddd-4444-4444-4444-444444444444",
};

// ============================================================================
// IMPORT DATA FROM MODULAR SCRIPTS (inline for simplicity)
// ============================================================================

// Import consultation data
import { murraysConsultationData } from "./seed-consultation";
// Import questionnaire data
import { murraysQuestionnaireData } from "./seed-questionnaire";

// Agency data
const agencyData = {
	name: "Plentify Web Designs",
	slug: "plentify",
	logoUrl: "",
	primaryColor: "#2563EB",
	secondaryColor: "#1E40AF",
	accentColor: "#F59E0B",
	email: "hello@plentify.au",
	phone: "1300 123 456",
	website: "https://plentify.au",
	status: "active",
	subscriptionTier: "growth",
};

const agencyProfileData = {
	abn: "12 345 678 901",
	legalEntityName: "Plentify Digital Pty Ltd",
	tradingName: "Plentify Web Designs",
	addressLine1: "123 Innovation Drive",
	city: "Brisbane",
	state: "QLD",
	postcode: "4000",
	country: "Australia",
	bankName: "Commonwealth Bank",
	bsb: "064-000",
	accountNumber: "12345678",
	accountName: "Plentify Digital Pty Ltd",
	gstRegistered: true,
	gstRate: "10.00",
	tagline: "Websites that work as hard as you do",
	defaultPaymentTerms: "NET_14",
	invoicePrefix: "INV",
	nextInvoiceNumber: 2,
	contractPrefix: "CON",
	nextContractNumber: 2,
	proposalPrefix: "PROP",
	nextProposalNumber: 2,
};

// Packages
const packagesData = [
	{
		id: IDS.LUMP_SUM_PACKAGE,
		name: "Business Starter",
		slug: "business-starter",
		description:
			"Perfect for small businesses wanting a professional online presence without ongoing fees.",
		pricingModel: "lump_sum",
		setupFee: "0.00",
		monthlyPrice: "0.00",
		oneTimePrice: "4950.00",
		hostingFee: "49.00",
		minimumTermMonths: 12,
		includedFeatures: [
			"Up to 8 pages",
			"Mobile responsive design",
			"Contact form integration",
			"Google Analytics setup",
			"Basic SEO optimization",
			"Social media links",
			"SSL certificate included",
			"1 month support included",
		],
		maxPages: 8,
		displayOrder: 1,
		isFeatured: false,
		isActive: true,
	},
	{
		id: IDS.HYBRID_PACKAGE,
		name: "Growth Package",
		slug: "growth-package",
		description: "Our most popular choice. Lower upfront cost with ongoing support and updates.",
		pricingModel: "hybrid",
		setupFee: "2450.00",
		monthlyPrice: "199.00",
		oneTimePrice: "0.00",
		hostingFee: "0.00",
		minimumTermMonths: 12,
		includedFeatures: [
			"Up to 12 pages",
			"Premium responsive design",
			"Online booking integration",
			"Google Business Profile setup",
			"Advanced SEO optimization",
			"Monthly content updates (2 hrs)",
			"Priority email support",
			"Monthly performance reports",
			"Free hosting included",
			"Quarterly strategy calls",
		],
		maxPages: 12,
		displayOrder: 2,
		isFeatured: true,
		isActive: true,
	},
	{
		id: IDS.SUBSCRIPTION_PACKAGE,
		name: "Enterprise Solution",
		slug: "enterprise-solution",
		description: "Full-service digital partnership with no upfront costs. Everything included.",
		pricingModel: "subscription",
		setupFee: "0.00",
		monthlyPrice: "499.00",
		oneTimePrice: "0.00",
		hostingFee: "0.00",
		minimumTermMonths: 24,
		includedFeatures: [
			"Unlimited pages",
			"Custom design system",
			"E-commerce integration",
			"CRM integration",
			"Advanced analytics dashboard",
			"Unlimited content updates",
			"24/7 priority support",
			"Weekly performance reports",
			"Premium hosting included",
			"Monthly strategy sessions",
			"A/B testing and optimization",
			"Dedicated account manager",
		],
		maxPages: null,
		displayOrder: 3,
		isFeatured: false,
		isActive: true,
	},
];

// Addons
const addonsData = [
	{
		id: IDS.SEO_ADDON,
		name: "Monthly SEO Package",
		slug: "monthly-seo",
		description:
			"Ongoing SEO optimization including keyword research, content updates, and link building.",
		price: "350.00",
		pricingType: "monthly",
		availablePackages: [],
		displayOrder: 1,
		isActive: true,
	},
	{
		id: IDS.COPYWRITING_ADDON,
		name: "Professional Copywriting",
		slug: "copywriting",
		description: "Engaging, SEO-optimized content written by professional copywriters.",
		price: "150.00",
		pricingType: "per_unit",
		unitLabel: "page",
		availablePackages: [],
		displayOrder: 2,
		isActive: true,
	},
	{
		id: IDS.EXTRA_PAGES_ADDON,
		name: "Additional Pages",
		slug: "extra-pages",
		description: "Need more pages? Add additional pages to your website.",
		price: "250.00",
		pricingType: "per_unit",
		unitLabel: "page",
		availablePackages: ["business-starter", "growth-package"],
		displayOrder: 3,
		isActive: true,
	},
	{
		id: IDS.LOGO_DESIGN_ADDON,
		name: "Logo Design Package",
		slug: "logo-design",
		description: "Professional logo design with 3 concepts and unlimited revisions.",
		price: "850.00",
		pricingType: "one_time",
		availablePackages: [],
		displayOrder: 4,
		isActive: true,
	},
];

// Proposal data (same as seed-proposal.ts)
const proposalData = {
	title: "Professional Website Redesign for Murrays Plumbing",
	coverImage: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200",
	executiveSummary: `Murray's Plumbing has built an excellent reputation over 15 years of serving the Brisbane community. However, your current website is limiting your growth potential and losing customers to competitors with modern online presence.

This proposal outlines a comprehensive website redesign that will transform your digital presence, improve search rankings, and convert more visitors into paying customers. We project a 200% increase in online leads within 6 months of launch.

Our approach combines stunning visual design with proven conversion optimization techniques, ensuring your new website works as hard as you do.`,
	performanceData: {
		performance: 34,
		accessibility: 52,
		bestPractices: 61,
		seo: 45,
		loadTime: "6.8s",
		issues: [
			"Page takes over 6 seconds to load on mobile",
			"Images are not optimized (3.2MB average)",
			"No SSL certificate installed",
			"Missing meta descriptions on all pages",
			"Not mobile responsive - text too small to read",
			"No structured data for local business",
			"Contact form is broken on mobile devices",
		],
	},
	opportunityContent: `The plumbing industry in Brisbane is experiencing significant digital transformation...`,
	currentIssues: [
		{ text: "Website takes 6+ seconds to load, causing 53% of visitors to leave", checked: true },
		{ text: "Not mobile-friendly - 73% of your traffic is mobile", checked: true },
		{ text: "No online booking system - customers must call during business hours", checked: true },
		{ text: "Missing Google Business integration and reviews display", checked: true },
	],
	complianceIssues: [
		{ text: "Missing privacy policy (required under Australian Privacy Act)", checked: true },
		{ text: "No WCAG 2.1 accessibility compliance", checked: true },
	],
	roiAnalysis: {
		currentVisitors: 450,
		projectedVisitors: 1350,
		conversionRate: 4.5,
		projectedLeads: 61,
		averageProjectValue: 485,
		projectedRevenue: 29585,
	},
	performanceStandards: [
		{ label: "Page Load Speed", value: "Under 2 seconds", icon: "Zap" },
		{ label: "Mobile Score", value: "95+", icon: "Smartphone" },
		{ label: "SEO Score", value: "90+", icon: "Search" },
	],
	localAdvantageContent: `**Dominate Brisbane Plumbing Searches**...`,
	proposedPages: [
		{
			name: "Home",
			description: "High-converting landing page with emergency CTA",
			features: ["24/7 emergency banner", "Click-to-call button"],
		},
		{
			name: "Services",
			description: "Comprehensive service pages",
			features: ["Emergency plumbing", "Hot water systems"],
		},
		{
			name: "Contact",
			description: "Multiple contact options",
			features: ["Online booking form", "Live chat widget"],
		},
	],
	timeline: [
		{
			week: "Week 1-2",
			title: "Discovery & Strategy",
			description: "Deep dive into your business...",
		},
		{ week: "Week 3-4", title: "Design & Prototyping", description: "Create visual designs..." },
		{ week: "Week 5-7", title: "Development", description: "Build your new website..." },
	],
	closingContent: `**Why Choose Plentify Web Designs?**...`,
	nextSteps: [
		{ text: "Sign contract and pay 50% deposit", completed: false },
		{ text: "Complete website questionnaire (15 mins)", completed: false },
	],
	consultationPainPoints: {
		primary_challenges: [
			"Not getting enough leads from website",
			"Competitors ranking higher on Google",
		],
		technical_issues: ["Site is slow and crashes on mobile", "Contact form not working properly"],
		solution_gaps: ["No online booking system", "No way to showcase reviews"],
	},
	consultationGoals: {
		primary_goals: ["Generate more leads online", "Rank on first page of Google"],
		secondary_goals: ["Reduce phone calls for basic questions"],
		success_metrics: ["50+ new leads per month", 'Top 3 ranking for "plumber Brisbane"'],
	},
	consultationChallenges: [
		"Current website is 8 years old and built on outdated technology",
		"Lost 3 large commercial contracts to competitors with better websites",
	],
	clientBusinessName: "Murrays Plumbing",
	clientContactName: "Steve Murray",
	clientEmail: "steve@murraysplumbing.com.au",
	clientPhone: "0412 345 678",
	clientWebsite: "https://murraysplumbing.com.au",
};

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedFullDemo() {
	const userEmail = process.argv[2];

	if (!userEmail) {
		console.error("Usage: npx tsx scripts/seed-full-demo.ts <user-email>");
		console.error("Example: npx tsx scripts/seed-full-demo.ts ben@plentify.au");
		process.exit(1);
	}

	console.log("\n" + "=".repeat(60));
	console.log("FULL DEMO SEED - Murray's Plumbing Complete Flow");
	console.log("=".repeat(60));
	console.log("\nThis will create:");
	console.log("  1. Agency (Plentify Web Designs)");
	console.log("  2. Consultation (completed client consultation)");
	console.log("  3. Proposal (comprehensive website proposal)");
	console.log("  4. Contract (ready-to-sign agreement)");
	console.log("  5. Questionnaire (completed Initial Website Questionnaire)");
	console.log("  6. Invoice (50% deposit invoice)");

	console.log("\nConnecting to database...");

	const pool = new Pool({
		host: process.env.POSTGRES_HOST || "localhost",
		port: parseInt(process.env.POSTGRES_PORT || "5432"),
		database: process.env.POSTGRES_DB || "postgres",
		user: process.env.POSTGRES_USER || "postgres",
		password: process.env.POSTGRES_PASSWORD || "postgres",
	});

	const db = drizzle(pool);

	try {
		// 1. Find the user
		console.log(`\n[1/6] Finding user: ${userEmail}...`);
		const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

		if (!user) {
			console.error(`\n❌ User not found with email: ${userEmail}`);
			console.error("Please log in first to create your user account.");
			process.exit(1);
		}
		console.log(`✓ Found user: ${user.id}`);

		// 2. Check if agency already exists
		const [existingAgency] = await db
			.select()
			.from(agencies)
			.where(eq(agencies.slug, agencyData.slug))
			.limit(1);

		if (existingAgency) {
			console.log(`\n⚠️  Agency "${agencyData.slug}" already exists.`);
			console.log("   Skipping agency creation, using existing agency.");
		} else {
			// Create agency
			console.log("\n[2/6] Creating agency...");
			await db.insert(agencies).values({
				id: IDS.AGENCY,
				...agencyData,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log(`✓ Created agency: ${agencyData.name}`);

			// Create agency profile
			await db.insert(agencyProfiles).values({
				id: IDS.AGENCY_PROFILE,
				agencyId: IDS.AGENCY,
				...agencyProfileData,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log("✓ Created agency profile");

			// Create membership
			await db.insert(agencyMemberships).values({
				id: IDS.MEMBERSHIP,
				userId: user.id,
				agencyId: IDS.AGENCY,
				role: "owner",
				displayName: "",
				status: "active",
				acceptedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log("✓ Created owner membership");

			// Update user's default agency
			await db.update(users).set({ defaultAgencyId: IDS.AGENCY }).where(eq(users.id, user.id));
			console.log("✓ Set default agency for user");

			// Create packages
			for (const pkg of packagesData) {
				await db.insert(agencyPackages).values({
					...pkg,
					agencyId: IDS.AGENCY,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			}
			console.log(`✓ Created ${packagesData.length} packages`);

			// Create addons
			for (const addon of addonsData) {
				await db.insert(agencyAddons).values({
					...addon,
					agencyId: IDS.AGENCY,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			}
			console.log(`✓ Created ${addonsData.length} add-ons`);
		}

		const agencyId = existingAgency?.id || IDS.AGENCY;

		// 3. Create consultation
		console.log("\n[3/6] Creating consultation...");
		const [existingConsultation] = await db
			.select()
			.from(consultations)
			.where(eq(consultations.id, IDS.CONSULTATION))
			.limit(1);

		if (!existingConsultation) {
			await db.insert(consultations).values({
				id: IDS.CONSULTATION,
				userId: user.id,
				agencyId: agencyId,
				contactInfo: murraysConsultationData.contactInfo,
				businessContext: murraysConsultationData.businessContext,
				painPoints: murraysConsultationData.painPoints,
				goalsObjectives: murraysConsultationData.goalsObjectives,
				status: "completed",
				completionPercentage: 100,
				createdAt: new Date(),
				updatedAt: new Date(),
				completedAt: new Date(),
			});
			console.log("✓ Created consultation for Murray's Plumbing");
		} else {
			console.log("✓ Consultation already exists");
		}

		// 4. Create proposal
		console.log("\n[4/6] Creating proposal...");
		const [existingProposal] = await db
			.select()
			.from(proposals)
			.where(eq(proposals.id, IDS.PROPOSAL))
			.limit(1);

		const proposalSlug = "murrays-plumbing-" + Date.now().toString(36);

		if (!existingProposal) {
			await db.insert(proposals).values({
				id: IDS.PROPOSAL,
				agencyId: agencyId,
				consultationId: IDS.CONSULTATION,
				proposalNumber: "PROP-2025-0001",
				slug: proposalSlug,
				status: "draft",
				...proposalData,
				selectedPackageId: IDS.HYBRID_PACKAGE,
				selectedAddons: [IDS.SEO_ADDON],
				validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				viewCount: 0,
				createdBy: user.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log("✓ Created proposal for Murray's Plumbing");
		} else {
			console.log("✓ Proposal already exists");
		}

		// 5. Create contract
		console.log("\n[5/6] Creating contract...");
		const [existingContract] = await db
			.select()
			.from(contracts)
			.where(eq(contracts.id, IDS.CONTRACT))
			.limit(1);

		const contractSlug = "murrays-plumbing-contract-" + Date.now().toString(36);
		const commencementDate = new Date();
		commencementDate.setDate(commencementDate.getDate() + 7);
		const completionDate = new Date(commencementDate);
		completionDate.setDate(completionDate.getDate() + 70);

		// Calculate total price (hybrid package)
		const setupFee = 2450;
		const monthlyPrice = 199;
		const minimumTerm = 12;
		const totalPrice = setupFee + monthlyPrice * minimumTerm;

		if (!existingContract) {
			await db.insert(contracts).values({
				id: IDS.CONTRACT,
				agencyId: agencyId,
				proposalId: IDS.PROPOSAL,
				contractNumber: "CON-2025-0001",
				slug: contractSlug,
				version: 1,
				status: "draft",
				clientBusinessName: "Murrays Plumbing",
				clientContactName: "Steve Murray",
				clientEmail: "steve@murraysplumbing.com.au",
				clientPhone: "0412 345 678",
				clientAddress: "42 Trade Street\nEight Mile Plains QLD 4113",
				servicesDescription:
					"## Website Design & Development Services\n\n### Package: Growth Package\n...",
				commencementDate,
				completionDate,
				specialConditions: "## Additional Terms for Murray's Plumbing\n\n...",
				totalPrice: totalPrice.toFixed(2),
				priceIncludesGst: true,
				paymentTerms: `Setup Fee: $${setupFee.toLocaleString()} (inc. GST) - due upon contract signing\nMonthly Retainer: $${monthlyPrice.toLocaleString()}/month (inc. GST)`,
				validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
				agencySignatoryName: "Benjamin Waller",
				agencySignatoryTitle: "Director",
				agencySignedAt: new Date(),
				viewCount: 0,
				visibleFields: [
					"services",
					"commencementDate",
					"completionDate",
					"price",
					"paymentTerms",
					"specialConditions",
				],
				includedScheduleIds: [],
				createdBy: user.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log("✓ Created contract for Murray's Plumbing");
		} else {
			console.log("✓ Contract already exists");
		}

		// 6. Create questionnaire
		console.log("\n[6/6] Creating questionnaire and invoice...");
		const [existingQuestionnaire] = await db
			.select()
			.from(questionnaireResponses)
			.where(eq(questionnaireResponses.id, IDS.QUESTIONNAIRE))
			.limit(1);

		const questionnaireSlug = "murrays-plumbing-questionnaire-" + Date.now().toString(36);

		if (!existingQuestionnaire) {
			await db.insert(questionnaireResponses).values({
				id: IDS.QUESTIONNAIRE,
				agencyId: agencyId,
				slug: questionnaireSlug,
				contractId: IDS.CONTRACT,
				proposalId: IDS.PROPOSAL,
				consultationId: IDS.CONSULTATION,
				clientBusinessName: "Murrays Plumbing",
				clientEmail: "steve@murraysplumbing.com.au",
				responses: murraysQuestionnaireData,
				currentSection: 8,
				completionPercentage: 100,
				status: "completed",
				startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
				completedAt: new Date(),
				lastActivityAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log("✓ Created questionnaire (8 sections, 39 fields)");
		} else {
			console.log("✓ Questionnaire already exists");
		}

		// Create invoice
		const [existingInvoice] = await db
			.select()
			.from(invoices)
			.where(eq(invoices.id, IDS.INVOICE))
			.limit(1);

		const invoiceSlug = "murrays-plumbing-deposit-" + Date.now().toString(36);
		const depositAmount = setupFee; // Setup fee is the deposit for hybrid
		const gstRate = 10;
		const subtotalExGst = depositAmount / 1.1;
		const gstAmount = depositAmount - subtotalExGst;

		if (!existingInvoice) {
			const issueDate = new Date();
			const dueDate = new Date();
			dueDate.setDate(dueDate.getDate() + 7);

			await db.insert(invoices).values({
				id: IDS.INVOICE,
				agencyId: agencyId,
				proposalId: IDS.PROPOSAL,
				contractId: IDS.CONTRACT,
				invoiceNumber: "INV-2025-0001",
				slug: invoiceSlug,
				status: "draft",
				clientBusinessName: "Murrays Plumbing",
				clientContactName: "Steve Murray",
				clientEmail: "steve@murraysplumbing.com.au",
				clientPhone: "0412 345 678",
				clientAddress: "42 Trade Street\nEight Mile Plains QLD 4113",
				clientAbn: "",
				issueDate,
				dueDate,
				subtotal: subtotalExGst.toFixed(2),
				discountAmount: "0.00",
				discountDescription: "",
				gstAmount: gstAmount.toFixed(2),
				total: depositAmount.toFixed(2),
				gstRegistered: true,
				gstRate: gstRate.toFixed(2),
				paymentTerms: "NET_7",
				paymentTermsCustom: "",
				notes: "Deposit invoice for website project",
				publicNotes:
					"## Payment Details\n\n**Bank Transfer:**\nBank: Commonwealth Bank\nBSB: 064-000\nAccount: 12345678",
				viewCount: 0,
				onlinePaymentEnabled: true,
				createdBy: user.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			// Create line item
			await db.insert(invoiceLineItems).values({
				id: uuidv4(),
				invoiceId: IDS.INVOICE,
				description: "Growth Package - 50% Deposit\nWebsite design and development services",
				quantity: "1.00",
				unitPrice: subtotalExGst.toFixed(2),
				amount: subtotalExGst.toFixed(2),
				isTaxable: true,
				sortOrder: 0,
				category: "setup",
				packageId: IDS.HYBRID_PACKAGE,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			console.log("✓ Created deposit invoice ($" + depositAmount.toFixed(2) + ")");
		} else {
			console.log("✓ Invoice already exists");
		}

		// Success summary
		console.log("\n" + "=".repeat(60));
		console.log("✅ FULL DEMO SEEDED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log("\nMurray's Plumbing Demo Flow Created:");
		console.log("");
		console.log("┌─────────────────┐     ┌─────────────────┐");
		console.log("│  Consultation   │────▶│    Proposal     │");
		console.log("│   (completed)   │     │    (draft)      │");
		console.log("└─────────────────┘     └────────┬────────┘");
		console.log("                                 │");
		console.log("                                 ▼");
		console.log("┌─────────────────┐     ┌─────────────────┐");
		console.log("│ Questionnaire   │◀────│    Contract     │");
		console.log("│  (completed)    │     │    (draft)      │");
		console.log("└─────────────────┘     └────────┬────────┘");
		console.log("                                 │");
		console.log("                                 ▼");
		console.log("                        ┌─────────────────┐");
		console.log("                        │    Invoice      │");
		console.log("                        │    (draft)      │");
		console.log("                        └─────────────────┘");
		console.log("");
		console.log("Agency:");
		console.log(`  URL: https://app.webkit.au/${agencyData.slug}`);
		console.log("");
		console.log("Client: Murray's Plumbing");
		console.log("  Contact: Steve Murray");
		console.log("  Email: steve@murraysplumbing.com.au");
		console.log("  Package: Growth Package ($2,450 + $199/mo)");
		console.log("");
		console.log("Quick Links:");
		console.log(`  Consultations: https://app.webkit.au/${agencyData.slug}/consultations`);
		console.log(`  Proposals: https://app.webkit.au/${agencyData.slug}/proposals`);
		console.log(`  Contracts: https://app.webkit.au/${agencyData.slug}/contracts`);
		console.log(`  Questionnaires: https://app.webkit.au/${agencyData.slug}/questionnaires`);
		console.log(`  Invoices: https://app.webkit.au/${agencyData.slug}/invoices`);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Error seeding demo data:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

seedFullDemo();
