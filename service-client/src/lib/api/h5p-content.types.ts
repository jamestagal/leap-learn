/**
 * H5P Content Types
 *
 * Types for H5P content management (CRUD, editor params).
 * Separated from .remote.ts because remote files cannot export types.
 */

export type ContentInfo = {
	id: string;
	title: string;
	slug: string;
	description: string;
	status: string;
	libraryId: string;
	libraryName: string;
	libraryTitle: string;
	libraryVersion: string;
	createdAt: string;
	updatedAt: string;
};

export type ContentListResponse = {
	items: ContentInfo[];
	total: number;
};

export type EditorContentParams = {
	h5p: Record<string, unknown>;
	library: string;
	params: Record<string, unknown>;
};
