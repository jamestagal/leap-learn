/**
 * Full Discovery Template
 *
 * Deep dive questionnaire for comprehensive project discovery.
 * Covers goals, audience, competitors, features, content, and timeline.
 * Use for larger projects requiring detailed requirements gathering.
 */
import type { FormSchema } from "$lib/types/form-builder";

export const fullDiscoveryTemplate: FormSchema = {
	version: "1.0",
	steps: [
		// Section 1: Contact & Business
		{
			id: "contact",
			title: "Contact Information",
			description: "Let's start with your contact details.",
			fields: [
				{
					id: "contact_name",
					type: "text",
					name: "contact_name",
					label: "Your Name",
					placeholder: "John Smith",
					required: true,
					layout: { width: "half", order: 1 },
				},
				{
					id: "email",
					type: "email",
					name: "email",
					label: "Email Address",
					placeholder: "john@company.com",
					required: true,
					layout: { width: "half", order: 2 },
				},
				{
					id: "phone",
					type: "tel",
					name: "phone",
					label: "Phone Number",
					placeholder: "04XX XXX XXX",
					required: false,
					layout: { width: "half", order: 3 },
				},
				{
					id: "company_name",
					type: "text",
					name: "company_name",
					label: "Company Name",
					placeholder: "Your Company Pty Ltd",
					required: true,
					layout: { width: "half", order: 4 },
				},
				{
					id: "company_description",
					type: "textarea",
					name: "company_description",
					label: "What does your company do?",
					placeholder: "Brief description of your business and what you offer...",
					required: true,
					layout: { width: "full", order: 5 },
				},
				{
					id: "current_website",
					type: "text",
					name: "current_website",
					label: "Current Website (if any)",
					placeholder: "www.yoursite.com",
					required: false,
					layout: { width: "full", order: 6 },
				},
			],
		},

		// Section 2: Goals & Objectives
		{
			id: "goals",
			title: "Goals & Objectives",
			description: "Help us understand what you want to achieve.",
			fields: [
				{
					id: "primary_goal",
					type: "select",
					name: "primary_goal",
					label: "Primary Goal",
					required: true,
					options: [
						{ value: "generate_leads", label: "Generate more leads" },
						{ value: "increase_sales", label: "Increase online sales" },
						{ value: "build_brand", label: "Build brand awareness" },
						{ value: "improve_credibility", label: "Improve credibility" },
						{ value: "customer_service", label: "Better customer service" },
						{ value: "information", label: "Provide information" },
						{ value: "other", label: "Other" },
					],
					layout: { width: "full", order: 1 },
				},
				{
					id: "secondary_goals",
					type: "multiselect",
					name: "secondary_goals",
					label: "Secondary Goals (select all that apply)",
					required: false,
					options: [
						{ value: "seo", label: "Improve search rankings" },
						{ value: "mobile", label: "Better mobile experience" },
						{ value: "speed", label: "Faster website performance" },
						{ value: "design", label: "More professional design" },
						{ value: "functionality", label: "Add new features" },
						{ value: "content", label: "Better content management" },
					],
					layout: { width: "full", order: 2 },
				},
				{
					id: "success_metrics",
					type: "textarea",
					name: "success_metrics",
					label: "How will you measure success?",
					placeholder:
						"e.g., 50% more enquiries, 1000 monthly visitors, 10% conversion rate...",
					required: true,
					layout: { width: "full", order: 3 },
				},
				{
					id: "problems_to_solve",
					type: "textarea",
					name: "problems_to_solve",
					label: "What problems are you trying to solve?",
					placeholder: "What challenges or pain points led you to this project?",
					required: true,
					layout: { width: "full", order: 4 },
				},
			],
		},

		// Section 3: Target Audience
		{
			id: "audience",
			title: "Target Audience",
			description: "Understanding your audience helps us design for them.",
			fields: [
				{
					id: "target_customers",
					type: "textarea",
					name: "target_customers",
					label: "Who are your ideal customers?",
					description: "Demographics, behaviors, needs",
					placeholder:
						"e.g., Small business owners aged 30-50, tech-savvy, looking for efficiency...",
					required: true,
					layout: { width: "full", order: 1 },
				},
				{
					id: "customer_pain_points",
					type: "textarea",
					name: "customer_pain_points",
					label: "What problems do your customers face?",
					placeholder: "What challenges bring them to you?",
					required: true,
					layout: { width: "full", order: 2 },
				},
				{
					id: "customer_motivations",
					type: "textarea",
					name: "customer_motivations",
					label: "What motivates them to buy?",
					placeholder: "What factors influence their decision?",
					required: true,
					layout: { width: "full", order: 3 },
				},
				{
					id: "geographic_focus",
					type: "text",
					name: "geographic_focus",
					label: "Geographic Focus",
					placeholder: "e.g., Sydney, NSW, Australia-wide, International",
					required: true,
					layout: { width: "full", order: 4 },
				},
			],
		},

		// Section 4: Competitors & Market
		{
			id: "competitors",
			title: "Competitors & Market",
			description: "Help us understand your competitive landscape.",
			fields: [
				{
					id: "main_competitors",
					type: "textarea",
					name: "main_competitors",
					label: "Main Competitors",
					description: "List their websites if known",
					placeholder: "Competitor 1: www.example.com\nCompetitor 2: www.example2.com",
					required: true,
					layout: { width: "full", order: 1 },
				},
				{
					id: "competitor_strengths",
					type: "textarea",
					name: "competitor_strengths",
					label: "What do competitors do well?",
					placeholder: "What do you admire about their websites or marketing?",
					required: false,
					layout: { width: "full", order: 2 },
				},
				{
					id: "competitor_weaknesses",
					type: "textarea",
					name: "competitor_weaknesses",
					label: "Where do competitors fall short?",
					placeholder: "What gaps or weaknesses do you see?",
					required: false,
					layout: { width: "full", order: 3 },
				},
				{
					id: "differentiators",
					type: "textarea",
					name: "differentiators",
					label: "What makes you different?",
					placeholder: "Your unique value proposition or competitive advantages",
					required: true,
					layout: { width: "full", order: 4 },
				},
			],
		},

		// Section 5: Features & Content
		{
			id: "features",
			title: "Features & Content",
			description: "What functionality and content do you need?",
			fields: [
				{
					id: "required_pages",
					type: "multiselect",
					name: "required_pages",
					label: "Required Pages",
					required: true,
					options: [
						{ value: "home", label: "Home" },
						{ value: "about", label: "About Us" },
						{ value: "services", label: "Services" },
						{ value: "products", label: "Products" },
						{ value: "portfolio", label: "Portfolio/Work" },
						{ value: "blog", label: "Blog/News" },
						{ value: "testimonials", label: "Testimonials" },
						{ value: "faq", label: "FAQ" },
						{ value: "contact", label: "Contact" },
						{ value: "pricing", label: "Pricing" },
					],
					layout: { width: "full", order: 1 },
				},
				{
					id: "required_features",
					type: "multiselect",
					name: "required_features",
					label: "Required Features",
					required: false,
					options: [
						{ value: "contact_form", label: "Contact Form" },
						{ value: "quote_form", label: "Quote Request Form" },
						{ value: "booking", label: "Online Booking" },
						{ value: "newsletter", label: "Newsletter Signup" },
						{ value: "live_chat", label: "Live Chat" },
						{ value: "maps", label: "Google Maps" },
						{ value: "social_feed", label: "Social Media Feed" },
						{ value: "video", label: "Video Integration" },
						{ value: "search", label: "Site Search" },
						{ value: "member_area", label: "Member/Login Area" },
					],
					layout: { width: "full", order: 2 },
				},
				{
					id: "content_status",
					type: "select",
					name: "content_status",
					label: "Content Status",
					required: true,
					options: [
						{ value: "have_all", label: "I have all content ready" },
						{ value: "have_some", label: "I have some content" },
						{ value: "need_help", label: "I need help creating content" },
						{ value: "migrate", label: "Migrate from existing site" },
					],
					layout: { width: "full", order: 3 },
				},
				{
					id: "additional_features",
					type: "textarea",
					name: "additional_features",
					label: "Additional Features or Integrations",
					placeholder: "Any specific tools, integrations, or custom functionality needed?",
					required: false,
					layout: { width: "full", order: 4 },
				},
			],
		},

		// Section 6: Timeline & Budget
		{
			id: "timeline",
			title: "Timeline & Budget",
			description: "Help us understand your constraints.",
			fields: [
				{
					id: "deadline",
					type: "text",
					name: "deadline",
					label: "Target Launch Date",
					placeholder: "e.g., March 2025, Q2 2025, ASAP",
					required: true,
					layout: { width: "half", order: 1 },
				},
				{
					id: "budget_range",
					type: "select",
					name: "budget_range",
					label: "Budget Range",
					required: true,
					options: [
						{ value: "under_5k", label: "Under $5,000" },
						{ value: "5k_10k", label: "$5,000 - $10,000" },
						{ value: "10k_20k", label: "$10,000 - $20,000" },
						{ value: "20k_50k", label: "$20,000 - $50,000" },
						{ value: "over_50k", label: "Over $50,000" },
						{ value: "discuss", label: "Let's discuss" },
					],
					layout: { width: "half", order: 2 },
				},
				{
					id: "decision_timeline",
					type: "select",
					name: "decision_timeline",
					label: "Decision Timeline",
					required: true,
					options: [
						{ value: "immediately", label: "Ready to start immediately" },
						{ value: "1_week", label: "Within 1 week" },
						{ value: "2_4_weeks", label: "Within 2-4 weeks" },
						{ value: "1_3_months", label: "1-3 months" },
						{ value: "just_exploring", label: "Just exploring options" },
					],
					layout: { width: "full", order: 3 },
				},
				{
					id: "design_inspiration",
					type: "textarea",
					name: "design_inspiration",
					label: "Design Inspiration",
					description: "Links to websites you like",
					placeholder: "www.example1.com - I like the clean layout\nwww.example2.com - Great colors",
					required: false,
					layout: { width: "full", order: 4 },
				},
				{
					id: "additional_notes",
					type: "textarea",
					name: "additional_notes",
					label: "Anything Else?",
					placeholder: "Any other information that would help us understand your project?",
					required: false,
					layout: { width: "full", order: 5 },
				},
			],
		},
	],
	uiConfig: {
		layout: "wizard",
		showProgressBar: true,
		showStepNumbers: true,
		submitButtonText: "Submit Discovery",
		successMessage:
			"Thank you for completing the discovery questionnaire! We'll review your responses and prepare a detailed proposal.",
	},
	formOverrides: {
		layout: {
			maxWidth: "1200px",
		},
		header: {
			title: "Project Discovery",
			subtitle: "Help us understand your project in detail",
			showLogo: true,
		},
		footer: {
			showPoweredBy: true,
		},
	},
};

export default fullDiscoveryTemplate;
