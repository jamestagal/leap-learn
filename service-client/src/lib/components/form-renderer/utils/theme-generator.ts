/**
 * Theme Generator Utility
 *
 * Generates DaisyUI theme CSS from OrganisationBranding configuration.
 */

import type { OrganisationBranding } from "$lib/types/branding";

export const radiusMap = {
	none: "0",
	sm: "0.25rem",
	md: "0.5rem",
	lg: "0.75rem",
	xl: "1rem",
	full: "9999px",
} as const;

export const cardStyleMap = {
	flat: "",
	bordered: "border border-base-300",
	elevated: "shadow-lg",
} as const;

/**
 * Convert space-separated HSL "H S% L%" to comma-separated "H, S%, L%"
 */
function toCommaHSL(hsl: string): string {
	const parts = hsl.trim().split(/\s+/);
	return parts.join(", ");
}

/**
 * Generates a DaisyUI theme CSS string from OrganisationBranding
 * Uses comma-separated HSL values for better browser compatibility
 */
export function generateDaisyTheme(themeName: string, branding: OrganisationBranding): string {
	const c = branding.colors;
	const b = branding.borders || {};
	const btn = branding.buttons || {};
	const t = branding.typography || {};

	// Auto-calculate missing colors
	const primaryFocus = c.primaryFocus || darkenHSL(c.primary, 10);
	const primaryContent = c.primaryContent || getContrastColor(c.primary);

	const secondary = c.secondary || shiftHue(c.primary, 30);
	const secondaryFocus = c.secondaryFocus || darkenHSL(secondary, 10);
	const secondaryContent = c.secondaryContent || getContrastColor(secondary);

	const accent = c.accent || shiftHue(c.primary, 180);
	const accentFocus = c.accentFocus || darkenHSL(accent, 10);
	const accentContent = c.accentContent || getContrastColor(accent);

	const neutral = c.neutral || "220 14% 20%";
	const neutralFocus = c.neutralFocus || darkenHSL(neutral, 5);
	const neutralContent = c.neutralContent || "0 0% 100%";

	const base100 = c.base100;
	const base200 = c.base200 || darkenHSL(base100, 3);
	const base300 = c.base300 || darkenHSL(base100, 8);
	const baseContent = c.baseContent || getContrastColor(base100);

	// Semantic colors with defaults
	const info = c.info || "198 93% 60%";
	const success = c.success || "158 64% 52%";
	const warning = c.warning || "43 96% 56%";
	const error = c.error || "0 91% 71%";

	// Border radius
	const roundedBox = radiusMap[b.cardRadius || b.radius || "lg"];
	const roundedBtn = radiusMap[b.buttonRadius || b.radius || "md"];

	// Button styles
	const btnTextCase = btn.textTransform || "none";
	const btnFocusScale = btn.focusScale || 0.98;

	// Typography
	const fontBody = t.bodyFont || "system-ui, sans-serif";
	const fontHeading = t.headingFont || fontBody;

	// Convert all HSL values to comma-separated format
	return `
    [data-theme="${themeName}"] {
      /* Primary */
      --p: ${toCommaHSL(c.primary)};
      --pf: ${toCommaHSL(primaryFocus)};
      --pc: ${toCommaHSL(primaryContent)};

      /* Secondary */
      --s: ${toCommaHSL(secondary)};
      --sf: ${toCommaHSL(secondaryFocus)};
      --sc: ${toCommaHSL(secondaryContent)};

      /* Accent */
      --a: ${toCommaHSL(accent)};
      --af: ${toCommaHSL(accentFocus)};
      --ac: ${toCommaHSL(accentContent)};

      /* Neutral */
      --n: ${toCommaHSL(neutral)};
      --nf: ${toCommaHSL(neutralFocus)};
      --nc: ${toCommaHSL(neutralContent)};

      /* Base */
      --b1: ${toCommaHSL(base100)};
      --b2: ${toCommaHSL(base200)};
      --b3: ${toCommaHSL(base300)};
      --bc: ${toCommaHSL(baseContent)};

      /* Semantic */
      --in: ${toCommaHSL(info)};
      --su: ${toCommaHSL(success)};
      --wa: ${toCommaHSL(warning)};
      --er: ${toCommaHSL(error)};

      /* Shapes */
      --rounded-box: ${roundedBox};
      --rounded-btn: ${roundedBtn};
      --rounded-badge: 1.9rem;

      /* Buttons */
      --btn-focus-scale: ${btnFocusScale};
      --btn-text-case: ${btnTextCase};
      --animation-btn: 0.2s;
      --animation-input: 0.2s;

      /* Typography */
      --font-body: ${fontBody};
      --font-heading: ${fontHeading};
    }
  `;
}

/**
 * Darken an HSL color by reducing lightness
 */
function darkenHSL(hsl: string, amount: number): string {
	const [h, s, l] = parseHSL(hsl);
	return `${h} ${s}% ${Math.max(0, l - amount)}%`;
}

/**
 * Shift hue of an HSL color
 */
function shiftHue(hsl: string, degrees: number): string {
	const [h, s, l] = parseHSL(hsl);
	return `${(h + degrees) % 360} ${s}% ${l}%`;
}

/**
 * Get contrasting text color (black or white)
 */
function getContrastColor(hsl: string): string {
	const [, , l] = parseHSL(hsl);
	// Simple luminance check - if lightness > 60%, use dark text
	return l > 60 ? "0 0% 0%" : "0 0% 100%";
}

/**
 * Parse HSL string into components
 */
function parseHSL(hsl: string): [number, number, number] {
	const parts = hsl.split(/\s+/);
	const h = parseFloat(parts[0] ?? "0") || 0;
	const s = parseFloat(parts[1] ?? "0") || 0;
	const l = parseFloat(parts[2] ?? "0") || 0;
	return [h, s, l];
}

/**
 * Simple hash function for theme name
 */
export function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Convert hex color to HSL string format for DaisyUI
 * Returns format: "220 90% 56%" (without hsl() wrapper)
 */
export function hexToHsl(hex: string): string {
	// Remove # if present
	const cleanHex = hex.replace(/^#/, "");

	// Parse hex to RGB
	let r: number, g: number, b: number;
	if (cleanHex.length === 3) {
		const c0 = cleanHex.charAt(0);
		const c1 = cleanHex.charAt(1);
		const c2 = cleanHex.charAt(2);
		r = parseInt(c0 + c0, 16);
		g = parseInt(c1 + c1, 16);
		b = parseInt(c2 + c2, 16);
	} else {
		r = parseInt(cleanHex.substring(0, 2), 16);
		g = parseInt(cleanHex.substring(2, 4), 16);
		b = parseInt(cleanHex.substring(4, 6), 16);
	}

	// Convert to 0-1 range
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	// Convert to final format
	const hDegrees = Math.round(h * 360);
	const sPercent = Math.round(s * 100);
	const lPercent = Math.round(l * 100);

	return `${hDegrees} ${sPercent}% ${lPercent}%`;
}
