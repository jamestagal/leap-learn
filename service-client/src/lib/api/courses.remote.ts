/**
 * Course Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for course operations.
 * Follows the remote functions guide:
 * - Uses query() for read operations
 * - Uses command() for programmatic mutations
 * - Uses Valibot for validation (NOT Zod)
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { courses, courseItems, h5pContent, h5pLibraries, enrolments } from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import {
	getOrganisationContext,
	requireOrganisationRole,
	generateSlug,
} from "$lib/server/organisation";
import { getUserId } from "$lib/server/auth";
import { eq, and, count, sql, asc, desc, isNull, ilike } from "drizzle-orm";
import { enforceCourseLimit } from "$lib/server/subscription";
import { logActivity } from "$lib/server/db-helpers";
import type { CourseListItem, CourseWithItems, CourseItemWithContent } from "./courses.types";

// =============================================================================
// Validation Schemas
// =============================================================================

const GetCoursesFiltersSchema = v.optional(
	v.object({
		status: v.optional(v.string()),
		search: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

const CreateCourseSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1)),
	description: v.optional(v.string()),
});

const UpdateCourseSchema = v.object({
	courseId: v.pipe(v.string(), v.uuid()),
	title: v.optional(v.pipe(v.string(), v.minLength(1))),
	description: v.optional(v.string()),
	coverImage: v.optional(v.string()),
	status: v.optional(v.picklist(["draft", "published", "archived"])),
});

const AddCourseItemSchema = v.object({
	courseId: v.pipe(v.string(), v.uuid()),
	itemType: v.picklist(["h5p", "text"]),
	contentId: v.optional(v.pipe(v.string(), v.uuid())),
	title: v.pipe(v.string(), v.minLength(1)),
	bodyMarkdown: v.optional(v.string()),
});

const UpdateCourseItemSchema = v.object({
	itemId: v.pipe(v.string(), v.uuid()),
	title: v.optional(v.pipe(v.string(), v.minLength(1))),
	bodyMarkdown: v.optional(v.string()),
});

const ReorderCourseItemsSchema = v.object({
	courseId: v.pipe(v.string(), v.uuid()),
	items: v.array(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
			sortOrder: v.number(),
		}),
	),
});

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * List courses for the current organisation with item counts and enrolment counts.
 * Supports filtering by status and search term, with pagination.
 */
export const getCourses = query(GetCoursesFiltersSchema, async (filters) => {
	const context = await getOrganisationContext();
	const { status, search, limit = 50, offset = 0 } = filters || {};

	// Build WHERE conditions
	const conditions = [eq(courses.orgId, context.organisationId), isNull(courses.deletedAt)];

	if (status) {
		conditions.push(eq(courses.status, status));
	}

	if (search) {
		conditions.push(ilike(courses.title, `%${search}%`));
	}

	// Subquery for item count (active items only)
	const itemCountSq = db
		.select({
			courseId: courseItems.courseId,
			itemCount: count().as("item_count"),
		})
		.from(courseItems)
		.where(isNull(courseItems.removedAt))
		.groupBy(courseItems.courseId)
		.as("item_counts");

	// Subquery for enrolment count
	const enrolmentCountSq = db
		.select({
			courseId: enrolments.courseId,
			enrolmentCount: count().as("enrolment_count"),
		})
		.from(enrolments)
		.groupBy(enrolments.courseId)
		.as("enrolment_counts");

	const results = await db
		.select({
			id: courses.id,
			title: courses.title,
			slug: courses.slug,
			description: courses.description,
			coverImage: courses.coverImage,
			status: courses.status,
			publishedAt: courses.publishedAt,
			archivedAt: courses.archivedAt,
			createdAt: courses.createdAt,
			updatedAt: courses.updatedAt,
			itemCount: sql<number>`COALESCE(${itemCountSq.itemCount}, 0)`.mapWith(Number),
			enrolmentCount: sql<number>`COALESCE(${enrolmentCountSq.enrolmentCount}, 0)`.mapWith(Number),
		})
		.from(courses)
		.leftJoin(itemCountSq, eq(courses.id, itemCountSq.courseId))
		.leftJoin(enrolmentCountSq, eq(courses.id, enrolmentCountSq.courseId))
		.where(and(...conditions))
		.orderBy(desc(courses.updatedAt))
		.limit(limit)
		.offset(offset);

	return results as CourseListItem[];
});

/**
 * Get a single course with its items and H5P content details.
 */
export const getCourse = query(v.pipe(v.string(), v.uuid()), async (courseId) => {
	const context = await getOrganisationContext();

	// Fetch course
	const [course] = await db
		.select()
		.from(courses)
		.where(
			and(
				eq(courses.id, courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	// Fetch items with H5P content and library info
	const items = await db
		.select({
			id: courseItems.id,
			courseId: courseItems.courseId,
			contentId: courseItems.contentId,
			sortOrder: courseItems.sortOrder,
			title: courseItems.title,
			itemType: courseItems.itemType,
			bodyMarkdown: courseItems.bodyMarkdown,
			removedAt: courseItems.removedAt,
			createdAt: courseItems.createdAt,
			contentTitle: h5pContent.title,
			contentStatus: h5pContent.status,
			libraryTitle: h5pLibraries.title,
			libraryMachineName: h5pLibraries.machineName,
		})
		.from(courseItems)
		.leftJoin(h5pContent, eq(courseItems.contentId, h5pContent.id))
		.leftJoin(h5pLibraries, eq(h5pContent.libraryId, h5pLibraries.id))
		.where(and(eq(courseItems.courseId, courseId), isNull(courseItems.removedAt)))
		.orderBy(asc(courseItems.sortOrder));

	const result: CourseWithItems = {
		id: course.id,
		orgId: course.orgId,
		title: course.title,
		slug: course.slug,
		description: course.description,
		coverImage: course.coverImage,
		status: course.status,
		publishedAt: course.publishedAt,
		archivedAt: course.archivedAt,
		deletedAt: course.deletedAt,
		createdAt: course.createdAt,
		updatedAt: course.updatedAt,
		createdBy: course.createdBy,
		items: items as CourseItemWithContent[],
	};

	return result;
});

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Create a new course.
 * Auto-generates a slug from the title with uniqueness enforcement.
 */
export const createCourse = command(CreateCourseSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);
	const userId = getUserId();

	// Enforce subscription course limit
	await enforceCourseLimit();

	// Generate slug from title
	let slug = generateSlug(data.title);
	let counter = 1;
	const baseSlug = slug;

	// Ensure slug is unique within the organisation (non-deleted courses)
	while (true) {
		const [existing] = await db
			.select({ id: courses.id })
			.from(courses)
			.where(
				and(
					eq(courses.orgId, context.organisationId),
					eq(courses.slug, slug),
					isNull(courses.deletedAt),
				),
			)
			.limit(1);

		if (!existing) break;

		slug = `${baseSlug}-${counter}`;
		counter++;

		if (counter > 100) {
			throw error(500, "Unable to generate unique slug");
		}
	}

	const [course] = await db
		.insert(courses)
		.values({
			orgId: context.organisationId,
			createdBy: userId,
			title: data.title,
			slug,
			description: data.description || "",
		})
		.returning();

	if (!course) {
		throw error(500, "Failed to create course");
	}

	// Log activity
	await logActivity("course.created", "course", course.id, {
		newValues: { title: data.title, slug },
	});

	return course;
});

/**
 * Update an existing course.
 * Implements status state machine: draft<->published, published->archived, archived->draft.
 */
export const updateCourse = command(UpdateCourseSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify course belongs to org
	const [course] = await db
		.select()
		.from(courses)
		.where(
			and(
				eq(courses.id, data.courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.title !== undefined) updates["title"] = data.title;
	if (data.description !== undefined) updates["description"] = data.description;
	if (data.coverImage !== undefined) updates["coverImage"] = data.coverImage;

	// Handle status transitions with state machine
	if (data.status !== undefined && data.status !== course.status) {
		const currentStatus = course.status;
		const newStatus = data.status;

		// Validate allowed transitions
		const allowedTransitions: Record<string, string[]> = {
			draft: ["published"],
			published: ["draft", "archived"],
			archived: ["draft"],
		};

		const allowed = allowedTransitions[currentStatus];
		if (!allowed || !allowed.includes(newStatus)) {
			throw error(400, `Cannot transition from '${currentStatus}' to '${newStatus}'`);
		}

		updates["status"] = newStatus;

		if (newStatus === "published") {
			updates["publishedAt"] = new Date();
		} else if (newStatus === "archived") {
			updates["archivedAt"] = new Date();
		} else if (newStatus === "draft" && currentStatus === "archived") {
			updates["archivedAt"] = null;
		}
	}

	await db.update(courses).set(updates).where(eq(courses.id, data.courseId));

	// Log activity
	await logActivity("course.updated", "course", data.courseId, {
		newValues: updates,
	});
});

/**
 * Soft-delete a course.
 */
export const deleteCourse = command(v.pipe(v.string(), v.uuid()), async (courseId) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify course belongs to org
	const [course] = await db
		.select({ id: courses.id, title: courses.title })
		.from(courses)
		.where(
			and(
				eq(courses.id, courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	await db
		.update(courses)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(courses.id, courseId));

	// Log activity
	await logActivity("course.deleted", "course", courseId, {
		oldValues: { title: course.title },
	});
});

/**
 * Add an item to a course.
 * Automatically assigns the next sort order position.
 */
export const addCourseItem = command(AddCourseItemSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify course belongs to org
	const [course] = await db
		.select({ id: courses.id })
		.from(courses)
		.where(
			and(
				eq(courses.id, data.courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	// Get max sort_order for this course
	const [maxSort] = await db
		.select({
			maxOrder: sql<number>`COALESCE(MAX(${courseItems.sortOrder}), -1)`.mapWith(Number),
		})
		.from(courseItems)
		.where(and(eq(courseItems.courseId, data.courseId), isNull(courseItems.removedAt)));

	const nextSortOrder = (maxSort?.maxOrder ?? -1) + 1;

	const [item] = await db
		.insert(courseItems)
		.values({
			courseId: data.courseId,
			contentId: data.contentId || null,
			sortOrder: nextSortOrder,
			title: data.title,
			itemType: data.itemType,
			bodyMarkdown: data.bodyMarkdown || null,
		})
		.returning();

	if (!item) {
		throw error(500, "Failed to add course item");
	}

	// Update course's updatedAt
	await db
		.update(courses)
		.set({ updatedAt: new Date() })
		.where(eq(courses.id, data.courseId));

	// Log activity
	await logActivity("course.item.added", "course_item", item.id, {
		newValues: { courseId: data.courseId, title: data.title, itemType: data.itemType },
	});

	return item;
});

/**
 * Soft-remove a course item.
 */
export const removeCourseItem = command(v.pipe(v.string(), v.uuid()), async (itemId) => {
	await requireOrganisationRole(["owner", "admin"]);

	// Get the item to find its course, then verify org ownership
	const [item] = await db
		.select({
			id: courseItems.id,
			courseId: courseItems.courseId,
			title: courseItems.title,
		})
		.from(courseItems)
		.where(and(eq(courseItems.id, itemId), isNull(courseItems.removedAt)))
		.limit(1);

	if (!item) {
		throw error(404, "Course item not found");
	}

	// Verify the course belongs to the current org
	const context = await getOrganisationContext();
	const [course] = await db
		.select({ id: courses.id })
		.from(courses)
		.where(
			and(
				eq(courses.id, item.courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	await db
		.update(courseItems)
		.set({ removedAt: new Date(), updatedAt: new Date() })
		.where(eq(courseItems.id, itemId));

	// Update course's updatedAt
	await db
		.update(courses)
		.set({ updatedAt: new Date() })
		.where(eq(courses.id, item.courseId));

	// Log activity
	await logActivity("course.item.removed", "course_item", itemId, {
		oldValues: { courseId: item.courseId, title: item.title },
	});
});

/**
 * Update a course item's title or body markdown.
 */
export const updateCourseItem = command(UpdateCourseItemSchema, async (data) => {
	await requireOrganisationRole(["owner", "admin"]);

	// Get the item to find its course
	const [item] = await db
		.select({
			id: courseItems.id,
			courseId: courseItems.courseId,
		})
		.from(courseItems)
		.where(and(eq(courseItems.id, data.itemId), isNull(courseItems.removedAt)))
		.limit(1);

	if (!item) {
		throw error(404, "Course item not found");
	}

	// Verify the course belongs to the current org
	const context = await getOrganisationContext();
	const [course] = await db
		.select({ id: courses.id })
		.from(courses)
		.where(
			and(
				eq(courses.id, item.courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.title !== undefined) updates["title"] = data.title;
	if (data.bodyMarkdown !== undefined) updates["bodyMarkdown"] = data.bodyMarkdown;

	await db.update(courseItems).set(updates).where(eq(courseItems.id, data.itemId));

	// Update course's updatedAt
	await db
		.update(courses)
		.set({ updatedAt: new Date() })
		.where(eq(courses.id, item.courseId));

	// Log activity
	await logActivity("course.item.updated", "course_item", data.itemId, {
		newValues: updates,
	});
});

/**
 * Reorder course items by updating their sort_order values.
 */
export const reorderCourseItems = command(ReorderCourseItemsSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify course belongs to org
	const [course] = await db
		.select({ id: courses.id })
		.from(courses)
		.where(
			and(
				eq(courses.id, data.courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	// Batch update each item's sort_order
	for (const item of data.items) {
		await db
			.update(courseItems)
			.set({ sortOrder: item.sortOrder, updatedAt: new Date() })
			.where(and(eq(courseItems.id, item.id), eq(courseItems.courseId, data.courseId)));
	}

	// Update course's updatedAt
	await db
		.update(courses)
		.set({ updatedAt: new Date() })
		.where(eq(courses.id, data.courseId));

	// Log activity
	await logActivity("course.items.reordered", "course", data.courseId, {
		newValues: { itemCount: data.items.length },
	});
});

/**
 * Publish a course.
 * Validates the course is in draft status and has at least one active item.
 */
export const publishCourse = command(v.pipe(v.string(), v.uuid()), async (courseId) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify course belongs to org and is in draft status
	const [course] = await db
		.select()
		.from(courses)
		.where(
			and(
				eq(courses.id, courseId),
				eq(courses.orgId, context.organisationId),
				isNull(courses.deletedAt),
			),
		)
		.limit(1);

	if (!course) {
		throw error(404, "Course not found");
	}

	if (course.status !== "draft") {
		throw error(400, "Only draft courses can be published");
	}

	// Count active items
	const [itemCount] = await db
		.select({ count: count() })
		.from(courseItems)
		.where(and(eq(courseItems.courseId, courseId), isNull(courseItems.removedAt)));

	if (!itemCount || itemCount.count < 1) {
		throw error(400, "Course must have at least one item before publishing");
	}

	await db
		.update(courses)
		.set({
			status: "published",
			publishedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(courses.id, courseId));

	// Log activity
	await logActivity("course.published", "course", courseId, {
		newValues: { status: "published", title: course.title },
	});
});
