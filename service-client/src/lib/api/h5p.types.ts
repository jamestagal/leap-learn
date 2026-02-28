/**
 * H5P Shared Types
 *
 * Types used across H5P remote functions and components.
 * Separated from .remote.ts because remote files cannot export types.
 */

export type ContentTypeCacheEntry = {
	id: string;
	title: string;
	summary: string;
	description: string;
	icon: string;
	majorVersion: number;
	minorVersion: number;
	patchVersion: number;
	isRecommended: boolean;
	popularity: number;
	screenshots: { url: string; alt: string }[];
	keywords: string[];
	categories: string[];
	owner: string;
	example: string;
	installed: boolean;
	localVersion: string;
	updateAvailable: boolean;
};

export type LibraryInfo = {
	id: string;
	machineName: string;
	majorVersion: number;
	minorVersion: number;
	patchVersion: number;
	title: string;
	description: string;
	icon: string;
	runnable: boolean;
	origin: string;
	installed: boolean;
};
