/**
 * Seed Questionnaire Response Script
 *
 * Creates a completed Initial Website Questionnaire for Murray's Plumbing.
 * This comprehensive 39-field questionnaire covers all 8 sections:
 * 1. Business Overview
 * 2. Brand Identity
 * 3. Current Website (if any)
 * 4. Website Goals
 * 5. Content & Features
 * 6. Design Preferences
 * 7. Technical Requirements
 * 8. Project Timeline & Budget
 *
 * Run with: npx tsx scripts/seed-questionnaire.ts <agency-slug>
 * Example: npx tsx scripts/seed-questionnaire.ts plentify
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc } from "drizzle-orm";
import { pgTable, uuid, text, jsonb, timestamp, varchar, integer } from "drizzle-orm/pg-core";

// ============================================================================
// SCHEMA DEFINITIONS (Minimal for seeding)
// ============================================================================

const agencies = pgTable("agencies", {
	id: uuid("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
});

const contracts = pgTable("contracts", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	contractNumber: varchar("contract_number", { length: 50 }).notNull(),
	clientBusinessName: text("client_business_name").notNull().default(""),
	status: varchar("status", { length: 50 }).notNull().default("draft"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const proposals = pgTable("proposals", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	proposalNumber: varchar("proposal_number", { length: 50 }).notNull(),
	clientBusinessName: text("client_business_name").notNull().default(""),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

// ============================================================================
// COMPREHENSIVE QUESTIONNAIRE DATA FOR MURRAY'S PLUMBING
// ============================================================================

const QUESTIONNAIRE_ID = "99999999-7777-7777-7777-111111111111";

const questionnaireData = {
	// -------------------------------------------------------------------------
	// Section 1: Business Overview
	// -------------------------------------------------------------------------
	business_name: "Murrays Plumbing",
	business_tagline: "Brisbane's Most Trusted Plumber Since 2010",
	business_description: `Murray's Plumbing is a family-owned plumbing business serving the Greater Brisbane area for over 15 years. Founded by Steve Murray, a third-generation plumber, we specialize in residential and commercial plumbing services.

Our team of 8 licensed plumbers provides 24/7 emergency services, hot water system installations, blocked drain clearing, gas fitting, and bathroom renovations. We're known for our reliability, transparent pricing, and exceptional customer service.

With over 127 five-star Google reviews and a 4.8 rating, we've built our reputation on doing the job right the first time. We're licensed, fully insured, and committed to providing Brisbane families with honest, quality plumbing services.`,
	years_in_business: "15",
	number_of_employees: "8",
	target_audience: `Our primary customers are:
- Homeowners in Brisbane suburbs (ages 35-65)
- Property managers and real estate agencies
- Small to medium commercial businesses
- Body corporates and strata managers

Key demographics:
- Middle to upper-middle income households
- Families with established homes (10+ years old)
- Property investors with rental portfolios
- Commercial property owners needing maintenance contracts`,
	unique_selling_points: `What sets Murray's Plumbing apart:
1. 24/7 Emergency Response - Average arrival time under 45 minutes
2. 15 Years Local Experience - We know Brisbane plumbing inside out
3. Transparent Pricing - No hidden fees, upfront quotes before any work
4. Licensed Gas Fitters - Full gas fitting services under one roof
5. Family Values - We treat your home like our own
6. Warranty Guarantee - All work backed by 12-month warranty`,
	main_services: [
		"Emergency plumbing (24/7)",
		"Hot water system installation and repairs",
		"Blocked drain clearing and CCTV inspection",
		"Gas fitting and gas leak detection",
		"Bathroom renovations and remodelling",
		"Commercial plumbing maintenance",
		"Backflow prevention and testing",
		"Water leak detection and repair",
		"Tap and toilet repairs",
		"Rainwater tank installation",
	],
	service_areas:
		"Greater Brisbane including: Brisbane CBD, Northside (Chermside, Aspley, Albany Creek, Strathpine), Southside (Eight Mile Plains, Sunnybank, Carindale, Cleveland), Western Suburbs (Indooroopilly, Kenmore, Chapel Hill), and Ipswich region.",

	// -------------------------------------------------------------------------
	// Section 2: Brand Identity
	// -------------------------------------------------------------------------
	existing_logo: "yes",
	logo_satisfaction: "satisfied_minor_updates",
	brand_colors: `Current brand colors:
- Primary Blue: #0066CC (trustworthy, professional)
- Accent Orange: #FF6600 (emergency, action)
- White: #FFFFFF (clean, fresh)
- Dark Grey: #333333 (text, professionalism)

We'd like to keep these colors as they're on our vehicles, uniforms, and signage.`,
	brand_personality: `Our brand personality is:
- Trustworthy and reliable - we show up when we say we will
- Professional but approachable - expert knowledge without the jargon
- Family-oriented - we care about the community we serve
- Responsive - we're there when you need us most
- Honest - transparent pricing with no surprises`,
	competitors_to_reference: `Competitors with websites we like:
1. Brisbane Plumbing Co (brisbaneplumbing.com.au) - Clean layout, good service pages
2. Fallon Solutions (fallonsolutions.com.au) - Professional imagery, clear CTAs
3. Salmon Plumbing (salmonplumbing.com.au) - Good mobile experience

What we like: Clear emergency buttons, service area maps, before/after galleries`,
	brand_tone_of_voice: "friendly_professional",
	existing_brand_assets: `We have the following brand assets to provide:
- High-resolution logo (AI, EPS, PNG formats)
- Vehicle wrap designs (shows our color scheme)
- Team photos (8 staff members)
- Before/after project photos (50+ projects)
- Customer testimonial videos (3 videos)
- Current brochures and business cards`,

	// -------------------------------------------------------------------------
	// Section 3: Current Website
	// -------------------------------------------------------------------------
	has_current_website: "yes",
	current_website_url: "https://murraysplumbing.com.au",
	current_website_likes: `What we like about our current site:
- Our phone number is displayed
- Basic contact form works (sometimes)
- Google Maps showing location
- Some of our services are listed`,
	current_website_dislikes: `Major issues with current site:
- Extremely slow (6+ second load time)
- Not mobile friendly - text too small, buttons don't work
- Looks outdated - designed 8 years ago
- Contact form often fails or goes to spam
- Can't update content ourselves
- No online booking capability
- Reviews aren't displayed
- Images are blurry and unprofessional
- No SSL certificate ("Not Secure" warning)`,
	current_website_analytics: `Google Analytics data (last 12 months):
- Average monthly visitors: 450
- Bounce rate: 78%
- Average time on site: 45 seconds
- Mobile traffic: 73%
- Top traffic sources: Google (direct), Google Ads, Google Maps
- Conversion rate: Approximately 1.5% (very poor)

We're spending $2,000/month on Google Ads but getting poor results due to the landing page.`,
	domain_hosting_access: "yes",
	domain_hosting_details: `Domain: murraysplumbing.com.au
Registrar: Crazy Domains (we have login)
Current hosting: GoDaddy shared hosting
CMS: WordPress with outdated theme
Email: G Suite / Google Workspace

We have all logins and are happy to transfer to recommended hosting.`,

	// -------------------------------------------------------------------------
	// Section 4: Website Goals
	// -------------------------------------------------------------------------
	primary_website_goal: "lead_generation",
	secondary_website_goals: ["brand_awareness", "customer_support", "showcase_portfolio"],
	target_monthly_leads: "50+",
	success_metrics: `How we'll measure success:
1. Lead Volume: 50+ qualified leads per month (from current 5-10)
2. Search Rankings: Top 3 for "plumber Brisbane", "emergency plumber Brisbane"
3. Conversion Rate: 5%+ website conversion (from current 1.5%)
4. Page Speed: 90+ Google PageSpeed score
5. Phone Calls: 30% increase in calls from website
6. Online Bookings: 20+ non-emergency bookings per month
7. Review Generation: 10+ new Google reviews per month`,
	expected_user_actions: `Primary actions we want visitors to take:
1. Call our emergency hotline (especially after hours)
2. Submit a quote request form
3. Book a non-emergency appointment online
4. View our service areas and pricing guides
5. Read our Google reviews and testimonials
6. Learn about our services and expertise`,
	key_messages: `Key messages to communicate:
1. "24/7 Emergency Service - We're Always Here"
2. "15 Years of Trusted Brisbane Plumbing"
3. "4.8 Star Rating - 127+ Five-Star Reviews"
4. "Upfront Pricing - No Hidden Fees"
5. "Licensed, Insured, Guaranteed"
6. "Family-Owned, Community-Focused"`,

	// -------------------------------------------------------------------------
	// Section 5: Content & Features
	// -------------------------------------------------------------------------
	required_pages: [
		"Home",
		"About Us / Our Story",
		"Services (main hub)",
		"Emergency Plumbing",
		"Hot Water Systems",
		"Blocked Drains",
		"Gas Fitting",
		"Bathroom Renovations",
		"Commercial Plumbing",
		"Service Areas (Brisbane regions)",
		"Projects / Gallery",
		"Reviews & Testimonials",
		"Blog / Plumbing Tips",
		"Contact Us",
		"Book Online",
		"FAQ",
	],
	must_have_features: [
		"Click-to-call emergency button (sticky on mobile)",
		"Online booking/appointment system",
		"Contact form with service selection",
		"Google Reviews integration",
		"Live chat widget",
		"Service area map (interactive)",
		"Before/after project gallery",
		"Team member profiles",
		"Blog for SEO content",
		"FAQ section with schema markup",
		"SSL certificate",
		"Mobile-first responsive design",
	],
	nice_to_have_features: [
		"Customer portal for job history",
		"Video testimonials section",
		"Cost calculator / quote estimator",
		"Emergency SMS alerts signup",
		"Seasonal maintenance reminders",
		"Referral program signup",
		"Newsletter subscription",
	],
	content_provision: `Content we can provide:
- Company history and founder story
- Team bios and photos
- Service descriptions (need copywriting help)
- 50+ before/after project photos
- 3 video testimonials
- Full list of service areas
- Pricing guides for common services
- FAQ answers from common customer questions

We may need help with:
- SEO-optimized copywriting
- Service page content structure
- Blog article writing`,
	blog_requirements: `Blog/content needs:
- DIY plumbing tips (seasonal)
- "When to call a plumber" guides
- Cost guides for common services
- Emergency preparedness tips
- Water-saving advice
- Hot water system buying guides

Would like 2-4 articles ready at launch, with template for future posts.`,

	// -------------------------------------------------------------------------
	// Section 6: Design Preferences
	// -------------------------------------------------------------------------
	design_style_preference: "modern_professional",
	website_examples_liked: `Websites we like for inspiration:
1. fallonsolutions.com.au - Clean, professional, great imagery
2. oneflare.com.au/plumbers - Good search/filter functionality
3. dulux.com.au - Modern design, great use of color
4. jimsmowing.com.au - Simple, clear service areas`,
	design_elements_preferred: [
		"Large hero image with clear call-to-action",
		"Trust badges and certifications prominently displayed",
		"Google reviews widget in header/sidebar",
		"Interactive service area map",
		"Before/after image sliders",
		"Team photos showing real employees",
		"Clear pricing indicators",
		"Video content integration",
	],
	design_elements_to_avoid: [
		"Stock photos of generic plumbers",
		"Cluttered layouts with too much text",
		"Auto-playing background videos",
		"Pop-ups that block content immediately",
		"Tiny fonts or low contrast text",
		"Complicated navigation menus",
	],
	imagery_preferences: `Photography/imagery needs:
- Real photos of our team preferred over stock
- Before/after project images (we have many)
- Action shots of plumbers at work
- Brisbane landmarks for local relevance
- Clean, well-lit professional images

We have professional photos of:
- All 8 team members
- Company vehicles (wrapped with branding)
- 50+ completed projects`,
	mobile_importance: "10_critical",

	// -------------------------------------------------------------------------
	// Section 7: Technical Requirements
	// -------------------------------------------------------------------------
	cms_preference: "open_to_recommendation",
	cms_experience: "basic",
	integrations_required: [
		"Google Analytics 4",
		"Google Search Console",
		"Google Business Profile",
		"ServiceM8 or similar job management (future)",
		"Stripe for online deposits",
		"Live chat (Intercom or similar)",
		"Email marketing (Mailchimp)",
		"Google Calendar for bookings",
	],
	email_requirements: `Email setup:
Current: G Suite (Google Workspace)
- steve@murraysplumbing.com.au (owner)
- office@murraysplumbing.com.au (admin)
- info@murraysplumbing.com.au (general)

We're happy with G Suite and want to keep using it.`,
	security_requirements: `Security needs:
- SSL certificate (HTTPS required)
- Regular backups
- Spam protection on forms
- GDPR/Privacy compliance
- Secure booking system
- reCAPTCHA on contact forms`,
	accessibility_requirements:
		"WCAG 2.1 AA compliance where practical. Important as some older customers may have vision impairments.",
	performance_requirements: `Performance targets:
- Page load under 2 seconds
- Mobile-first optimization
- Google PageSpeed 90+
- Core Web Vitals pass
- Fast emergency button response`,

	// -------------------------------------------------------------------------
	// Section 8: Project Timeline & Budget
	// -------------------------------------------------------------------------
	ideal_launch_date: "Within 10 weeks (before winter hot water season)",
	hard_deadline: "Must be live by June 1st for hot water season",
	budget_range: "$5,000 - $10,000 for initial build",
	ongoing_budget: `Ongoing investment:
- Monthly hosting/maintenance: up to $200/month
- SEO/marketing: separate budget $500-1000/month (Phase 2)
- Content updates: ad-hoc as needed`,
	decision_makers: `Decision makers:
- Steve Murray (Owner) - Final decision, design approval
- Karen Murray (Office Manager) - Functionality requirements, booking system

Both will need to approve designs. Steve is primary contact.`,
	project_concerns: `Main concerns about the project:
1. Don't want to go through another failed web project
2. Need site to work perfectly on phones
3. Worried about SEO rankings during transition
4. Need easy way to update content ourselves
5. Don't want to be locked into expensive ongoing contracts`,
	additional_information: `Other important notes:
- We have strong relationships with several commercial clients who may want links to their sites
- Interested in future integrations with ServiceM8 job management
- Want to eventually add a customer portal for job history/invoices
- Open to recommendations on live chat providers
- Need clear training on how to update the site ourselves
- Would like quarterly check-ins after launch for first year

Looking forward to finally having a website that represents the quality of our work!`,
};

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedQuestionnaire() {
	const agencySlug = process.argv[2];

	if (!agencySlug) {
		console.error("Usage: npx tsx scripts/seed-questionnaire.ts <agency-slug>");
		console.error("Example: npx tsx scripts/seed-questionnaire.ts plentify");
		process.exit(1);
	}

	console.log("Connecting to database...");

	const pool = new Pool({
		host: process.env.POSTGRES_HOST || "localhost",
		port: parseInt(process.env.POSTGRES_PORT || "5432"),
		database: process.env.POSTGRES_DB || "postgres",
		user: process.env.POSTGRES_USER || "postgres",
		password: process.env.POSTGRES_PASSWORD || "postgres",
	});

	const db = drizzle(pool);

	try {
		// 1. Find the agency
		console.log(`\nLooking for agency: ${agencySlug}...`);
		const [agency] = await db.select().from(agencies).where(eq(agencies.slug, agencySlug)).limit(1);

		if (!agency) {
			console.error(`\n❌ Agency not found with slug: ${agencySlug}`);
			console.error("Please run seed-demo-data.ts first.");
			process.exit(1);
		}

		console.log(`✓ Found agency: ${agency.name} (${agency.id})`);

		// 2. Try to find a linked contract
		const [contract] = await db
			.select()
			.from(contracts)
			.where(
				and(
					eq(contracts.agencyId, agency.id),
					eq(contracts.clientBusinessName, "Murrays Plumbing"),
				),
			)
			.orderBy(desc(contracts.createdAt))
			.limit(1);

		if (contract) {
			console.log(`✓ Found contract to link: ${contract.contractNumber}`);
		}

		// 3. Try to find a linked proposal
		const [proposal] = await db
			.select()
			.from(proposals)
			.where(
				and(
					eq(proposals.agencyId, agency.id),
					eq(proposals.clientBusinessName, "Murrays Plumbing"),
				),
			)
			.orderBy(desc(proposals.createdAt))
			.limit(1);

		if (proposal) {
			console.log(`✓ Found proposal to link: ${proposal.proposalNumber}`);
		}

		// 4. Check if questionnaire already exists
		const [existingQuestionnaire] = await db
			.select()
			.from(questionnaireResponses)
			.where(eq(questionnaireResponses.id, QUESTIONNAIRE_ID))
			.limit(1);

		if (existingQuestionnaire) {
			console.log(`\n⚠️  Questionnaire already exists with ID: ${QUESTIONNAIRE_ID}`);
			console.log(`   Client: ${existingQuestionnaire.clientBusinessName}`);
			console.log(`   Status: ${existingQuestionnaire.status}`);
			process.exit(0);
		}

		// 5. Generate questionnaire slug
		const questionnaireSlug = "murrays-plumbing-questionnaire-" + Date.now().toString(36);

		// 6. Create the questionnaire
		console.log("\nCreating questionnaire for Murray's Plumbing...");

		await db.insert(questionnaireResponses).values({
			id: QUESTIONNAIRE_ID,
			agencyId: agency.id,
			slug: questionnaireSlug,
			contractId: contract?.id || null,
			proposalId: proposal?.id || null,
			consultationId: null,
			clientBusinessName: "Murrays Plumbing",
			clientEmail: "steve@murraysplumbing.com.au",
			responses: questionnaireData,
			currentSection: 8, // All sections complete
			completionPercentage: 100,
			status: "completed",
			startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Started 2 days ago
			completedAt: new Date(),
			lastActivityAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// Success!
		console.log("\n" + "=".repeat(60));
		console.log("✅ QUESTIONNAIRE SEEDED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log("\nQuestionnaire Details:");
		console.log(`  ID: ${QUESTIONNAIRE_ID}`);
		console.log(`  Client: Murrays Plumbing`);
		console.log(`  Status: completed (100%)`);
		console.log(`  Sections: 8 of 8 complete`);
		console.log(`  Total Fields: 39 responses`);
		if (contract) {
			console.log(`  Linked Contract: ${contract.contractNumber}`);
		}
		if (proposal) {
			console.log(`  Linked Proposal: ${proposal.proposalNumber}`);
		}
		console.log("\nSections Completed:");
		console.log("  1. Business Overview ✓");
		console.log("  2. Brand Identity ✓");
		console.log("  3. Current Website ✓");
		console.log("  4. Website Goals ✓");
		console.log("  5. Content & Features ✓");
		console.log("  6. Design Preferences ✓");
		console.log("  7. Technical Requirements ✓");
		console.log("  8. Project Timeline & Budget ✓");
		console.log(`\nView at:`);
		console.log(`  Admin: https://app.webkit.au/${agencySlug}/questionnaires`);
		console.log(`  Public: https://app.webkit.au/q/${questionnaireSlug}`);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Error seeding questionnaire:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

// Export for use by master script
export const MURRAYS_QUESTIONNAIRE_ID = QUESTIONNAIRE_ID;
export const murraysQuestionnaireData = questionnaireData;

seedQuestionnaire();
