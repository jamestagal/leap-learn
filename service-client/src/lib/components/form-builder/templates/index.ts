/**
 * Form Builder Templates
 *
 * Pre-built form schemas that can be used as starting points
 * when creating new forms in the builder.
 *
 * System templates are global and read-only. Organisations can duplicate
 * them to customize for their own use.
 */

// Export individual templates
export { websiteQuestionnaireTemplate, default as websiteQuestionnaire } from "./website-questionnaire";
export { quickQuoteTemplate, default as quickQuote } from "./quick-quote";
export { fullDiscoveryTemplate, default as fullDiscovery } from "./full-discovery";
export { ecommerceIntakeTemplate, default as ecommerceIntake } from "./ecommerce-intake";

// Import for formTemplates array
import { websiteQuestionnaireTemplate } from "./website-questionnaire";
import { quickQuoteTemplate } from "./quick-quote";
import { fullDiscoveryTemplate } from "./full-discovery";
import { ecommerceIntakeTemplate } from "./ecommerce-intake";

/**
 * All available templates with metadata for the Builder UI
 * These are used for the template picker in the Builder
 */
export const formTemplates = [
	{
		id: "website-questionnaire",
		name: "Website Questionnaire",
		description:
			"Comprehensive questionnaire for gathering client requirements for website projects. Includes 8 sections covering personal info, business details, content requirements, and design preferences.",
		category: "questionnaire" as const,
		schema: websiteQuestionnaireTemplate,
		previewImageUrl: undefined,
		isFeatured: true,
		displayOrder: 1,
	},
	{
		id: "quick-quote",
		name: "Quick Quote",
		description:
			"Simple single-step form for fast lead capture. Collects essential contact info, project type, budget, and timeline for quick turnaround quotes.",
		category: "intake" as const,
		schema: quickQuoteTemplate,
		previewImageUrl: undefined,
		isFeatured: true,
		displayOrder: 2,
	},
	{
		id: "full-discovery",
		name: "Full Discovery",
		description:
			"Deep dive questionnaire for comprehensive project discovery. Covers goals, audience, competitors, features, content, and timeline. Ideal for larger projects.",
		category: "consultation" as const,
		schema: fullDiscoveryTemplate,
		previewImageUrl: undefined,
		isFeatured: true,
		displayOrder: 3,
	},
	{
		id: "ecommerce-intake",
		name: "E-commerce Intake",
		description:
			"Specialized questionnaire for e-commerce projects. Covers products, payment processing, shipping, inventory management, and platform integrations.",
		category: "intake" as const,
		schema: ecommerceIntakeTemplate,
		previewImageUrl: undefined,
		isFeatured: true,
		displayOrder: 4,
	},
];

/**
 * System templates for the formTemplates database table
 * These are the global read-only templates that organisations can use
 */
export const systemFormTemplates = formTemplates.map((t) => ({
	slug: t.id,
	name: t.name,
	description: t.description,
	category: t.category,
	schema: t.schema,
	isFeatured: t.isFeatured,
	displayOrder: t.displayOrder,
}));

export type FormTemplateId = (typeof formTemplates)[number]["id"];
export type FormTemplateCategory = "questionnaire" | "intake" | "consultation" | "feedback";
