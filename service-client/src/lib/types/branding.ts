/**
 * Organisation Branding Type Definitions
 * Based on webkit-form-builder-styling-addendum.md
 */

/**
 * Complete organisation branding configuration
 * Stored in organisations.branding (JSONB)
 */
export interface OrganisationBranding {
	// ─────────────────────────────────────────────────────────────
	// COLORS (HSL values without 'hsl()' wrapper, e.g., "220 90% 56%")
	// ─────────────────────────────────────────────────────────────
	colors: {
		primary: string; // Main brand color
		primaryFocus?: string; // Darker primary for hover/focus (auto-generated if not set)
		primaryContent?: string; // Text on primary (auto-calculated if not set)

		secondary?: string; // Secondary brand color
		secondaryFocus?: string;
		secondaryContent?: string;

		accent?: string; // Highlight color
		accentFocus?: string;
		accentContent?: string;

		neutral?: string; // Dark surfaces
		neutralFocus?: string;
		neutralContent?: string;

		base100: string; // Main background
		base200?: string; // Card background (auto-calculated)
		base300?: string; // Borders (auto-calculated)
		baseContent?: string; // Main text color (auto-calculated)

		// Semantic colors (optional - defaults provided)
		info?: string;
		success?: string;
		warning?: string;
		error?: string;
	};

	// ─────────────────────────────────────────────────────────────
	// TYPOGRAPHY
	// ─────────────────────────────────────────────────────────────
	typography?: {
		headingFont?: string; // e.g., "Playfair Display, serif"
		bodyFont?: string; // e.g., "Inter, system-ui, sans-serif"

		// Font sizes (rem values)
		baseFontSize?: number; // Default: 1 (16px)
		headingScale?: number; // Multiplier for heading sizes, default: 1.25
	};

	// ─────────────────────────────────────────────────────────────
	// LOGO
	// ─────────────────────────────────────────────────────────────
	logo?: {
		url: string; // URL to logo image
		darkUrl?: string; // Alternative logo for dark mode
		height?: number; // Height in pixels, default: 40
		position?: "left" | "center"; // Position in form header
	};

	// ─────────────────────────────────────────────────────────────
	// BORDERS & SHAPES
	// ─────────────────────────────────────────────────────────────
	borders?: {
		radius?: "none" | "sm" | "md" | "lg" | "xl" | "full"; // Default: "md"
		inputRadius?: "none" | "sm" | "md" | "lg" | "full"; // Input-specific
		buttonRadius?: "none" | "sm" | "md" | "lg" | "full"; // Button-specific
		cardRadius?: "none" | "sm" | "md" | "lg" | "xl"; // Card-specific
	};

	// ─────────────────────────────────────────────────────────────
	// BUTTONS
	// ─────────────────────────────────────────────────────────────
	buttons?: {
		style?: "solid" | "outline" | "ghost" | "soft"; // Default: "solid"
		textTransform?: "none" | "uppercase" | "capitalize"; // Default: "none"
		focusScale?: number; // Scale on focus, default: 0.98
	};

	// ─────────────────────────────────────────────────────────────
	// LAYOUT
	// ─────────────────────────────────────────────────────────────
	layout?: {
		maxWidth?: string; // e.g., "640px", "800px", "100%"
		padding?: string; // e.g., "1.5rem", "2rem"
		cardStyle?: "flat" | "bordered" | "elevated"; // Default: "bordered"
	};

	// ─────────────────────────────────────────────────────────────
	// MODE
	// ─────────────────────────────────────────────────────────────
	mode?: "light" | "dark" | "system"; // Default: "light"

	// ─────────────────────────────────────────────────────────────
	// ADVANCED
	// ─────────────────────────────────────────────────────────────
	customCss?: string; // Raw CSS for advanced customization
}

/**
 * Form-specific branding overrides
 * Stored in organisation_forms.branding (JSONB, nullable)
 */
export interface FormBrandingOverrides {
	// Override any OrganisationBranding property
	colors?: Partial<OrganisationBranding["colors"]>;
	typography?: Partial<NonNullable<OrganisationBranding["typography"]>>;
	borders?: Partial<NonNullable<OrganisationBranding["borders"]>>;
	buttons?: Partial<NonNullable<OrganisationBranding["buttons"]>>;
	layout?: Partial<NonNullable<OrganisationBranding["layout"]>>;
	mode?: OrganisationBranding["mode"];

	// Form-specific additions
	background?: {
		color?: string; // Background color override
		image?: string; // Background image URL
		overlay?: string; // Overlay color (for image backgrounds)
	};

	header?: {
		title?: string; // Custom form title
		subtitle?: string; // Custom subtitle
		showLogo?: boolean; // Override logo visibility
	};

	footer?: {
		text?: string; // Footer text
		showPoweredBy?: boolean; // Show "Powered by WebKit"
	};

	customCss?: string; // Form-specific CSS
}

/**
 * Merged branding (organisation defaults + form overrides)
 * This is what gets passed to FormBranding component
 */
export interface ResolvedBranding extends OrganisationBranding {
	formOverrides?: FormBrandingOverrides;
}

/**
 * Default branding applied when organisation is created
 */
export const defaultOrganisationBranding: OrganisationBranding = {
	colors: {
		primary: "220 90% 56%", // Blue
		secondary: "280 70% 50%", // Purple
		accent: "45 100% 50%", // Yellow
		neutral: "220 14% 20%",
		base100: "0 0% 100%", // White background
		info: "198 93% 60%",
		success: "158 64% 52%",
		warning: "43 96% 56%",
		error: "0 91% 71%",
	},
	typography: {
		bodyFont: "Inter, system-ui, sans-serif",
		headingFont: "Inter, system-ui, sans-serif",
	},
	borders: {
		radius: "md",
		cardRadius: "lg",
	},
	buttons: {
		style: "solid",
		textTransform: "none",
	},
	layout: {
		maxWidth: "640px",
		cardStyle: "bordered",
	},
	mode: "light",
};
