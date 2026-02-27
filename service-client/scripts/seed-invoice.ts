/**
 * Seed Invoice Script
 *
 * Creates an invoice for Murray's Plumbing project.
 * This creates a deposit invoice linked to the proposal and contract.
 *
 * Run with: npx tsx scripts/seed-invoice.ts <agency-slug>
 * Example: npx tsx scripts/seed-invoice.ts plentify
 *
 * Prerequisites:
 *   - Agency must exist (run seed-demo-data.ts first)
 *   - Proposal should exist (run seed-proposal.ts first)
 *   - Contract should exist (run seed-contract.ts first)
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
	nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
	invoicePrefix: varchar("invoice_prefix", { length: 20 }).notNull().default("INV"),
	invoiceFooter: text("invoice_footer").notNull().default(""),
	defaultPaymentTerms: varchar("default_payment_terms", { length: 50 }).notNull().default("NET_14"),
	gstRegistered: boolean("gst_registered").notNull().default(true),
	gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),
	bankName: varchar("bank_name", { length: 100 }).notNull().default(""),
	bsb: varchar("bsb", { length: 10 }).notNull().default(""),
	accountNumber: varchar("account_number", { length: 30 }).notNull().default(""),
	accountName: text("account_name").notNull().default(""),
});

const proposals = pgTable("proposals", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	proposalNumber: varchar("proposal_number", { length: 50 }).notNull(),
	clientBusinessName: text("client_business_name").notNull().default(""),
	clientContactName: text("client_contact_name").notNull().default(""),
	clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),
	clientPhone: varchar("client_phone", { length: 50 }).notNull().default(""),
	selectedPackageId: uuid("selected_package_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const contracts = pgTable("contracts", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	proposalId: uuid("proposal_id").notNull(),
	contractNumber: varchar("contract_number", { length: 50 }).notNull(),
	clientBusinessName: text("client_business_name").notNull().default(""),
	clientAddress: text("client_address").notNull().default(""),
	totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const agencyPackages = pgTable("agency_packages", {
	id: uuid("id").primaryKey(),
	agencyId: uuid("agency_id").notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	pricingModel: varchar("pricing_model", { length: 50 }).notNull(),
	setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
	monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
	oneTimePrice: decimal("one_time_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
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
	lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
	sentAt: timestamp("sent_at", { withTimezone: true }),
	paidAt: timestamp("paid_at", { withTimezone: true }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: text("payment_reference"),
	paymentNotes: text("payment_notes"),
	pdfUrl: text("pdf_url"),
	stripePaymentLinkId: varchar("stripe_payment_link_id", { length: 255 }),
	stripePaymentLinkUrl: text("stripe_payment_link_url"),
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
// INVOICE DATA
// ============================================================================

const INVOICE_ID = "aaaaaaaa-8888-8888-8888-111111111111";

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedInvoice() {
	const agencySlug = process.argv[2];

	if (!agencySlug) {
		console.error("Usage: npx tsx scripts/seed-invoice.ts <agency-slug>");
		console.error("Example: npx tsx scripts/seed-invoice.ts plentify");
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

		// 2. Get agency profile for invoice settings
		const [profile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, agency.id))
			.limit(1);

		// 3. Find Murray's Plumbing proposal
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
			console.log(`✓ Found proposal: ${proposal.proposalNumber}`);
		}

		// 4. Find Murray's Plumbing contract
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
			console.log(`✓ Found contract: ${contract.contractNumber}`);
		}

		// 5. Get the selected package if any
		let selectedPackage = null;
		if (proposal?.selectedPackageId) {
			[selectedPackage] = await db
				.select()
				.from(agencyPackages)
				.where(eq(agencyPackages.id, proposal.selectedPackageId))
				.limit(1);

			if (selectedPackage) {
				console.log(`✓ Found package: ${selectedPackage.name}`);
			}
		}

		// 6. Check if invoice already exists
		const [existingInvoice] = await db
			.select()
			.from(invoices)
			.where(eq(invoices.id, INVOICE_ID))
			.limit(1);

		if (existingInvoice) {
			console.log(`\n⚠️  Invoice already exists with ID: ${INVOICE_ID}`);
			console.log(`   Invoice Number: ${existingInvoice.invoiceNumber}`);
			console.log(`   Status: ${existingInvoice.status}`);
			process.exit(0);
		}

		// 7. Find the user
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.defaultAgencyId, agency.id))
			.limit(1);

		// 8. Generate invoice number
		const invoiceNumber = profile
			? `${profile.invoicePrefix}-${new Date().getFullYear()}-${String(profile.nextInvoiceNumber).padStart(4, "0")}`
			: `INV-${new Date().getFullYear()}-0001`;

		// 9. Calculate pricing - this is a deposit invoice (50% of project)
		let depositAmount = 0;
		let packageName = "Website Design & Development";

		if (selectedPackage) {
			packageName = selectedPackage.name;
			if (selectedPackage.pricingModel === "lump_sum") {
				depositAmount = parseFloat(selectedPackage.oneTimePrice) / 2;
			} else if (selectedPackage.pricingModel === "hybrid") {
				// Setup fee is the deposit for hybrid
				depositAmount = parseFloat(selectedPackage.setupFee);
			} else {
				// First month for subscription
				depositAmount = parseFloat(selectedPackage.monthlyPrice);
			}
		} else {
			depositAmount = 2475; // Default 50% of $4950
		}

		const gstRate = profile ? parseFloat(profile.gstRate) : 10;
		const gstRegistered = profile ? profile.gstRegistered : true;

		// Calculate GST-exclusive amount for invoice calculations
		// Prices are GST-inclusive, so we need to back-calculate
		const subtotalExGst = depositAmount / (1 + gstRate / 100);
		const gstAmount = depositAmount - subtotalExGst;

		// 10. Create dates
		const issueDate = new Date();
		const dueDate = new Date();
		dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days for deposit

		// 11. Generate invoice slug
		const invoiceSlug = "murrays-plumbing-deposit-" + Date.now().toString(36);

		// 12. Build public notes with payment details
		const publicNotes = profile?.bankName
			? `## Payment Details

**Bank Transfer:**
Bank: ${profile.bankName}
BSB: ${profile.bsb}
Account: ${profile.accountNumber}
Account Name: ${profile.accountName}
Reference: ${invoiceNumber}

**Credit Card:**
Click "Pay Now" above to pay securely online.

Thank you for choosing ${agency.name}! We're excited to start working on your new website.`
			: `## Payment Details

Please pay via bank transfer or click "Pay Now" to pay online.

Thank you for choosing ${agency.name}!`;

		// 13. Create the invoice
		console.log("\nCreating deposit invoice for Murray's Plumbing...");

		await db.insert(invoices).values({
			id: INVOICE_ID,
			agencyId: agency.id,
			proposalId: proposal?.id || null,
			contractId: contract?.id || null,
			invoiceNumber,
			slug: invoiceSlug,
			status: "draft",
			clientBusinessName: "Murrays Plumbing",
			clientContactName: proposal?.clientContactName || "Steve Murray",
			clientEmail: proposal?.clientEmail || "steve@murraysplumbing.com.au",
			clientPhone: proposal?.clientPhone || "0412 345 678",
			clientAddress: contract?.clientAddress || "42 Trade Street\nEight Mile Plains QLD 4113",
			clientAbn: "",
			issueDate,
			dueDate,
			subtotal: subtotalExGst.toFixed(2),
			discountAmount: "0.00",
			discountDescription: "",
			gstAmount: gstAmount.toFixed(2),
			total: depositAmount.toFixed(2),
			gstRegistered,
			gstRate: gstRate.toFixed(2),
			paymentTerms: "NET_7",
			paymentTermsCustom: "",
			notes: "Deposit invoice for website project. 50% of total project cost.",
			publicNotes,
			viewCount: 0,
			onlinePaymentEnabled: true,
			createdBy: user?.id || null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// 14. Create line items
		console.log("Creating invoice line items...");

		const lineItems = [
			{
				id: crypto.randomUUID(),
				invoiceId: INVOICE_ID,
				description: `${packageName} - 50% Deposit\nWebsite design and development services as per proposal ${proposal?.proposalNumber || "PROP-2025-0001"}`,
				quantity: "1.00",
				unitPrice: subtotalExGst.toFixed(2),
				amount: subtotalExGst.toFixed(2),
				isTaxable: true,
				sortOrder: 0,
				category: "setup",
				packageId: selectedPackage?.id || null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];

		for (const item of lineItems) {
			await db.insert(invoiceLineItems).values(item);
		}

		// 15. Update next invoice number in profile
		if (profile) {
			await db
				.update(agencyProfiles)
				.set({ nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1 })
				.where(eq(agencyProfiles.id, profile.id));
		}

		// Success!
		console.log("\n" + "=".repeat(60));
		console.log("✅ INVOICE SEEDED SUCCESSFULLY!");
		console.log("=".repeat(60));
		console.log("\nInvoice Details:");
		console.log(`  ID: ${INVOICE_ID}`);
		console.log(`  Number: ${invoiceNumber}`);
		console.log(`  Client: Murrays Plumbing`);
		console.log(`  Status: draft (ready to send)`);
		console.log(`  Type: 50% Deposit`);
		console.log("\nFinancials:");
		console.log(`  Subtotal (ex GST): $${subtotalExGst.toFixed(2)}`);
		console.log(`  GST (${gstRate}%): $${gstAmount.toFixed(2)}`);
		console.log(`  Total (inc GST): $${depositAmount.toFixed(2)}`);
		console.log("\nDates:");
		console.log(`  Issue Date: ${issueDate.toLocaleDateString()}`);
		console.log(`  Due Date: ${dueDate.toLocaleDateString()}`);
		console.log(`  Payment Terms: Due in 7 days`);
		if (proposal) {
			console.log(`\nLinked Proposal: ${proposal.proposalNumber}`);
		}
		if (contract) {
			console.log(`Linked Contract: ${contract.contractNumber}`);
		}
		console.log(`\nView at:`);
		console.log(`  Admin: https://app.webkit.au/${agencySlug}/invoices`);
		console.log(`  Public: https://app.webkit.au/i/${invoiceSlug}`);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Error seeding invoice:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

// Export for use by master script
export const MURRAYS_INVOICE_ID = INVOICE_ID;

seedInvoice();
