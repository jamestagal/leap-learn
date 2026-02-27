/**
 * Seed Contract Script
 *
 * Creates a contract for Murray's Plumbing linked to the existing proposal.
 * The contract includes realistic terms, services description, and is ready for signing.
 *
 * Run with: npx tsx scripts/seed-contract.ts <agency-slug>
 * Example: npx tsx scripts/seed-contract.ts plentify
 *
 * Prerequisites:
 *   - Agency must exist (run seed-demo-data.ts first)
 *   - Proposal must exist (run seed-proposal.ts first)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc } from "drizzle-orm";
import {
	pgTable,
	uuid,
	text,
	jsonb,
	timestamp,
	varchar,
	integer,
	decimal,
	boolean,
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
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
});

const agencyProfiles = pgTable("agency_profiles", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	nextContractNumber: integer("next_contract_number").notNull().default(1),
	contractPrefix: varchar("contract_prefix", { length: 20 }).notNull().default("CON"),
	defaultPaymentTerms: varchar("default_payment_terms", { length: 50 }).notNull().default("NET_14"),
	gstRegistered: boolean("gst_registered").notNull().default(true),
	gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),
	legalEntityName: text("legal_entity_name").notNull().default(""),
	tradingName: text("trading_name").notNull().default(""),
	addressLine1: text("address_line_1").notNull().default(""),
	city: varchar("city", { length: 100 }).notNull().default(""),
	state: varchar("state", { length: 50 }).notNull().default(""),
	postcode: varchar("postcode", { length: 20 }).notNull().default(""),
});

const proposals = pgTable("proposals", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	proposalNumber: varchar("proposal_number", { length: 50 }).notNull(),
	slug: varchar("slug", { length: 100 }).notNull().unique(),
	status: varchar("status", { length: 50 }).notNull().default("draft"),
	clientBusinessName: text("client_business_name").notNull().default(""),
	clientContactName: text("client_contact_name").notNull().default(""),
	clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),
	clientPhone: varchar("client_phone", { length: 50 }).notNull().default(""),
	selectedPackageId: uuid("selected_package_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const agencyPackages = pgTable("agency_packages", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	description: text("description").notNull().default(""),
	pricingModel: varchar("pricing_model", { length: 50 }).notNull(),
	setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
	monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
	oneTimePrice: decimal("one_time_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
	minimumTermMonths: integer("minimum_term_months").notNull().default(12),
	includedFeatures: jsonb("included_features").notNull().default([]),
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
	generatedCoverHtml: text("generated_cover_html"),
	generatedTermsHtml: text("generated_terms_html"),
	generatedScheduleHtml: text("generated_schedule_html"),
	validUntil: timestamp("valid_until", { withTimezone: true }),
	agencySignatoryName: varchar("agency_signatory_name", { length: 255 }),
	agencySignatoryTitle: varchar("agency_signatory_title", { length: 100 }),
	agencySignedAt: timestamp("agency_signed_at", { withTimezone: true }),
	clientSignatoryName: varchar("client_signatory_name", { length: 255 }),
	clientSignatoryTitle: varchar("client_signatory_title", { length: 100 }),
	clientSignedAt: timestamp("client_signed_at", { withTimezone: true }),
	viewCount: integer("view_count").notNull().default(0),
	sentAt: timestamp("sent_at", { withTimezone: true }),
	visibleFields: jsonb("visible_fields")
		.notNull()
		.default([
			"services",
			"commencementDate",
			"completionDate",
			"price",
			"paymentTerms",
			"specialConditions",
		]),
	includedScheduleIds: jsonb("included_schedule_ids").notNull().default([]),
	createdBy: uuid("created_by"),
});

// ============================================================================
// CONTRACT DATA FOR MURRAY'S PLUMBING
// ============================================================================

const CONTRACT_ID = "ffffffff-6666-6666-6666-111111111111";

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedContract() {
	const agencySlug = process.argv[2];

	if (!agencySlug) {
		console.error("Usage: npx tsx scripts/seed-contract.ts <agency-slug>");
		console.error("Example: npx tsx scripts/seed-contract.ts plentify");
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

		// 2. Get agency profile for contract number
		const [profile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, agency.id))
			.limit(1);

		// 3. Find the most recent Murray's Plumbing proposal
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

		if (!proposal) {
			console.error(`\n❌ No Murray's Plumbing proposal found.`);
			console.error("Please run seed-proposal.ts first.");
			process.exit(1);
		}

		console.log(`✓ Found proposal: ${proposal.proposalNumber}`);

		// 4. Get the selected package if any
		let selectedPackage = null;
		if (proposal.selectedPackageId) {
			[selectedPackage] = await db
				.select()
				.from(agencyPackages)
				.where(eq(agencyPackages.id, proposal.selectedPackageId))
				.limit(1);

			if (selectedPackage) {
				console.log(`✓ Found package: ${selectedPackage.name}`);
			}
		}

		// 5. Check if contract already exists
		const [existingContract] = await db
			.select()
			.from(contracts)
			.where(eq(contracts.id, CONTRACT_ID))
			.limit(1);

		if (existingContract) {
			console.log(`\n⚠️  Contract already exists with ID: ${CONTRACT_ID}`);
			console.log(`   Contract Number: ${existingContract.contractNumber}`);
			console.log(`   Status: ${existingContract.status}`);
			process.exit(0);
		}

		// 6. Find the user
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.defaultAgencyId, agency.id))
			.limit(1);

		// 7. Generate contract number
		const contractNumber = profile
			? `${profile.contractPrefix}-${new Date().getFullYear()}-${String(profile.nextContractNumber).padStart(4, "0")}`
			: `CON-${new Date().getFullYear()}-0001`;

		// 8. Calculate pricing
		let totalPrice = 0;
		let paymentTermsText = "";

		if (selectedPackage) {
			const setupFee = parseFloat(selectedPackage.setupFee) || 0;
			const monthlyPrice = parseFloat(selectedPackage.monthlyPrice) || 0;
			const oneTimePrice = parseFloat(selectedPackage.oneTimePrice) || 0;
			const minimumTerm = selectedPackage.minimumTermMonths || 12;

			if (selectedPackage.pricingModel === "lump_sum") {
				totalPrice = oneTimePrice;
				paymentTermsText = `Total project cost: $${oneTimePrice.toLocaleString()} (inc. GST)

Payment Schedule:
• 50% deposit ($${(oneTimePrice / 2).toLocaleString()}) due upon contract signing
• 50% final payment ($${(oneTimePrice / 2).toLocaleString()}) due upon project completion

Payment Methods:
• Bank Transfer: BSB 064-000, Account: 12345678
• Credit Card: Visa, Mastercard (2.5% surcharge applies)`;
			} else if (selectedPackage.pricingModel === "hybrid") {
				totalPrice = setupFee + monthlyPrice * minimumTerm;
				paymentTermsText = `Setup Fee: $${setupFee.toLocaleString()} (inc. GST) - due upon contract signing
Monthly Retainer: $${monthlyPrice.toLocaleString()}/month (inc. GST)
Minimum Term: ${minimumTerm} months
Total Minimum Contract Value: $${totalPrice.toLocaleString()} (inc. GST)

Payment Schedule:
• Setup fee due upon contract signing
• Monthly payments due on the 1st of each month
• First monthly payment due 30 days after project launch

Payment Methods:
• Direct Debit (preferred)
• Bank Transfer: BSB 064-000, Account: 12345678
• Credit Card: Visa, Mastercard (2.5% surcharge applies)`;
			} else {
				totalPrice = monthlyPrice * minimumTerm;
				paymentTermsText = `Monthly Subscription: $${monthlyPrice.toLocaleString()}/month (inc. GST)
Minimum Term: ${minimumTerm} months
Total Minimum Contract Value: $${totalPrice.toLocaleString()} (inc. GST)

Payment Schedule:
• Monthly payments due on the 1st of each month via Direct Debit
• First payment due upon contract signing

Payment Methods:
• Direct Debit (required for subscription)`;
			}
		} else {
			totalPrice = 4950;
			paymentTermsText = "Payment terms to be confirmed.";
		}

		// 9. Generate services description
		const servicesDescription = selectedPackage
			? `## Website Design & Development Services

### Package: ${selectedPackage.name}
${selectedPackage.description}

### Included Services:
${(selectedPackage.includedFeatures as string[]).map((f) => `- ${f}`).join("\n")}

### Project Scope:
1. **Discovery & Strategy Phase**
   - Business requirements analysis
   - Competitor research
   - Site architecture planning
   - Content strategy development

2. **Design Phase**
   - Custom homepage design
   - Service page templates
   - Mobile-first responsive design
   - Design revisions (up to 2 rounds)

3. **Development Phase**
   - WordPress/Custom development
   - Contact form integration
   - Google Analytics setup
   - Speed optimization
   - Security implementation (SSL)

4. **Content & SEO Phase**
   - On-page SEO optimization
   - Meta descriptions and titles
   - Schema markup for local business
   - Google Business Profile integration

5. **Launch & Training**
   - Website deployment
   - 1-hour training session
   - Documentation and guides
   - 30-day launch support

### Deliverables:
- Fully functional responsive website
- Admin access for content updates
- Google Analytics dashboard
- Performance optimization report
- Training documentation`
			: `## Website Design & Development Services

Custom website design and development services for Murray's Plumbing.
Full scope to be defined based on proposal specifications.`;

		// 10. Calculate dates
		const commencementDate = new Date();
		commencementDate.setDate(commencementDate.getDate() + 7); // Start in 1 week

		const completionDate = new Date(commencementDate);
		completionDate.setDate(completionDate.getDate() + 70); // 10 weeks from start

		const validUntil = new Date();
		validUntil.setDate(validUntil.getDate() + 14); // Valid for 14 days

		// 11. Generate contract slug
		const contractSlug = "murrays-plumbing-contract-" + Date.now().toString(36);

		// 12. Special conditions for plumbing business
		const specialConditions = `## Additional Terms for Murray's Plumbing

### Project-Specific Requirements:
1. **Emergency Banner**: Homepage must feature a prominent 24/7 emergency contact banner
2. **Service Areas**: Dedicated location pages for Brisbane CBD, Northside, Southside, and Western Suburbs
3. **Reviews Integration**: Google Reviews widget displaying current 4.8-star rating
4. **Online Booking**: Integration with booking system for non-emergency appointments

### Client Responsibilities:
1. Provide high-resolution logo files within 5 business days of signing
2. Supply team photos and project images for gallery
3. Provide content for 'About Us' section including company history
4. Review and approve designs within 5 business days of submission
5. Provide access to current hosting and domain registrar

### Performance Guarantee:
The completed website will achieve:
- Google PageSpeed mobile score of 90+
- Full mobile responsiveness
- WCAG 2.1 AA accessibility compliance
- SSL/HTTPS security

### Post-Launch Support:
- 30 days of priority bug fixes at no additional cost
- Monthly performance reports for first 3 months
- Quarterly SEO ranking reports

### Domain & Hosting:
- Client retains ownership of murraysplumbing.com.au domain
- Hosting included as per selected package
- Annual domain renewal is client's responsibility`;

		// 13. Create the contract
		console.log("\nCreating contract for Murray's Plumbing...");

		await db.insert(contracts).values({
			id: CONTRACT_ID,
			agencyId: agency.id,
			proposalId: proposal.id,
			contractNumber,
			slug: contractSlug,
			version: 1,
			status: "draft",
			clientBusinessName: proposal.clientBusinessName,
			clientContactName: proposal.clientContactName,
			clientEmail: proposal.clientEmail,
			clientPhone: proposal.clientPhone,
			clientAddress: "42 Trade Street\nEight Mile Plains QLD 4113",
			servicesDescription,
			commencementDate,
			completionDate,
			specialConditions,
			totalPrice: totalPrice.toFixed(2),
			priceIncludesGst: true,
			paymentTerms: paymentTermsText,
			validUntil,
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
			createdBy: user?.id || null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// 14. Update next contract number in profile
		if (profile) {
			await db
				.update(agencyProfiles)
				.set({ nextContractNumber: (profile.nextContractNumber || 1) + 1 })
				.where(eq(agencyProfiles.id, profile.id));
		}

		// Success!
		console.log("\n" + "=".repeat(60));
		console.log("✅ CONTRACT SEEDED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log("\nContract Details:");
		console.log(`  ID: ${CONTRACT_ID}`);
		console.log(`  Number: ${contractNumber}`);
		console.log(`  Client: ${proposal.clientBusinessName}`);
		console.log(`  Status: draft (ready to send)`);
		console.log(`  Total Value: $${totalPrice.toLocaleString()} (inc. GST)`);
		console.log(`  Commencement: ${commencementDate.toLocaleDateString()}`);
		console.log(`  Completion: ${completionDate.toLocaleDateString()}`);
		console.log(`  Valid Until: ${validUntil.toLocaleDateString()}`);
		console.log(`\nView at:`);
		console.log(`  Admin: https://app.webkit.au/${agencySlug}/contracts`);
		console.log(`  Public: https://app.webkit.au/c/${contractSlug}`);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Error seeding contract:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

// Export for use by master script
export const MURRAYS_CONTRACT_ID = CONTRACT_ID;

seedContract();
