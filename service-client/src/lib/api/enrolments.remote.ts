/**
 * Enrolments Remote Functions
 *
 * Manages learner enrolments in courses: enrol, withdraw, and progress tracking.
 * Progress records are lazy-initialized via xAPI — not pre-created on enrolment.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { enrolments, courses, courseItems, progressRecords, users } from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import { getOrganisationContext, requireOrganisationRole } from "$lib/server/organisation";
import { getUserId } from "$lib/server/auth";
import { eq, and, sql, asc, desc, isNull } from "drizzle-orm";

// =============================================================================
// Command Functions (Write Operations)
// =============================================================================

/**
 * Enrol the current user in a published course.
 *
 * - Verifies course exists, belongs to org, is published, and not deleted
 * - If previously withdrawn, reactivates the enrolment
 * - If already active or completed, throws an error
 * - No progress_records are pre-initialized (lazy init via xAPI)
 */
export const enrolInCourse = command(
	v.pipe(v.string(), v.uuid()),
	async (courseId) => {
		const context = await getOrganisationContext();
		const userId = getUserId();

		// Verify course exists, belongs to org, is published, not deleted
		const [course] = await db
			.select({ id: courses.id })
			.from(courses)
			.where(
				and(
					eq(courses.id, courseId),
					eq(courses.orgId, context.organisationId),
					eq(courses.status, "published"),
					isNull(courses.deletedAt),
				),
			)
			.limit(1);

		if (!course) {
			throw error(404, "Course not found or not available for enrolment");
		}

		// Check if user already has an enrolment (any status)
		const [existing] = await db
			.select({
				id: enrolments.id,
				status: enrolments.status,
			})
			.from(enrolments)
			.where(
				and(
					eq(enrolments.courseId, courseId),
					eq(enrolments.userId, userId),
				),
			)
			.limit(1);

		if (existing) {
			if (existing.status === "withdrawn") {
				// Reactivate withdrawn enrolment
				const [reactivated] = await db
					.update(enrolments)
					.set({
						status: "active",
						updatedAt: new Date(),
					})
					.where(eq(enrolments.id, existing.id))
					.returning();

				return reactivated;
			}

			// Already active or completed
			throw error(400, `You are already enrolled in this course (status: ${existing.status})`);
		}

		// Create new enrolment
		const [enrolment] = await db
			.insert(enrolments)
			.values({
				orgId: context.organisationId,
				courseId,
				userId,
				status: "active",
			})
			.returning();

		return enrolment;
	},
);

/**
 * Withdraw the current user from a course.
 *
 * Sets enrolment status to 'withdrawn'. Progress records are preserved.
 */
export const withdrawFromCourse = command(
	v.pipe(v.string(), v.uuid()),
	async (courseId) => {
		const context = await getOrganisationContext();
		const userId = getUserId();

		// Find the active enrolment
		const [enrolment] = await db
			.select({ id: enrolments.id })
			.from(enrolments)
			.where(
				and(
					eq(enrolments.courseId, courseId),
					eq(enrolments.userId, userId),
					eq(enrolments.orgId, context.organisationId),
					eq(enrolments.status, "active"),
				),
			)
			.limit(1);

		if (!enrolment) {
			throw error(404, "No active enrolment found for this course");
		}

		await db
			.update(enrolments)
			.set({
				status: "withdrawn",
				updatedAt: new Date(),
			})
			.where(eq(enrolments.id, enrolment.id));

		return { success: true };
	},
);

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

const MyEnrolmentsFiltersSchema = v.optional(
	v.object({
		status: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

/**
 * Get enrolments for the current user with course info and progress summary.
 *
 * Progress is calculated from course_items (total) and progress_records (completed).
 * Missing progress rows = "not started".
 */
export const getMyEnrolments = query(MyEnrolmentsFiltersSchema, async (filters) => {
	const context = await getOrganisationContext();
	const userId = getUserId();
	const { status, limit = 50, offset = 0 } = filters || {};

	// Build conditions
	const conditions = [
		eq(enrolments.orgId, context.organisationId),
		eq(enrolments.userId, userId),
	];

	if (status) {
		conditions.push(eq(enrolments.status, status));
	}

	// Get enrolments with course info
	const enrolmentRows = await db
		.select({
			id: enrolments.id,
			courseId: enrolments.courseId,
			status: enrolments.status,
			enrolledAt: enrolments.enrolledAt,
			completedAt: enrolments.completedAt,
			courseTitle: courses.title,
			courseSlug: courses.slug,
			courseDescription: courses.description,
			courseCoverImage: courses.coverImage,
			courseStatus: courses.status,
		})
		.from(enrolments)
		.innerJoin(courses, eq(enrolments.courseId, courses.id))
		.where(and(...conditions))
		.orderBy(desc(enrolments.enrolledAt))
		.limit(limit)
		.offset(offset);

	if (enrolmentRows.length === 0) {
		return [];
	}

	// Calculate progress for each enrolment
	const result = await Promise.all(
		enrolmentRows.map(async (row) => {
			// Total active items in the course
			const [totalResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(courseItems)
				.where(
					and(
						eq(courseItems.courseId, row.courseId),
						isNull(courseItems.removedAt),
					),
				);

			// Completed items for this enrolment
			const [completedResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(progressRecords)
				.where(
					and(
						eq(progressRecords.enrolmentId, row.id),
						eq(progressRecords.completed, true),
					),
				);

			const totalItems = totalResult?.count ?? 0;
			const completedItems = completedResult?.count ?? 0;
			const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

			return {
				id: row.id,
				courseId: row.courseId,
				status: row.status,
				enrolledAt: row.enrolledAt,
				completedAt: row.completedAt,
				course: {
					title: row.courseTitle,
					slug: row.courseSlug,
					description: row.courseDescription,
					coverImage: row.courseCoverImage,
					status: row.courseStatus,
				},
				progress: {
					totalItems,
					completedItems,
					percentage,
				},
			};
		}),
	);

	return result;
});

/**
 * Get all enrolments for a specific course (teacher/admin view).
 *
 * Returns user info and per-student progress.
 * Requires owner or admin role.
 */
export const getCourseEnrolments = query(
	v.pipe(v.string(), v.uuid()),
	async (courseId) => {
		const context = await requireOrganisationRole(["owner", "admin"]);

		// Verify course belongs to org
		const [course] = await db
			.select({ id: courses.id })
			.from(courses)
			.where(
				and(
					eq(courses.id, courseId),
					eq(courses.orgId, context.organisationId),
				),
			)
			.limit(1);

		if (!course) {
			throw error(404, "Course not found");
		}

		// Total active items in the course
		const [totalResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(courseItems)
			.where(
				and(
					eq(courseItems.courseId, courseId),
					isNull(courseItems.removedAt),
				),
			);

		const totalItems = totalResult?.count ?? 0;

		// Get enrolments with user info
		const enrolmentRows = await db
			.select({
				id: enrolments.id,
				status: enrolments.status,
				enrolledAt: enrolments.enrolledAt,
				completedAt: enrolments.completedAt,
				userId: enrolments.userId,
				userEmail: users.email,
				userAvatar: users.avatar,
			})
			.from(enrolments)
			.innerJoin(users, eq(enrolments.userId, users.id))
			.where(
				and(
					eq(enrolments.courseId, courseId),
					eq(enrolments.orgId, context.organisationId),
				),
			)
			.orderBy(asc(users.email));

		// Calculate completed items per student
		const result = await Promise.all(
			enrolmentRows.map(async (row) => {
				const [completedResult] = await db
					.select({ count: sql<number>`count(*)::int` })
					.from(progressRecords)
					.where(
						and(
							eq(progressRecords.enrolmentId, row.id),
							eq(progressRecords.completed, true),
						),
					);

				const completedItems = completedResult?.count ?? 0;
				const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

				return {
					id: row.id,
					status: row.status,
					enrolledAt: row.enrolledAt,
					completedAt: row.completedAt,
					user: {
						id: row.userId,
						email: row.userEmail,
						avatar: row.userAvatar,
					},
					progress: {
						totalItems,
						completedItems,
						percentage,
					},
				};
			}),
		);

		return result;
	},
);

/**
 * Get the current user's per-item progress for a course.
 *
 * Returns null if not enrolled. Otherwise returns each active course item
 * with its progress record (LEFT JOIN — missing rows = not started).
 */
export const getMyProgress = query(
	v.pipe(v.string(), v.uuid()),
	async (courseId) => {
		const context = await getOrganisationContext();
		const userId = getUserId();

		// Find the enrolment
		const [enrolment] = await db
			.select({ id: enrolments.id })
			.from(enrolments)
			.where(
				and(
					eq(enrolments.courseId, courseId),
					eq(enrolments.userId, userId),
					eq(enrolments.orgId, context.organisationId),
				),
			)
			.limit(1);

		if (!enrolment) {
			return null;
		}

		// Get all active course items LEFT JOINed with progress for this enrolment
		const items = await db
			.select({
				itemId: courseItems.id,
				title: courseItems.title,
				itemType: courseItems.itemType,
				sortOrder: courseItems.sortOrder,
				contentId: courseItems.contentId,
				completed: progressRecords.completed,
				score: progressRecords.score,
				maxScore: progressRecords.maxScore,
				timeSpent: progressRecords.timeSpent,
				attempts: progressRecords.attempts,
			})
			.from(courseItems)
			.leftJoin(
				progressRecords,
				and(
					eq(progressRecords.enrolmentId, enrolment.id),
					eq(progressRecords.contentId, courseItems.contentId),
				),
			)
			.where(
				and(
					eq(courseItems.courseId, courseId),
					isNull(courseItems.removedAt),
				),
			)
			.orderBy(asc(courseItems.sortOrder));

		return items.map((item) => ({
			itemId: item.itemId,
			title: item.title,
			itemType: item.itemType,
			sortOrder: item.sortOrder,
			contentId: item.contentId,
			completed: item.completed ?? false,
			score: item.score ? Number(item.score) : null,
			maxScore: item.maxScore ? Number(item.maxScore) : null,
			timeSpent: item.timeSpent ?? 0,
			attempts: item.attempts ?? 0,
		}));
	},
);

/**
 * Get aggregated course progress stats (teacher/admin view).
 *
 * Returns enrolment counts, completion rate, and average score.
 * Requires owner or admin role.
 */
export const getCourseProgress = query(
	v.pipe(v.string(), v.uuid()),
	async (courseId) => {
		const context = await requireOrganisationRole(["owner", "admin"]);

		// Verify course belongs to org
		const [course] = await db
			.select({ id: courses.id })
			.from(courses)
			.where(
				and(
					eq(courses.id, courseId),
					eq(courses.orgId, context.organisationId),
				),
			)
			.limit(1);

		if (!course) {
			throw error(404, "Course not found");
		}

		// Total enrolments by status
		const enrolmentStats = await db
			.select({
				status: enrolments.status,
				count: sql<number>`count(*)::int`,
			})
			.from(enrolments)
			.where(
				and(
					eq(enrolments.courseId, courseId),
					eq(enrolments.orgId, context.organisationId),
				),
			)
			.groupBy(enrolments.status);

		let totalEnrolments = 0;
		let activeEnrolments = 0;
		let completedEnrolments = 0;

		for (const stat of enrolmentStats) {
			totalEnrolments += stat.count;
			if (stat.status === "active") activeEnrolments = stat.count;
			if (stat.status === "completed") completedEnrolments = stat.count;
		}

		const completionRate =
			totalEnrolments > 0
				? Math.round((completedEnrolments / totalEnrolments) * 100)
				: 0;

		// Average score from progress_records for this course's enrolments
		const [scoreResult] = await db
			.select({
				avgScore: sql<number>`round(avg(${progressRecords.score}::numeric), 2)`,
			})
			.from(progressRecords)
			.innerJoin(enrolments, eq(progressRecords.enrolmentId, enrolments.id))
			.where(
				and(
					eq(enrolments.courseId, courseId),
					eq(enrolments.orgId, context.organisationId),
				),
			);

		// Total active items count
		const [itemsResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(courseItems)
			.where(
				and(
					eq(courseItems.courseId, courseId),
					isNull(courseItems.removedAt),
				),
			);

		return {
			totalEnrolments,
			activeEnrolments,
			completedEnrolments,
			completionRate,
			averageScore: scoreResult?.avgScore ? Number(scoreResult.avgScore) : null,
			totalItems: itemsResult?.count ?? 0,
		};
	},
);
