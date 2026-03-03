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
	totalDurationMinutes: number;
}

export interface CourseItemWithContent {
	id: string;
	courseId: string;
	contentId: string | null;
	sectionId: string | null;
	sortOrder: number;
	title: string;
	itemType: string;
	bodyMarkdown: string | null;
	removedAt: Date | null;
	createdAt: Date;
	estimatedDurationMinutes: number | null;
	// H5P content info (joined)
	contentTitle?: string;
	contentStatus?: string;
	libraryTitle?: string;
	libraryMachineName?: string;
}

export interface CourseSection {
	id: string;
	courseId: string;
	title: string;
	description: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface CourseSectionWithItems extends CourseSection {
	items: CourseItemWithContent[];
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
	sections: CourseSection[];
}
