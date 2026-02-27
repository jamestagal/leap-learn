/**
 * Organisation Profile Types
 */

export interface SetupChecklistItem {
	id: string;
	label: string;
	description: string;
	status: "complete" | "incomplete" | "optional";
	required: boolean;
	link: string;
	count?: number;
}

export interface SetupChecklistResult {
	items: SetupChecklistItem[];
	completionPercent: number;
	totalRequired: number;
	completedRequired: number;
	isReady: boolean;
}
