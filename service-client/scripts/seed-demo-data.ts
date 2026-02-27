/**
 * Comprehensive Demo Data Seed Script
 *
 * Seeds a fresh database with complete demo data for the Murray's Plumbing proposal.
 * This creates all entities needed for a complete demo:
 * - Agency (Plentify Web Designs)
 * - Agency Profile with Stripe-ready setup
 * - User membership as owner
 * - Service packages (Lump Sum, Hybrid, Subscription)
 * - Add-ons
 * - Full proposal with all content
 *
 * Run with: npx tsx scripts/seed-demo-data.ts <user-email>
 * Example: npx tsx scripts/seed-demo-data.ts ben@plentify.au
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
// SCHEMA DEFINITIONS (Minimal for seeding)
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

const proposals = pgTable("proposals", {
	id: uuid("id").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	agencyId: uuid("agency_id").notNull(),
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

// ============================================================================
// SEED DATA
// ============================================================================

const AGENCY_ID = "aaaaaaaa-1111-1111-1111-111111111111";
const AGENCY_PROFILE_ID = "aaaaaaaa-1111-1111-1111-222222222222";
const MEMBERSHIP_ID = "aaaaaaaa-1111-1111-1111-333333333333";
const PROPOSAL_ID = "bbbbbbbb-2222-2222-2222-222222222222";

// Package IDs
const LUMP_SUM_PACKAGE_ID = "cccccccc-3333-3333-3333-111111111111";
const HYBRID_PACKAGE_ID = "cccccccc-3333-3333-3333-222222222222";
const SUBSCRIPTION_PACKAGE_ID = "cccccccc-3333-3333-3333-333333333333";

// Addon IDs
const SEO_ADDON_ID = "dddddddd-4444-4444-4444-111111111111";
const COPYWRITING_ADDON_ID = "dddddddd-4444-4444-4444-222222222222";
const EXTRA_PAGES_ADDON_ID = "dddddddd-4444-4444-4444-333333333333";
const LOGO_DESIGN_ADDON_ID = "dddddddd-4444-4444-4444-444444444444";

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
	nextInvoiceNumber: 1,
	contractPrefix: "CON",
	nextContractNumber: 1,
	proposalPrefix: "PROP",
	nextProposalNumber: 2,
};

const packagesData = [
	{
		id: LUMP_SUM_PACKAGE_ID,
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
		id: HYBRID_PACKAGE_ID,
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
		id: SUBSCRIPTION_PACKAGE_ID,
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

const addonsData = [
	{
		id: SEO_ADDON_ID,
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
		id: COPYWRITING_ADDON_ID,
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
		id: EXTRA_PAGES_ADDON_ID,
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
		id: LOGO_DESIGN_ADDON_ID,
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

	opportunityContent: `The plumbing industry in Brisbane is experiencing significant digital transformation. Recent studies show:

**Market Opportunity:**
• 87% of homeowners search online before calling a plumber
• Emergency plumbing searches have increased 340% in the past 3 years
• Mobile searches for "plumber near me" peak between 6-9pm when most offices are closed
• Businesses with modern websites receive 3x more quote requests

**Your Competitive Advantage:**
Murray's Plumbing has something competitors can't easily replicate - 15 years of trusted service and hundreds of satisfied customers. A modern website will finally showcase this reputation to potential customers searching online.

**The Cost of Inaction:**
Every month without a modern website, you're losing an estimated 40-60 potential customers to competitors who appear more professional online. At an average job value of $450, that's $18,000-$27,000 in lost revenue monthly.`,

	currentIssues: [
		{ text: "Website takes 6+ seconds to load, causing 53% of visitors to leave", checked: true },
		{ text: "Not mobile-friendly - 73% of your traffic is mobile", checked: true },
		{ text: "No online booking system - customers must call during business hours", checked: true },
		{ text: "Missing Google Business integration and reviews display", checked: true },
		{ text: "No emergency contact prominently displayed", checked: true },
		{ text: "Services pages lack detail and pricing guidance", checked: true },
		{ text: 'No SSL certificate - browser shows "Not Secure" warning', checked: true },
		{ text: "Contact form submissions going to spam folder", checked: false },
	],

	complianceIssues: [
		{ text: "Missing privacy policy (required under Australian Privacy Act)", checked: true },
		{ text: "No WCAG 2.1 accessibility compliance", checked: true },
		{ text: "Cookie consent banner not implemented", checked: true },
		{ text: "Terms and conditions page missing", checked: false },
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
		{ label: "Accessibility", value: "WCAG 2.1 AA", icon: "Eye" },
		{ label: "Security", value: "SSL + Security Headers", icon: "Shield" },
		{ label: "Uptime", value: "99.9% Guaranteed", icon: "Server" },
	],

	localAdvantageContent: `**Dominate Brisbane Plumbing Searches**

Your new website will be optimized for local search, helping you capture customers in your service areas:

• **Google Business Profile Integration** - Display your 4.8-star rating prominently
• **Service Area Pages** - Dedicated pages for Brisbane CBD, Northside, Southside, and Western suburbs
• **Local Schema Markup** - Help Google understand your business and display rich results
• **"Near Me" Optimization** - Capture emergency searches from mobile users
• **Review Generation System** - Automated follow-ups to build your online reputation

**Projected Local Search Rankings:**
Within 6 months, we expect page 1 rankings for:
- "Emergency plumber Brisbane"
- "Hot water repairs [suburb]"
- "Blocked drain specialist Brisbane"
- "24 hour plumber near me"`,

	proposedPages: [
		{
			name: "Home",
			description:
				"High-converting landing page with emergency CTA, trust signals, and service overview",
			features: [
				"24/7 emergency banner",
				"Click-to-call button",
				"Google reviews widget",
				"Service area map",
				"Recent projects gallery",
			],
		},
		{
			name: "Services",
			description: "Comprehensive service pages with pricing guides and booking integration",
			features: [
				"Emergency plumbing",
				"Hot water systems",
				"Blocked drains",
				"Gas fitting",
				"Bathroom renovations",
				"Commercial plumbing",
			],
		},
		{
			name: "Service Areas",
			description: "Location-specific pages for local SEO targeting",
			features: [
				"Brisbane CBD",
				"Northside suburbs",
				"Southside suburbs",
				"Western corridor",
				"Each with unique content",
			],
		},
		{
			name: "About Us",
			description: "Build trust with your story, team profiles, and credentials",
			features: [
				"Company history",
				"Meet the team",
				"Licenses & insurance",
				"Our values",
				"Community involvement",
			],
		},
		{
			name: "Projects Gallery",
			description: "Showcase your best work with before/after photos",
			features: [
				"Filterable gallery",
				"Before/after slider",
				"Project details",
				"Customer testimonials",
			],
		},
		{
			name: "Reviews",
			description: "Dedicated testimonials page with video reviews",
			features: ["Google reviews feed", "Video testimonials", "Case studies", "Trust badges"],
		},
		{
			name: "Blog",
			description: "SEO-focused content hub for plumbing tips and guides",
			features: ["DIY tips", "Seasonal maintenance guides", "Emergency preparation", "Cost guides"],
		},
		{
			name: "Contact",
			description: "Multiple contact options with instant booking",
			features: [
				"Online booking form",
				"Live chat widget",
				"Click-to-call",
				"Service area map",
				"Business hours",
			],
		},
	],

	timeline: [
		{
			week: "Week 1-2",
			title: "Discovery & Strategy",
			description:
				"Deep dive into your business, competitors, and target customers. Define site architecture, content strategy, and design direction.",
		},
		{
			week: "Week 3-4",
			title: "Design & Prototyping",
			description:
				"Create visual designs for all key pages. You'll review and approve designs before any development begins.",
		},
		{
			week: "Week 5-7",
			title: "Development",
			description:
				"Build your new website with all functionality including booking system, reviews integration, and contact forms.",
		},
		{
			week: "Week 8",
			title: "Content & SEO",
			description:
				"Finalize all page content, implement SEO optimizations, and set up Google Analytics and Search Console.",
		},
		{
			week: "Week 9",
			title: "Testing & Training",
			description:
				"Comprehensive testing across all devices. Training session on how to manage your new website.",
		},
		{
			week: "Week 10",
			title: "Launch & Support",
			description:
				"Go live with your new website. We'll monitor performance and make any necessary adjustments.",
		},
	],

	closingContent: `**Why Choose Plentify Web Designs?**

We specialize in websites for trade businesses. We understand that you need a website that generates leads while you're on the tools, not just a pretty brochure.

**Our Guarantee:**
• If your new website doesn't generate more leads than your current site within 90 days, we'll work for free until it does
• 12 months of priority support included
• No hidden fees - the price you see is the price you pay

**Ready to Transform Your Online Presence?**

Every week without a modern website is costing you customers. Let's have a quick call to discuss how we can help Murray's Plumbing dominate online.

Click "Accept Proposal" below to get started, or "Request Changes" if you'd like to discuss any modifications.`,

	nextSteps: [
		{ text: "Sign contract and pay 50% deposit", completed: false },
		{ text: "Complete website questionnaire (15 mins)", completed: false },
		{ text: "Provide logo files and brand guidelines", completed: false },
		{ text: "Share login details for current hosting", completed: false },
		{ text: "Schedule kickoff call", completed: false },
		{ text: "Review and approve designs", completed: false },
		{ text: "Provide content/photos for team page", completed: false },
		{ text: "Final review before launch", completed: false },
	],

	consultationPainPoints: {
		primary_challenges: [
			"Not getting enough leads from website",
			"Competitors ranking higher on Google",
			"Website looks outdated and unprofessional",
		],
		technical_issues: [
			"Site is slow and crashes on mobile",
			"Contact form not working properly",
			"Can't update content ourselves",
		],
		solution_gaps: [
			"No online booking system",
			"No way to showcase reviews",
			"Missing emergency contact options",
		],
	},

	consultationGoals: {
		primary_goals: [
			"Generate more leads online",
			"Rank on first page of Google",
			"Look more professional than competitors",
		],
		secondary_goals: [
			"Reduce phone calls for basic questions",
			"Showcase our 15 years of experience",
			"Enable online booking for non-emergency jobs",
		],
		success_metrics: [
			"50+ new leads per month",
			'Top 3 ranking for "plumber Brisbane"',
			"90+ Google PageSpeed score",
		],
	},

	consultationChallenges: [
		"Current website is 8 years old and built on outdated technology",
		"Lost 3 large commercial contracts to competitors with better websites",
		"Spending $2000/month on Google Ads with poor landing page conversion",
		"Staff spending 2+ hours daily answering basic questions that could be on website",
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

async function seedDemoData() {
	const userEmail = process.argv[2];

	if (!userEmail) {
		console.error("Usage: npx tsx scripts/seed-demo-data.ts <user-email>");
		console.error("Example: npx tsx scripts/seed-demo-data.ts ben@plentify.au");
		process.exit(1);
	}

	console.log("Connecting to database...");

	// Use environment variables if available, fallback to localhost defaults
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
		console.log(`\nLooking for user: ${userEmail}...`);
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
			console.log("   To re-seed, please delete the existing agency first.");

			// Check if there's a proposal already
			const [existingProposal] = await db
				.select()
				.from(proposals)
				.where(eq(proposals.id, PROPOSAL_ID))
				.limit(1);

			if (existingProposal) {
				console.log(`   Proposal already exists: /p/${existingProposal.slug}`);
			}

			process.exit(0);
		}

		// 3. Create the agency
		console.log("\nCreating agency...");
		await db.insert(agencies).values({
			id: AGENCY_ID,
			...agencyData,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		console.log(`✓ Created agency: ${agencyData.name}`);

		// 4. Create agency profile
		console.log("Creating agency profile...");
		await db.insert(agencyProfiles).values({
			id: AGENCY_PROFILE_ID,
			agencyId: AGENCY_ID,
			...agencyProfileData,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		console.log("✓ Created agency profile");

		// 5. Create agency membership (owner)
		console.log("Creating membership...");
		await db.insert(agencyMemberships).values({
			id: MEMBERSHIP_ID,
			userId: user.id,
			agencyId: AGENCY_ID,
			role: "owner",
			displayName: "",
			status: "active",
			acceptedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		console.log("✓ Created owner membership");

		// 6. Update user's default agency
		await db.update(users).set({ defaultAgencyId: AGENCY_ID }).where(eq(users.id, user.id));
		console.log("✓ Set default agency for user");

		// 7. Create packages
		console.log("\nCreating packages...");
		for (const pkg of packagesData) {
			await db.insert(agencyPackages).values({
				...pkg,
				agencyId: AGENCY_ID,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log(`  ✓ ${pkg.name}`);
		}

		// 8. Create addons
		console.log("\nCreating add-ons...");
		for (const addon of addonsData) {
			await db.insert(agencyAddons).values({
				...addon,
				agencyId: AGENCY_ID,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log(`  ✓ ${addon.name}`);
		}

		// 9. Create the proposal
		console.log("\nCreating proposal...");
		const proposalSlug = "murrays-plumbing-" + Date.now().toString(36);

		await db.insert(proposals).values({
			id: PROPOSAL_ID,
			agencyId: AGENCY_ID,
			proposalNumber: "PROP-2025-0001",
			slug: proposalSlug,
			status: "draft",
			...proposalData,
			selectedPackageId: HYBRID_PACKAGE_ID,
			selectedAddons: [SEO_ADDON_ID],
			validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			viewCount: 0,
			createdBy: user.id,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		console.log("✓ Created proposal");

		// Success summary
		console.log("\n" + "=".repeat(60));
		console.log("✅ DEMO DATA SEEDED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log("\nAgency Details:");
		console.log(`  Name: ${agencyData.name}`);
		console.log(`  Slug: ${agencyData.slug}`);
		console.log(`  URL: https://app.webkit.au/${agencyData.slug}`);
		console.log("\nPackages:");
		packagesData.forEach((pkg) => {
			console.log(`  - ${pkg.name} (${pkg.pricingModel})`);
		});
		console.log("\nProposal:");
		console.log(`  Client: ${proposalData.clientBusinessName}`);
		console.log(`  URL: https://app.webkit.au/p/${proposalSlug}`);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Error seeding data:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

seedDemoData();
