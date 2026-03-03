<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import { Play, CheckCircle, Clock } from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import { enrolInCourse } from "$lib/api/enrolments.remote";
	import CourseCard from "$lib/components/courses/CourseCard.svelte";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let enrolmentsList = $derived(data.enrolments);
	let publishedCourses = $derived(data.publishedCourses);

	// Courses the user is NOT enrolled in
	let enrolledCourseIds = $derived(new Set(enrolmentsList.map((e) => e.courseId)));
	let browsableCourses = $derived(
		publishedCourses.filter((c) => !enrolledCourseIds.has(c.id)),
	);

	let enrollingCourseId = $state<string | null>(null);

	async function handleEnrol(courseId: string) {
		enrollingCourseId = courseId;
		try {
			await enrolInCourse(courseId);
			await invalidateAll();
		} finally {
			enrollingCourseId = null;
		}
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return "—";
		try {
			return new Date(date).toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch {
			return "—";
		}
	}
</script>

<!-- Page Header -->
<div class="mb-6">
	<h1 class="text-2xl font-bold flex items-center gap-2">
		<FEATURES.learn.icon class="h-7 w-7" style="color: {FEATURES.learn.color}" />
		Learn
	</h1>
	<p class="text-base-content/60 mt-1">Your enrolled courses and available learning content.</p>
</div>

<!-- My Courses -->
{#if enrolmentsList.length > 0}
	<h2 class="text-lg font-semibold mb-3">My Courses</h2>
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
		{#each enrolmentsList as enrolment (enrolment.id)}
			<div class="relative">
				<CourseCard
					title={enrolment.course.title}
					description={enrolment.course.description || ""}
					status={enrolment.course.status}
					itemCount={enrolment.progress.totalItems}
					enrolmentCount={0}
					coverImage={enrolment.course.coverImage}
					href="/{organisationSlug}/learn/{enrolment.courseId}"
					view="card"
					progress={{
						completedItems: enrolment.progress.completedItems,
						totalItems: enrolment.progress.totalItems,
						percentage: enrolment.progress.percentage,
					}}
				/>
				<!-- Status overlay -->
				<div class="absolute top-2 right-2">
					{#if enrolment.status === "completed"}
						<span class="badge badge-success badge-sm gap-1">
							<CheckCircle class="h-3 w-3" />
							Complete
						</span>
					{:else}
						<span class="badge badge-info badge-sm gap-1">
							<Play class="h-3 w-3" />
							Continue
						</span>
					{/if}
				</div>
				<div class="absolute bottom-2 right-4">
					<span class="text-xs text-base-content/50 flex items-center gap-1">
						<Clock class="h-3 w-3" />
						Enrolled {formatDate(enrolment.enrolledAt)}
					</span>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Browse Courses -->
{#if browsableCourses.length > 0}
	<h2 class="text-lg font-semibold mb-3">
		{enrolmentsList.length > 0 ? "More Courses" : "Available Courses"}
	</h2>
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each browsableCourses as course (course.id)}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-5">
					<h3 class="card-title text-base">{course.title}</h3>
					{#if course.description}
						<p class="text-sm text-base-content/60 line-clamp-2">{course.description}</p>
					{/if}

					<div class="flex items-center gap-2 mt-2 text-xs text-base-content/50">
						<span>{course.itemCount} items</span>
						<span>{course.enrolmentCount} enrolled</span>
						{#if course.totalDurationMinutes && course.totalDurationMinutes > 0}
							<span class="flex items-center gap-0.5">
								<Clock class="h-3 w-3" />
								{course.totalDurationMinutes < 60
									? `${course.totalDurationMinutes} min`
									: `${Math.floor(course.totalDurationMinutes / 60)}h ${course.totalDurationMinutes % 60 > 0 ? `${course.totalDurationMinutes % 60}m` : ""}`}
							</span>
						{/if}
					</div>

					<div class="card-actions mt-3">
						<button
							class="btn btn-primary btn-sm gap-1"
							onclick={() => handleEnrol(course.id)}
							disabled={enrollingCourseId === course.id}
						>
							{#if enrollingCourseId === course.id}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Play class="h-3.5 w-3.5" />
							{/if}
							Enrol
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else if enrolmentsList.length === 0}
	<div class="card bg-base-100 border border-base-300 p-12 text-center">
		<FEATURES.learn.icon
			class="h-12 w-12 mx-auto mb-4 opacity-30"
			style="color: {FEATURES.learn.color}"
		/>
		<h3 class="text-lg font-semibold mb-2">No courses available</h3>
		<p class="text-base-content/60">Check back later for new learning courses.</p>
	</div>
{/if}
