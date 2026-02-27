/**
 * Organisation Config Store
 *
 * Provides organisation-specific form options to components via module-level state.
 * Config is loaded in layout.server.ts and set in layout.svelte.
 *
 * Usage:
 * - In +layout.svelte: setOrganisationConfig(data.organisationConfig)
 * - In components: const config = getOrganisationConfig()
 */

// =============================================================================
// Types
// =============================================================================

export interface FormOption {
	value: string;
	label: string;
	isDefault?: boolean;
	sortOrder?: number;
	metadata?: Record<string, unknown>;
}

export interface OrganisationConfig {
	// Business Context
	industry: FormOption[];
	business_type: FormOption[];
	digital_presence: FormOption[];
	marketing_channels: FormOption[];

	// Pain Points
	urgency_level: FormOption[];
	primary_challenges: FormOption[];
	technical_issues: FormOption[];
	solution_gaps: FormOption[];

	// Goals & Objectives
	budget_range: FormOption[];
	primary_goals: FormOption[];
	secondary_goals: FormOption[];
	success_metrics: FormOption[];
	kpis: FormOption[];
	budget_constraints: FormOption[];
}

export type FormOptionCategory = keyof OrganisationConfig;

// =============================================================================
// Default Options (Fallback when organisation has no custom options)
// =============================================================================

export const DEFAULT_OPTIONS: OrganisationConfig = {
	// Industry options (16)
	industry: [
		{ value: "technology", label: "Technology & Software" },
		{ value: "healthcare", label: "Healthcare & Medical" },
		{ value: "finance", label: "Finance & Banking" },
		{ value: "retail", label: "Retail & E-commerce" },
		{ value: "manufacturing", label: "Manufacturing" },
		{ value: "education", label: "Education" },
		{ value: "real-estate", label: "Real Estate" },
		{ value: "hospitality", label: "Hospitality & Tourism" },
		{ value: "legal", label: "Legal Services" },
		{ value: "marketing", label: "Marketing & Advertising" },
		{ value: "construction", label: "Construction" },
		{ value: "automotive", label: "Automotive" },
		{ value: "food-beverage", label: "Food & Beverage" },
		{ value: "entertainment", label: "Entertainment & Media" },
		{ value: "nonprofit", label: "Non-Profit" },
		{ value: "other", label: "Other" },
	],

	// Business type options (7)
	business_type: [
		{ value: "startup", label: "Startup (< 2 years)" },
		{ value: "small-business", label: "Small Business (2-10 employees)" },
		{ value: "medium-business", label: "Medium Business (11-50 employees)" },
		{ value: "enterprise", label: "Enterprise (50+ employees)" },
		{ value: "freelancer", label: "Freelancer / Sole Proprietor" },
		{ value: "organisation", label: "Organisation" },
		{ value: "nonprofit", label: "Non-Profit Organization" },
	],

	// Digital presence options (11)
	digital_presence: [
		{ value: "website", label: "Company Website" },
		{ value: "ecommerce", label: "E-commerce Store" },
		{ value: "blog", label: "Blog" },
		{ value: "social-facebook", label: "Facebook" },
		{ value: "social-instagram", label: "Instagram" },
		{ value: "social-linkedin", label: "LinkedIn" },
		{ value: "social-twitter", label: "Twitter/X" },
		{ value: "social-youtube", label: "YouTube" },
		{ value: "social-tiktok", label: "TikTok" },
		{ value: "mobile-app", label: "Mobile App" },
		{ value: "none", label: "No Digital Presence" },
	],

	// Marketing channels options (17)
	marketing_channels: [
		{ value: "seo", label: "SEO / Organic Search" },
		{ value: "ppc", label: "PPC / Paid Ads" },
		{ value: "social-media", label: "Social Media Marketing" },
		{ value: "email", label: "Email Marketing" },
		{ value: "content", label: "Content Marketing" },
		{ value: "influencer", label: "Influencer Marketing" },
		{ value: "affiliate", label: "Affiliate Marketing" },
		{ value: "referral", label: "Referral Program" },
		{ value: "events", label: "Events & Trade Shows" },
		{ value: "pr", label: "Public Relations" },
		{ value: "direct-mail", label: "Direct Mail" },
		{ value: "cold-outreach", label: "Cold Outreach" },
		{ value: "partnerships", label: "Strategic Partnerships" },
		{ value: "print", label: "Print Advertising" },
		{ value: "radio-tv", label: "Radio/TV Advertising" },
		{ value: "word-of-mouth", label: "Word of Mouth" },
		{ value: "none", label: "No Active Marketing" },
	],

	// Urgency options (4)
	urgency_level: [
		{ value: "low", label: "Low - Exploratory phase" },
		{ value: "medium", label: "Medium - Planning for next quarter" },
		{ value: "high", label: "High - Need to start within weeks" },
		{ value: "critical", label: "Critical - Urgent need" },
	],

	// Challenges options (20)
	primary_challenges: [
		{ value: "lead-generation", label: "Lead Generation" },
		{ value: "conversion-rate", label: "Low Conversion Rates" },
		{ value: "brand-awareness", label: "Brand Awareness" },
		{ value: "customer-retention", label: "Customer Retention" },
		{ value: "competition", label: "Competitive Pressure" },
		{ value: "scaling", label: "Scaling Operations" },
		{ value: "cost-management", label: "Cost Management" },
		{ value: "talent-acquisition", label: "Talent Acquisition" },
		{ value: "technology-adoption", label: "Technology Adoption" },
		{ value: "data-management", label: "Data Management" },
		{ value: "customer-experience", label: "Customer Experience" },
		{ value: "market-expansion", label: "Market Expansion" },
		{ value: "regulatory-compliance", label: "Regulatory Compliance" },
		{ value: "supply-chain", label: "Supply Chain Issues" },
		{ value: "cash-flow", label: "Cash Flow Management" },
		{ value: "digital-transformation", label: "Digital Transformation" },
		{ value: "product-development", label: "Product Development" },
		{ value: "customer-acquisition-cost", label: "High Customer Acquisition Cost" },
		{ value: "market-positioning", label: "Market Positioning" },
		{ value: "other", label: "Other" },
	],

	// Technical issues options (20)
	technical_issues: [
		{ value: "slow-website", label: "Slow Website Performance" },
		{ value: "mobile-optimization", label: "Poor Mobile Experience" },
		{ value: "seo-issues", label: "SEO Problems" },
		{ value: "security-concerns", label: "Security Vulnerabilities" },
		{ value: "integration-issues", label: "System Integration Problems" },
		{ value: "outdated-platform", label: "Outdated Technology Stack" },
		{ value: "scalability", label: "Scalability Limitations" },
		{ value: "data-silos", label: "Data Silos" },
		{ value: "automation-gaps", label: "Lack of Automation" },
		{ value: "analytics-tracking", label: "Poor Analytics/Tracking" },
		{ value: "email-deliverability", label: "Email Deliverability Issues" },
		{ value: "crm-issues", label: "CRM Problems" },
		{ value: "payment-processing", label: "Payment Processing Issues" },
		{ value: "hosting-issues", label: "Hosting/Uptime Problems" },
		{ value: "accessibility", label: "Accessibility Compliance" },
		{ value: "api-limitations", label: "API Limitations" },
		{ value: "backup-recovery", label: "Backup/Recovery Concerns" },
		{ value: "content-management", label: "Content Management Difficulties" },
		{ value: "user-experience", label: "Poor User Experience" },
		{ value: "none", label: "No Technical Issues" },
	],

	// Solution gaps options (20)
	solution_gaps: [
		{ value: "no-crm", label: "No CRM System" },
		{ value: "no-email-marketing", label: "No Email Marketing Platform" },
		{ value: "no-analytics", label: "No Analytics Solution" },
		{ value: "no-automation", label: "No Marketing Automation" },
		{ value: "no-ecommerce", label: "No E-commerce Platform" },
		{ value: "no-booking", label: "No Booking/Scheduling System" },
		{ value: "no-chat", label: "No Live Chat/Support System" },
		{ value: "no-social-management", label: "No Social Media Management" },
		{ value: "no-project-management", label: "No Project Management Tool" },
		{ value: "no-invoicing", label: "No Invoicing System" },
		{ value: "no-inventory", label: "No Inventory Management" },
		{ value: "no-hr-system", label: "No HR Management System" },
		{ value: "no-document-management", label: "No Document Management" },
		{ value: "no-collaboration", label: "No Collaboration Tools" },
		{ value: "no-reporting", label: "No Reporting Dashboard" },
		{ value: "no-mobile-app", label: "No Mobile App" },
		{ value: "no-customer-portal", label: "No Customer Portal" },
		{ value: "no-loyalty-program", label: "No Loyalty Program" },
		{ value: "no-review-management", label: "No Review Management" },
		{ value: "other", label: "Other Gap" },
	],

	// Budget range options (9)
	budget_range: [
		{ value: "under-5k", label: "Under $5,000" },
		{ value: "5k-10k", label: "$5,000 - $10,000" },
		{ value: "10k-25k", label: "$10,000 - $25,000" },
		{ value: "25k-50k", label: "$25,000 - $50,000" },
		{ value: "50k-100k", label: "$50,000 - $100,000" },
		{ value: "100k-250k", label: "$100,000 - $250,000" },
		{ value: "250k-500k", label: "$250,000 - $500,000" },
		{ value: "500k-plus", label: "$500,000+" },
		{ value: "tbd", label: "To Be Determined" },
	],

	// Primary goals options (15)
	primary_goals: [
		{ value: "increase-revenue", label: "Increase Revenue" },
		{ value: "generate-leads", label: "Generate More Leads" },
		{ value: "improve-conversion", label: "Improve Conversion Rates" },
		{ value: "build-brand", label: "Build Brand Awareness" },
		{ value: "enter-new-market", label: "Enter New Markets" },
		{ value: "launch-product", label: "Launch New Product/Service" },
		{ value: "improve-retention", label: "Improve Customer Retention" },
		{ value: "reduce-costs", label: "Reduce Operational Costs" },
		{ value: "automate-processes", label: "Automate Business Processes" },
		{ value: "improve-efficiency", label: "Improve Team Efficiency" },
		{ value: "enhance-experience", label: "Enhance Customer Experience" },
		{ value: "digital-presence", label: "Establish Digital Presence" },
		{ value: "competitive-advantage", label: "Gain Competitive Advantage" },
		{ value: "data-driven", label: "Become Data-Driven" },
		{ value: "sustainability", label: "Improve Sustainability" },
	],

	// Secondary goals options (15)
	secondary_goals: [
		{ value: "improve-seo", label: "Improve SEO Rankings" },
		{ value: "social-engagement", label: "Increase Social Engagement" },
		{ value: "email-list", label: "Grow Email List" },
		{ value: "content-strategy", label: "Develop Content Strategy" },
		{ value: "mobile-optimization", label: "Optimize for Mobile" },
		{ value: "analytics-setup", label: "Set Up Analytics" },
		{ value: "crm-implementation", label: "Implement CRM" },
		{ value: "process-documentation", label: "Document Processes" },
		{ value: "team-training", label: "Train Team Members" },
		{ value: "vendor-consolidation", label: "Consolidate Vendors" },
		{ value: "security-improvement", label: "Improve Security" },
		{ value: "compliance", label: "Achieve Compliance" },
		{ value: "partnerships", label: "Build Partnerships" },
		{ value: "customer-feedback", label: "Gather Customer Feedback" },
		{ value: "brand-refresh", label: "Refresh Brand Identity" },
	],

	// Success metrics options (15)
	success_metrics: [
		{ value: "revenue-growth", label: "Revenue Growth (%)" },
		{ value: "lead-volume", label: "Lead Volume" },
		{ value: "conversion-rate", label: "Conversion Rate" },
		{ value: "customer-acquisition", label: "Customer Acquisition Cost" },
		{ value: "customer-lifetime", label: "Customer Lifetime Value" },
		{ value: "website-traffic", label: "Website Traffic" },
		{ value: "organic-ranking", label: "Organic Search Rankings" },
		{ value: "email-engagement", label: "Email Open/Click Rates" },
		{ value: "social-followers", label: "Social Media Followers" },
		{ value: "nps-score", label: "Net Promoter Score (NPS)" },
		{ value: "churn-rate", label: "Churn Rate" },
		{ value: "time-to-market", label: "Time to Market" },
		{ value: "employee-satisfaction", label: "Employee Satisfaction" },
		{ value: "cost-reduction", label: "Cost Reduction (%)" },
		{ value: "market-share", label: "Market Share" },
	],

	// KPIs options (15)
	kpis: [
		{ value: "monthly-revenue", label: "Monthly Recurring Revenue (MRR)" },
		{ value: "qualified-leads", label: "Marketing Qualified Leads (MQLs)" },
		{ value: "sales-qualified", label: "Sales Qualified Leads (SQLs)" },
		{ value: "deal-velocity", label: "Deal Velocity" },
		{ value: "average-deal", label: "Average Deal Size" },
		{ value: "win-rate", label: "Win Rate" },
		{ value: "pipeline-value", label: "Pipeline Value" },
		{ value: "customer-satisfaction", label: "Customer Satisfaction (CSAT)" },
		{ value: "first-response", label: "First Response Time" },
		{ value: "resolution-time", label: "Resolution Time" },
		{ value: "active-users", label: "Active Users" },
		{ value: "engagement-rate", label: "Engagement Rate" },
		{ value: "bounce-rate", label: "Bounce Rate" },
		{ value: "page-load", label: "Page Load Time" },
		{ value: "uptime", label: "System Uptime" },
	],

	// Budget constraints options (15)
	budget_constraints: [
		{ value: "fixed-budget", label: "Fixed Annual Budget" },
		{ value: "monthly-cap", label: "Monthly Spending Cap" },
		{ value: "approval-required", label: "Requires Board/Executive Approval" },
		{ value: "roi-dependent", label: "Contingent on ROI Projections" },
		{ value: "phased-spending", label: "Phased Spending Approach" },
		{ value: "cash-flow", label: "Cash Flow Dependent" },
		{ value: "grant-funded", label: "Grant/External Funding" },
		{ value: "seasonal", label: "Seasonal Budget Variations" },
		{ value: "cost-sharing", label: "Cost Sharing with Partners" },
		{ value: "payment-terms", label: "Extended Payment Terms Needed" },
		{ value: "milestone-based", label: "Milestone-Based Payments" },
		{ value: "retainer", label: "Prefer Retainer Model" },
		{ value: "project-based", label: "Project-Based Pricing" },
		{ value: "performance", label: "Performance-Based Pricing" },
		{ value: "flexible", label: "Flexible / No Constraints" },
	],
};

// =============================================================================
// Module-level State
// =============================================================================

let currentConfig: OrganisationConfig = DEFAULT_OPTIONS;

// =============================================================================
// Store Functions
// =============================================================================

/**
 * Set organisation config.
 * Call this in +layout.svelte with data from layout.server.ts.
 * Can be called in $effect (unlike setContext).
 */
export function setOrganisationConfig(config: OrganisationConfig | null): void {
	currentConfig = config ?? DEFAULT_OPTIONS;
}

/**
 * Get organisation config.
 * Returns current config or defaults if not set.
 */
export function getOrganisationConfig(): OrganisationConfig {
	return currentConfig;
}

/**
 * Get options for a specific category with fallback to defaults.
 */
export function getFormOptions(category: FormOptionCategory): FormOption[] {
	const config = getOrganisationConfig();
	if (config && config[category]?.length > 0) {
		return config[category];
	}
	return DEFAULT_OPTIONS[category] || [];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Group raw form options from database by category.
 */
export function groupOptionsByCategory(
	options: Array<{
		category: string;
		value: string;
		label: string;
		isDefault?: boolean;
		sortOrder?: number;
		metadata?: Record<string, unknown>;
	}>,
): Partial<OrganisationConfig> {
	const grouped: Partial<OrganisationConfig> = {};

	for (const opt of options) {
		const category = opt.category as FormOptionCategory;
		if (!grouped[category]) {
			grouped[category] = [];
		}
		const formOption: FormOption = {
			value: opt.value,
			label: opt.label,
		};
		if (opt.isDefault !== undefined) formOption.isDefault = opt.isDefault;
		if (opt.sortOrder !== undefined) formOption.sortOrder = opt.sortOrder;
		if (opt.metadata !== undefined) formOption.metadata = opt.metadata;
		grouped[category]!.push(formOption);
	}

	// Sort each category by sortOrder
	for (const category of Object.keys(grouped) as FormOptionCategory[]) {
		grouped[category]!.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
	}

	return grouped;
}

/**
 * Merge organisation options with defaults.
 * Organisation options take precedence; defaults fill in missing categories.
 */
export function mergeWithDefaults(organisationOptions: Partial<OrganisationConfig>): OrganisationConfig {
	const merged: OrganisationConfig = { ...DEFAULT_OPTIONS };

	for (const category of Object.keys(organisationOptions) as FormOptionCategory[]) {
		if (organisationOptions[category] && organisationOptions[category]!.length > 0) {
			merged[category] = organisationOptions[category]!;
		}
	}

	return merged;
}

/**
 * Get default options that are marked as default.
 * Useful for pre-populating "quick add" suggestions.
 */
export function getDefaultSuggestions(category: FormOptionCategory): FormOption[] {
	const options = getFormOptions(category);
	return options.filter((opt) => opt.isDefault);
}
