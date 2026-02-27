/**
 * Website Questionnaire Template
 *
 * Comprehensive questionnaire for gathering client requirements for website projects.
 * Includes 8 sections covering personal info, business details, content requirements,
 * and design preferences. Uses the wizard layout for sidebar navigation.
 */
import type { FormSchema } from "$lib/types/form-builder";

export const websiteQuestionnaireTemplate: FormSchema = {
	version: "1.0",
	steps: [
		// Section 1: Personal Information
		{
			id: "personal",
			title: "Personal Information",
			description:
				"Please provide your contact information so we can reach you during the project.",
			fields: [
				{
					id: "first_name",
					type: "text",
					name: "first_name",
					label: "First Name",
					placeholder: "Enter your first name",
					required: true,
					layout: { width: "half", order: 1 },
				},
				{
					id: "last_name",
					type: "text",
					name: "last_name",
					label: "Last Name",
					placeholder: "Enter your last name",
					required: true,
					layout: { width: "half", order: 2 },
				},
				{
					id: "email",
					type: "email",
					name: "email",
					label: "Email Address",
					description: "We'll use this to send project updates",
					placeholder: "your@email.com",
					required: true,
					layout: { width: "full", order: 3 },
				},
			],
		},

		// Section 2: Company Details
		{
			id: "company",
			title: "Company Details",
			description: "Tell us about your company for our records.",
			fields: [
				{
					id: "company_name",
					type: "text",
					name: "company_name",
					label: "Company Name",
					description: "Your registered business name",
					placeholder: "Your Company Pty Ltd",
					required: true,
					layout: { width: "full", order: 1 },
				},
				{
					id: "registered_address",
					type: "textarea",
					name: "registered_address",
					label: "Registered Business Address",
					description: "Your official business address for legal documents",
					placeholder: "123 Business Street\nCity, State 1234",
					required: true,
					layout: { width: "full", order: 2 },
				},
			],
		},

		// Section 3: Display Information
		{
			id: "display",
			title: "Display Information",
			description:
				"This information will be displayed publicly on your website. It may differ from your registered business details.",
			fields: [
				{
					id: "displayed_business_name",
					type: "text",
					name: "displayed_business_name",
					label: "Business Name to Display",
					description: "This can be a trading name or brand name",
					placeholder: "Your Brand Name",
					required: true,
					layout: { width: "full", order: 1 },
				},
				{
					id: "displayed_address",
					type: "textarea",
					name: "displayed_address",
					label: "Address to Display",
					description: "Leave blank if you don't want to display an address",
					placeholder: "123 Main Street, Suburb, State",
					required: false,
					layout: { width: "full", order: 2 },
				},
				{
					id: "displayed_phone",
					type: "tel",
					name: "displayed_phone",
					label: "Phone Number",
					placeholder: "04XX XXX XXX or (02) XXXX XXXX",
					required: false,
					layout: { width: "half", order: 3 },
				},
				{
					id: "displayed_email",
					type: "email",
					name: "displayed_email",
					label: "Email to Display",
					description: "This can be different from your personal email",
					placeholder: "contact@yourbusiness.com",
					required: false,
					layout: { width: "half", order: 4 },
				},
				{
					id: "social_media_accounts",
					type: "textarea",
					name: "social_media_accounts",
					label: "Social Media Accounts",
					description: "List each social media platform and your handle/URL",
					placeholder:
						"Facebook: facebook.com/yourbusiness\nInstagram: @yourbusiness\nLinkedIn: linkedin.com/company/yourbusiness",
					required: false,
					layout: { width: "full", order: 5 },
				},
				{
					id: "opening_hours",
					type: "textarea",
					name: "opening_hours",
					label: "Opening Hours",
					placeholder: "Monday - Friday: 9am - 5pm\nSaturday: 10am - 2pm\nSunday: Closed",
					required: false,
					layout: { width: "full", order: 6 },
				},
			],
		},

		// Section 4: Domain & Online Presence
		{
			id: "domain",
			title: "Domain & Technical",
			description: "Tell us about your existing domain and online presence.",
			fields: [
				{
					id: "has_domain",
					type: "radio",
					name: "has_domain",
					label: "Do you already have a domain name?",
					required: true,
					options: [
						{ value: "yes", label: "Yes, I have a domain" },
						{ value: "no", label: "No, I need one" },
					],
					layout: { width: "full", order: 1 },
				},
				{
					id: "domain_name",
					type: "text",
					name: "domain_name",
					label: "Domain Name",
					description: "Enter your existing domain name (without http://)",
					placeholder: "yourbusiness.com.au",
					required: false,
					conditionalLogic: [
						{
							field: "has_domain",
							operator: "equals",
							value: "yes",
							action: "show",
						},
					],
					layout: { width: "full", order: 2 },
				},
				{
					id: "has_google_business",
					type: "radio",
					name: "has_google_business",
					label: "Do you have a Google Business Profile?",
					description: "Google Business Profile helps customers find you on Google Search and Maps",
					required: true,
					options: [
						{ value: "yes", label: "Yes" },
						{ value: "no", label: "No" },
					],
					layout: { width: "full", order: 3 },
				},
			],
		},

		// Section 5: About Your Business
		{
			id: "business",
			title: "About Your Business",
			description:
				"Help us understand your business so we can tell your story effectively on your website.",
			fields: [
				{
					id: "business_story",
					type: "textarea",
					name: "business_story",
					label: "Tell us your story/background",
					description: "This will help us write your About page",
					placeholder: "How did your business start? What's your mission? What drives you?",
					required: true,
					validation: { minLength: 50 },
					layout: { width: "full", order: 1 },
				},
				{
					id: "business_emails",
					type: "textarea",
					name: "business_emails",
					label: "Business Email Addresses",
					description: "List all email addresses you want to use on the website",
					placeholder: "info@yourbusiness.com\nsales@yourbusiness.com\nsupport@yourbusiness.com",
					required: false,
					layout: { width: "full", order: 2 },
				},
				{
					id: "areas_served",
					type: "textarea",
					name: "areas_served",
					label: "Areas/Regions Served",
					placeholder: "e.g., Sydney Metropolitan Area, All of NSW, Australia-wide, International",
					required: true,
					layout: { width: "full", order: 3 },
				},
				{
					id: "target_customers",
					type: "textarea",
					name: "target_customers",
					label: "Who are your target customers?",
					placeholder:
						"Describe your ideal customers - age, demographics, industries, or specific types of businesses",
					required: true,
					layout: { width: "full", order: 4 },
				},
				{
					id: "top_services",
					type: "textarea",
					name: "top_services",
					label: "Top 3-4 Services/Products",
					description: "Your most important or popular offerings",
					placeholder:
						"1. Service/Product One\n2. Service/Product Two\n3. Service/Product Three\n4. Service/Product Four",
					required: true,
					layout: { width: "full", order: 5 },
				},
				{
					id: "other_services",
					type: "textarea",
					name: "other_services",
					label: "Other Services/Products",
					placeholder: "List any additional services or products you offer",
					required: false,
					layout: { width: "full", order: 6 },
				},
				{
					id: "differentiators",
					type: "textarea",
					name: "differentiators",
					label: "What sets you apart from competitors?",
					placeholder: "What makes your business unique? Why should customers choose you?",
					required: true,
					layout: { width: "full", order: 7 },
				},
				{
					id: "statistics_awards",
					type: "textarea",
					name: "statistics_awards",
					label: "Statistics, Awards, or Achievements",
					placeholder: "e.g., 15+ years experience, 500+ happy customers, Award-winning service",
					required: false,
					layout: { width: "full", order: 8 },
				},
			],
		},

		// Section 6: Website Content
		{
			id: "content",
			title: "Website Content",
			description: "Tell us what content and functionality you want on your website.",
			fields: [
				{
					id: "pages_wanted",
					type: "textarea",
					name: "pages_wanted",
					label: "What pages do you want on your website?",
					description: "List all the pages you'd like to have",
					placeholder:
						"e.g.,\n- Home\n- About Us\n- Services (with individual service pages)\n- Portfolio/Gallery\n- Testimonials\n- Contact",
					required: true,
					layout: { width: "full", order: 1 },
				},
				{
					id: "customer_actions",
					type: "textarea",
					name: "customer_actions",
					label: "What actions do you want visitors to take?",
					description: "These become your main calls-to-action",
					placeholder:
						"e.g., Call us, Submit enquiry form, Book appointment, Request quote, Sign up for newsletter",
					required: true,
					layout: { width: "full", order: 2 },
				},
				{
					id: "key_information",
					type: "textarea",
					name: "key_information",
					label: "What key information must visitors see?",
					placeholder: "What's the most important information visitors need to know?",
					required: true,
					layout: { width: "full", order: 3 },
				},
				{
					id: "calls_to_action",
					type: "textarea",
					name: "calls_to_action",
					label: "Primary Call-to-Action Text",
					description: "The main button text visitors will see",
					placeholder:
						"e.g., 'Get a Free Quote', 'Book Now', 'Contact Us Today', 'Start Your Project'",
					required: true,
					layout: { width: "full", order: 4 },
				},
				{
					id: "regularly_updated_content",
					type: "textarea",
					name: "regularly_updated_content",
					label: "Will you have regularly updated content?",
					description: "Content you plan to add or update regularly",
					placeholder: "e.g., Blog posts, News updates, Case studies, Portfolio additions",
					required: false,
					layout: { width: "full", order: 5 },
				},
				{
					id: "additional_content_details",
					type: "textarea",
					name: "additional_content_details",
					label: "Additional Content Details",
					placeholder: "Any other content requirements or ideas?",
					required: false,
					layout: { width: "full", order: 6 },
				},
			],
		},

		// Section 7: Website Design
		{
			id: "design",
			title: "Website Design",
			description:
				"Help us understand your design preferences so we can create a website that reflects your brand.",
			fields: [
				{
					id: "competitor_websites",
					type: "textarea",
					name: "competitor_websites",
					label: "Competitor Websites",
					description: "This helps us understand your industry's online presence",
					placeholder:
						"List your main competitors' websites:\nwww.competitor1.com\nwww.competitor2.com",
					required: false,
					layout: { width: "full", order: 1 },
				},
				{
					id: "reference_websites",
					type: "textarea",
					name: "reference_websites",
					label: "Websites you like (for inspiration)",
					description: "These don't need to be in your industry",
					placeholder:
						"List 2-5 websites you like and what you like about them:\n\nwww.example1.com - Love the clean layout\nwww.example2.com - Great use of images\nwww.example3.com - Like the color scheme",
					required: true,
					layout: { width: "full", order: 2 },
				},
				{
					id: "aesthetic_description",
					type: "textarea",
					name: "aesthetic_description",
					label: "Describe your desired look and feel",
					description: "Use words that describe the feeling you want visitors to have",
					placeholder:
						"Describe the style you're looking for:\n\ne.g., Modern and minimal, Professional and corporate, Warm and friendly, Bold and energetic, Elegant and sophisticated",
					required: true,
					layout: { width: "full", order: 3 },
				},
				{
					id: "branding_guidelines",
					type: "textarea",
					name: "branding_guidelines",
					label: "Existing Branding Guidelines",
					description: "Share any brand colors, fonts, or design guidelines you have",
					placeholder:
						"Do you have existing brand colors, fonts, or style guides?\n\ne.g., Primary color: #1a5f7a, Secondary: #57c5b6, Font: Open Sans",
					required: false,
					layout: { width: "full", order: 4 },
				},
				{
					id: "additional_design_details",
					type: "textarea",
					name: "additional_design_details",
					label: "Additional Design Notes",
					placeholder: "Any other design preferences, requirements, or things to avoid?",
					required: false,
					layout: { width: "full", order: 5 },
				},
			],
		},

		// Section 8: Final Details
		{
			id: "final",
			title: "Final Details",
			description: "Just a few more details to help us deliver your project successfully.",
			fields: [
				{
					id: "timeline",
					type: "text",
					name: "timeline",
					label: "Timeline / Desired Launch Date",
					description: "When would you like the website to be live?",
					placeholder: "e.g., ASAP, Within 4 weeks, By March 2025, No rush",
					required: true,
					layout: { width: "full", order: 1 },
				},
				{
					id: "google_analytics",
					type: "radio",
					name: "google_analytics",
					label: "Would you like Google Analytics set up?",
					description: "Track website visitors and their behavior",
					required: true,
					options: [
						{ value: "yes", label: "Yes" },
						{ value: "no", label: "No" },
					],
					layout: { width: "full", order: 2 },
				},
				{
					id: "referral_source",
					type: "text",
					name: "referral_source",
					label: "How did you hear about us?",
					placeholder: "e.g., Google search, Referral from [name], Social media",
					required: false,
					layout: { width: "full", order: 3 },
				},
				{
					id: "other_services_interest",
					type: "multiselect",
					name: "other_services_interest",
					label: "Are you interested in any other services?",
					required: false,
					options: [
						{ value: "seo", label: "Search Engine Optimization (SEO)" },
						{ value: "social_media", label: "Social Media Management" },
						{ value: "ppc", label: "Pay-Per-Click Advertising (Google Ads)" },
						{ value: "content", label: "Content Writing/Marketing" },
						{ value: "branding", label: "Branding & Logo Design" },
					],
					layout: { width: "full", order: 4 },
				},
				{
					id: "marketing_permissions",
					type: "multiselect",
					name: "marketing_permissions",
					label: "How may we contact you for marketing purposes?",
					description: "Optional - We respect your privacy",
					required: false,
					options: [
						{ value: "email", label: "Email" },
						{ value: "phone", label: "Phone" },
						{ value: "sms", label: "SMS" },
					],
					layout: { width: "full", order: 5 },
				},
			],
		},
	],
	uiConfig: {
		layout: "wizard",
		showProgressBar: true,
		showStepNumbers: true,
		submitButtonText: "Submit Questionnaire",
		successMessage:
			"Thank you for completing the questionnaire! We'll review your responses and be in touch soon to discuss your project.",
	},
	formOverrides: {
		layout: {
			maxWidth: "1400px", // Wider container for wizard layout with sidebar
		},
		header: {
			title: "Website Questionnaire",
			subtitle: "Help us understand your needs to create the perfect website",
			showLogo: true,
		},
		footer: {
			showPoweredBy: true,
		},
	},
};

export default websiteQuestionnaireTemplate;
