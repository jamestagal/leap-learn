/**
 * Quick Quote Template
 *
 * Simple single-step form for quick lead capture. Collects essential
 * contact info and basic project requirements for a fast quote turnaround.
 */
import type { FormSchema } from "$lib/types/form-builder";

export const quickQuoteTemplate: FormSchema = {
	version: "1.0",
	steps: [
		{
			id: "quote-request",
			title: "Request a Quote",
			description:
				"Fill out the form below and we'll get back to you with a quote within 24 hours.",
			fields: [
				{
					id: "name",
					type: "text",
					name: "name",
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
					placeholder: "john@example.com",
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
					id: "company",
					type: "text",
					name: "company",
					label: "Business Name",
					placeholder: "Your Business Pty Ltd",
					required: false,
					layout: { width: "half", order: 4 },
				},
				{
					id: "project_type",
					type: "select",
					name: "project_type",
					label: "Project Type",
					required: true,
					options: [
						{ value: "new_website", label: "New Website" },
						{ value: "redesign", label: "Website Redesign" },
						{ value: "ecommerce", label: "E-commerce Store" },
						{ value: "landing_page", label: "Landing Page" },
						{ value: "web_app", label: "Web Application" },
						{ value: "other", label: "Other" },
					],
					layout: { width: "half", order: 5 },
				},
				{
					id: "budget",
					type: "select",
					name: "budget",
					label: "Budget Range",
					required: true,
					options: [
						{ value: "under_2k", label: "Under $2,000" },
						{ value: "2k_5k", label: "$2,000 - $5,000" },
						{ value: "5k_10k", label: "$5,000 - $10,000" },
						{ value: "10k_20k", label: "$10,000 - $20,000" },
						{ value: "over_20k", label: "Over $20,000" },
						{ value: "not_sure", label: "Not sure yet" },
					],
					layout: { width: "half", order: 6 },
				},
				{
					id: "timeline",
					type: "select",
					name: "timeline",
					label: "Timeline",
					required: true,
					options: [
						{ value: "asap", label: "ASAP" },
						{ value: "1_month", label: "Within 1 month" },
						{ value: "2_3_months", label: "2-3 months" },
						{ value: "3_6_months", label: "3-6 months" },
						{ value: "flexible", label: "Flexible" },
					],
					layout: { width: "full", order: 7 },
				},
				{
					id: "description",
					type: "textarea",
					name: "description",
					label: "Project Description",
					description: "Brief description of what you're looking for",
					placeholder: "Tell us about your project...",
					required: true,
					layout: { width: "full", order: 8 },
				},
			],
		},
	],
	uiConfig: {
		layout: "single-column",
		showProgressBar: false,
		showStepNumbers: false,
		submitButtonText: "Get My Quote",
		successMessage:
			"Thanks for your request! We'll review your details and send you a quote within 24 hours.",
	},
	formOverrides: {
		layout: {
			maxWidth: "600px",
		},
		header: {
			title: "Quick Quote",
			subtitle: "Get a fast estimate for your project",
			showLogo: true,
		},
		footer: {
			showPoweredBy: true,
		},
	},
};

export default quickQuoteTemplate;
