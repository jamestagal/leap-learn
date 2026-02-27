/**
 * Seed Consultation Script
 *
 * Creates a comprehensive Murray's Plumbing consultation with realistic data.
 * This consultation can then be linked to proposals.
 *
 * Run with: npx tsx scripts/seed-consultation.ts <agency-slug>
 * Example: npx tsx scripts/seed-consultation.ts plentify
 *
 * Returns the consultation ID for use by other seed scripts.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq } from "drizzle-orm";
import { pgTable, uuid, text, jsonb, timestamp, varchar, integer } from "drizzle-orm/pg-core";

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
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
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

// ============================================================================
// MURRAY'S PLUMBING CONSULTATION DATA
// ============================================================================

const consultationData = {
	// Contact Information - Rich client profile
	contactInfo: {
		business_name: "Murrays Plumbing",
		contact_person: "Steve Murray",
		email: "steve@murraysplumbing.com.au",
		phone: "0412 345 678",
		website: "https://murraysplumbing.com.au",
		social_media: {
			facebook: "facebook.com/murraysplumbing",
			instagram: "@murrays_plumbing_brisbane",
			google_business: "Murrays Plumbing Brisbane",
		},
	},

	// Business Context - Detailed business background
	businessContext: {
		industry: "trades_services",
		business_type: "established_business",
		team_size: 8,
		years_in_business: 15,
		annual_revenue: "$800,000 - $1,200,000",
		current_platform: "WordPress (outdated theme)",
		platform_age_years: 8,
		service_areas: ["Brisbane CBD", "Northside", "Southside", "Western Suburbs", "Ipswich"],
		digital_presence: ["website", "google_business", "facebook", "instagram"],
		marketing_channels: ["google_ads", "word_of_mouth", "vehicle_signage", "local_sponsorships"],
		competitors: ["Brisbane Plumbing Co", "Jet Plumbing", "Salmon Plumbing"],
		unique_selling_points: [
			"15 years local experience",
			"24/7 emergency service",
			"Licensed gas fitter",
			"Family-owned business",
			"4.8 star Google rating (127 reviews)",
		],
		services_offered: [
			"Emergency plumbing",
			"Hot water system installation & repairs",
			"Blocked drains & drain cleaning",
			"Gas fitting & gas leak detection",
			"Bathroom renovations",
			"Commercial plumbing maintenance",
			"Backflow prevention testing",
			"Water leak detection",
		],
	},

	// Pain Points - Detailed challenges
	painPoints: {
		primary_challenges: [
			"Not getting enough leads from website - currently only 5-10 per month",
			"Competitors ranking higher on Google for key search terms",
			"Website looks outdated and unprofessional compared to competitors",
			"Spending $2,000/month on Google Ads with 2% conversion rate",
			"Losing potential commercial contracts due to poor online presence",
		],
		technical_issues: [
			"Site takes 6+ seconds to load on mobile devices",
			"Contact form submissions often go to spam folder",
			"Cannot update content ourselves - need to pay developer each time",
			"Website crashes when traffic spikes during emergencies",
			"Images are not optimized - homepage is 4MB+",
			'No SSL certificate - shows "Not Secure" warning',
		],
		urgency_level: "high",
		impact_assessment:
			"Estimating $18,000-$27,000 in lost monthly revenue due to website issues. Lost 3 large commercial contracts ($15,000+) in past 6 months to competitors with better websites. Staff spending 2+ hours daily answering questions that should be on website.",
		current_solution_gaps: [
			"No online booking system - must call during business hours only",
			"No way to showcase 127 Google reviews on website",
			"Missing emergency contact button - buried in footer",
			"No service area pages for local SEO",
			"No way to display before/after project photos",
			"Cannot accept online payments for deposits",
		],
		competitor_comparison:
			"Main competitors (Brisbane Plumbing Co, Jet Plumbing) have modern, fast-loading sites with online booking, prominent reviews, and rank on page 1 for key terms. We are stuck on page 2-3.",
		failed_previous_solutions: [
			"Tried DIY Wix site in 2019 - too limited, abandoned",
			"Hired freelancer in 2021 - disappeared mid-project",
			"Used Yelp advertising - poor ROI ($400 spend, 2 leads)",
		],
	},

	// Goals & Objectives - Comprehensive targets
	goalsObjectives: {
		primary_goals: [
			"Generate 50+ qualified leads per month from website",
			'Rank on first page of Google for "plumber Brisbane" and related terms',
			"Look more professional than top 3 competitors",
			"Reduce dependency on paid advertising over time",
		],
		secondary_goals: [
			"Reduce phone calls for basic questions (pricing, service areas, hours)",
			"Showcase 15 years of experience and trusted reputation",
			"Enable online booking for non-emergency jobs",
			"Build email list for seasonal maintenance reminders",
			"Display portfolio of completed projects",
		],
		success_metrics: [
			"50+ new leads per month within 6 months",
			'Top 3 ranking for "emergency plumber Brisbane"',
			"90+ Google PageSpeed score",
			"5% conversion rate on website traffic",
			"Reduce Google Ads spend by 50% while maintaining leads",
		],
		kpis: [
			"Monthly website leads",
			"Google search ranking positions",
			"Website conversion rate",
			"Cost per lead",
			"Online booking adoption rate",
			"Average time on site",
		],
		timeline: {
			desired_start: "As soon as possible",
			target_completion: "Within 10 weeks",
			key_dates: "Want to be live before winter (peak hot water season)",
			milestones: [
				"Design approval within 2 weeks",
				"Development complete within 6 weeks",
				"Content and SEO within 8 weeks",
				"Launch and training within 10 weeks",
			],
		},
		budget_range: "$5,000 - $10,000",
		budget_constraints: [
			"Prefer lower upfront with monthly payments over lump sum",
			"Need to see clear ROI justification",
			"Open to higher investment if value is demonstrated",
			"Monthly ongoing costs must be under $300",
		],
		decision_makers: [
			"Steve Murray (Owner) - Final decision",
			"Karen Murray (Office Manager) - Input on booking/admin features",
		],
		decision_timeline: "Ready to proceed within 1-2 weeks if proposal is right",
	},
};

// ============================================================================
// SEED FUNCTION
// ============================================================================

// Predefined consultation ID for consistency across seed scripts
const CONSULTATION_ID = "eeeeeeee-5555-5555-5555-111111111111";

async function seedConsultation() {
	const agencySlug = process.argv[2];

	if (!agencySlug) {
		console.error("Usage: npx tsx scripts/seed-consultation.ts <agency-slug>");
		console.error("Example: npx tsx scripts/seed-consultation.ts plentify");
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
			console.error("Please create your agency through the UI first or run seed-demo-data.ts.");
			process.exit(1);
		}

		console.log(`✓ Found agency: ${agency.name} (${agency.id})`);

		// 2. Find the first user with this agency
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.defaultAgencyId, agency.id))
			.limit(1);

		if (!user) {
			console.error(`\n❌ No user found associated with agency: ${agencySlug}`);
			console.error("Please ensure a user is set up with this agency.");
			process.exit(1);
		}

		console.log(`✓ Found user: ${user.email}`);

		// 3. Check if consultation already exists
		const [existingConsultation] = await db
			.select()
			.from(consultations)
			.where(eq(consultations.id, CONSULTATION_ID))
			.limit(1);

		if (existingConsultation) {
			console.log(`\n⚠️  Consultation already exists with ID: ${CONSULTATION_ID}`);
			console.log(
				`   Client: ${(existingConsultation.contactInfo as Record<string, string>).business_name || "Unknown"}`,
			);
			console.log("\n   Use this ID to link proposals: " + CONSULTATION_ID);
			process.exit(0);
		}

		// 4. Create the consultation
		console.log("\nCreating Murray's Plumbing consultation...");

		await db.insert(consultations).values({
			id: CONSULTATION_ID,
			userId: user.id,
			agencyId: agency.id,
			contactInfo: consultationData.contactInfo,
			businessContext: consultationData.businessContext,
			painPoints: consultationData.painPoints,
			goalsObjectives: consultationData.goalsObjectives,
			status: "completed",
			completionPercentage: 100,
			createdAt: new Date(),
			updatedAt: new Date(),
			completedAt: new Date(),
		});

		// Success!
		console.log("\n" + "=".repeat(60));
		console.log("✅ CONSULTATION SEEDED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log("\nConsultation Details:");
		console.log(`  ID: ${CONSULTATION_ID}`);
		console.log(`  Client: ${consultationData.contactInfo.business_name}`);
		console.log(`  Contact: ${consultationData.contactInfo.contact_person}`);
		console.log(`  Status: completed`);
		console.log("\nBusiness Context:");
		console.log(`  Industry: ${consultationData.businessContext.industry}`);
		console.log(`  Team Size: ${consultationData.businessContext.team_size} employees`);
		console.log(`  Years in Business: ${consultationData.businessContext.years_in_business}`);
		console.log("\nPain Points:");
		consultationData.painPoints.primary_challenges.slice(0, 3).forEach((challenge) => {
			console.log(`  • ${challenge}`);
		});
		console.log("\nGoals:");
		consultationData.goalsObjectives.primary_goals.slice(0, 3).forEach((goal) => {
			console.log(`  • ${goal}`);
		});
		console.log("\nUse this ID to create linked proposal:");
		console.log(
			`  npx tsx scripts/seed-proposal.ts ${agencySlug} --consultation ${CONSULTATION_ID}`,
		);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Error seeding consultation:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

// Export for use by master script
export const MURRAYS_CONSULTATION_ID = CONSULTATION_ID;
export const murraysConsultationData = consultationData;

seedConsultation();
