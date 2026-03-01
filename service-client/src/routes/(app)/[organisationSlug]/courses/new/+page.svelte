<script lang="ts">
	import type { PageProps } from "./$types";
	import { goto } from "$app/navigation";
	import { ArrowLeft } from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import { createCourse } from "$lib/api/courses.remote";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);

	let title = $state("");
	let description = $state("");
	let saving = $state(false);
	let errorMessage = $state("");

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!title.trim()) return;

		saving = true;
		errorMessage = "";

		try {
			const course = await createCourse({ title: title.trim(), description: description.trim() });
			await goto(`/${organisationSlug}/courses/${course.id}/edit`);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : "Failed to create course";
			saving = false;
		}
	}
</script>

<!-- Header -->
<div class="mb-6">
	<a href="/{organisationSlug}/courses" class="btn btn-ghost btn-sm gap-1 mb-4">
		<ArrowLeft class="h-4 w-4" />
		Back to Courses
	</a>
	<h1 class="text-2xl font-bold flex items-center gap-2">
		<FEATURES.courses.icon class="h-7 w-7" style="color: {FEATURES.courses.color}" />
		New Course
	</h1>
	<p class="text-base-content/60 mt-1">Create a new learning course. You can add content after creation.</p>
</div>

<!-- Form -->
<div class="card bg-base-100 border border-base-300 max-w-2xl">
	<div class="card-body">
		{#if errorMessage}
			<div class="alert alert-error mb-4">
				<span>{errorMessage}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit}>
			<div class="form-control mb-4">
				<label class="label" for="course-title">
					<span class="label-text font-medium">Title <span class="text-error">*</span></span>
				</label>
				<input
					id="course-title"
					type="text"
					class="input input-bordered"
					placeholder="e.g. Introduction to Safety Procedures"
					bind:value={title}
					required
					disabled={saving}
				/>
			</div>

			<div class="form-control mb-6">
				<label class="label" for="course-description">
					<span class="label-text font-medium">Description</span>
				</label>
				<textarea
					id="course-description"
					class="textarea textarea-bordered h-24"
					placeholder="Brief description of the course..."
					bind:value={description}
					disabled={saving}
				></textarea>
			</div>

			<div class="flex gap-2">
				<button
					type="submit"
					class="btn btn-primary"
					disabled={saving || !title.trim()}
				>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Create Course
				</button>
				<a href="/{organisationSlug}/courses" class="btn btn-ghost">
					Cancel
				</a>
			</div>
		</form>
	</div>
</div>
