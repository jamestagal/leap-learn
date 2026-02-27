/**
 * Feature Configuration
 *
 * Centralized configuration for core features including icons, colors, and descriptions.
 * Used across Dashboard, Sidebar, and Page headers for consistent design.
 */

import {
	House,
	Settings,
	Users,
	Send,
	ChartColumnBig,
} from "lucide-svelte";
import type { ComponentType } from "svelte";

export interface FeatureConfig {
	key: string;
	title: string;
	description: string;
	icon: ComponentType;
	color: string;
	/** Light version of color for backgrounds (10% opacity) */
	colorLight: string;
}

/** Feature key types for type-safe access */
export type FeatureKey =
	| "forms"
	| "clients"
	| "reports";

/**
 * Core feature configurations with consistent icons and colors
 */
export const FEATURES: Record<FeatureKey, FeatureConfig> = {
	forms: {
		key: "forms",
		title: "Forms",
		description: "Send and track client form submissions with customizable templates.",
		icon: Send,
		color: "#ec4899", // Pink
		colorLight: "#ec489915",
	},
	clients: {
		key: "clients",
		title: "Clients",
		description: "Central hub for managing client relationships and viewing all linked documents.",
		icon: Users,
		color: "#14b8a6", // Teal
		colorLight: "#14b8a615",
	},
	reports: {
		key: "reports",
		title: "Reports",
		description: "Track activity, engagement, and team performance at a glance.",
		icon: ChartColumnBig,
		color: "#f59e0b", // Amber
		colorLight: "#f59e0b15",
	},
};

/**
 * Navigation feature configs (for sidebar)
 * Includes additional nav-only items like Dashboard, Settings, etc.
 */
export const NAV_FEATURES = {
	dashboard: {
		key: "dashboard",
		title: "Dashboard",
		icon: House,
		color: "#64748b", // Slate
		colorLight: "#64748b15",
	},
	settings: {
		key: "settings",
		title: "Settings",
		icon: Settings,
		color: "#64748b", // Slate
		colorLight: "#64748b15",
	},
	members: {
		key: "members",
		title: "Members",
		icon: Users,
		color: "#64748b", // Slate
		colorLight: "#64748b15",
	},
};

/**
 * Get feature config by key
 */
export function getFeature(key: keyof typeof FEATURES): FeatureConfig {
	return FEATURES[key];
}

/**
 * Get all core features as array (for iteration)
 */
export function getCoreFeatures(): FeatureConfig[] {
	return Object.values(FEATURES);
}
