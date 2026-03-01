/**
 * Course Types
 *
 * Type definitions for course remote functions.
 * Separated from .remote.ts to comply with SvelteKit remote function export rules.
 */

export interface CourseListItem {
	id: string;
	title: string;
	slug: string;
	description: string;
	coverImage: string | null;
	status: string;
	publishedAt: Date | null;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	itemCount: number;
	enrolmentCount: number;
}

export interface CourseItemWithContent {
	id: string;
	courseId: string;
	contentId: string | null;
	sortOrder: number;
	title: string;
	itemType: string;
	bodyMarkdown: string | null;
	removedAt: Date | null;
	createdAt: Date;
	// H5P content info (joined)
	contentTitle?: string;
	contentStatus?: string;
	libraryTitle?: string;
	libraryMachineName?: string;
}

export interface CourseWithItems {
	id: string;
	orgId: string;
	title: string;
	slug: string;
	description: string;
	coverImage: string | null;
	status: string;
	publishedAt: Date | null;
	archivedAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string | null;
	items: CourseItemWithContent[];
}
