/**
 * Organisation Profile Type Definitions
 */

export type ChecklistStatus = "complete" | "incomplete" | "optional";

export interface SetupChecklistItem {
	id: string;
	label: string;
	description: string;
	status: ChecklistStatus;
	required: boolean;
	link: string;
	count?: number;
}
