<script>
	import { toast } from '@components/Toast.svelte';
	import Button from '@components/Button.svelte';
	import Eye from '@icons/eye.svelte';
	import PencilLine from '@icons/pencil-line.svelte';
	import Users from '@icons/users.svelte';
	import Clock from '@icons/clock.svelte';
	import Calendar from '@icons/calendar.svelte';
	import Ellipsis from '@icons/ellipsis.svelte';
	import Play from '@icons/play.svelte';
	import Settings from '@icons/settings.svelte';
	import Archive from '@icons/archive.svelte';
	import Trash2 from '@icons/trash-2.svelte';
	import BookOpen from '@icons/book-open.svelte';

	// Props
	let { 
		course,
		currentUser,
		view = 'card', // 'card' or 'list'
		onUpdate = null
	} = $props();

	// State
	let showActions = $state(false);
	let isProcessing = $state(false);

	// Derived
	let canEdit = $derived(currentUser && (
		currentUser.role === 'admin' || 
		course.instructors?.some(i => i.id === currentUser.id)
	));
	let statusColor = $derived({
		draft: 'bg-warning text-warning-foreground',
		published: 'bg-success text-success-foreground',
		archived: 'bg-secondary text-secondary-foreground'
	}[course.status] || 'bg-primary');

	// Format date
	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Get course duration in a readable format
	function getCourseDuration(estimatedHours) {
		if (!estimatedHours) return 'Self-paced';
		if (estimatedHours < 1) return `${Math.ceil(estimatedHours * 60)} min`;
		return `${estimatedHours} ${estimatedHours === 1 ? 'hour' : 'hours'}`;
	}

	// Delete course
	async function deleteCourse() {
		if (!confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
			return;
		}

		try {
			isProcessing = true;
			const response = await fetch(`/api/private/courses/${course.courseId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete course');
			}

			toast.success('Course deleted successfully');
			if (onUpdate) onUpdate();
		} catch (err) {
			console.error('Error deleting course:', err);
			toast.error('Failed to delete course');
		} finally {
			isProcessing = false;
			showActions = false;
		}
	}

	// Archive/Unarchive course
	async function toggleArchive() {
		const newStatus = course.status === 'archived' ? 'draft' : 'archived';
		const action = newStatus === 'archived' ? 'archive' : 'restore';

		try {
			isProcessing = true;
			const response = await fetch(`/api/private/courses/${course.courseId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: newStatus })
			});

			if (!response.ok) {
				throw new Error(`Failed to ${action} course`);
			}

			toast.success(`Course ${action}d successfully`);
			if (onUpdate) onUpdate();
		} catch (err) {
			console.error(`Error ${action}ing course:`, err);
			toast.error(`Failed to ${action} course`);
		} finally {
			isProcessing = false;
			showActions = false;
		}
	}
</script>

{#if view === 'list'}
	<!-- List View -->
	<div class="card hover:shadow-lg transition-shadow duration-200">
		<div class="flex items-center p-6 gap-6">
			<!-- Course Thumbnail -->
			<div class="w-24 h-16 bg-primary-2 rounded-lg flex-shrink-0 relative overflow-hidden">
				{#if course.thumbnail}
					<img src={course.thumbnail} alt={course.title} class="w-full h-full object-cover" />
				{:else}
					<div class="w-full h-full flex items-center justify-center">
						<BookOpen size={20} class="text-secondary-4" />
					</div>
				{/if}
			</div>

			<!-- Course Info -->
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between mb-2">
					<div>
						<h3 class="font-semibold text-lg truncate pr-4">{course.title}</h3>
						<div class="flex items-center gap-2 mt-1">
							<span class="badge {statusColor} text-xs">{course.status}</span>
							{#if course.level}
								<span class="text-sm text-secondary-4">{course.level}</span>
							{/if}
						</div>
					</div>

					<div class="relative">
						<button 
							class="button icon-sm"
							onclick={() => showActions = !showActions}
							disabled={isProcessing}
						>
							<Ellipsis size={16} />
						</button>
						
						{#if showActions}
							<div class="absolute right-0 top-full mt-1 bg-white border border-primary-3 rounded-lg shadow-lg py-1 z-10 min-w-40">
								<a href="/learn/{course.courseId}" class="flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
									<Eye size={14} />
									View Course
								</a>
								{#if canEdit}
									<a href="/instructor/courses/{course.courseId}" class="flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
										<PencilLine size={14} />
										Edit Course
									</a>
									<button onclick={toggleArchive} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
										<Archive size={14} />
										{course.status === 'archived' ? 'Restore' : 'Archive'}
									</button>
									<button onclick={deleteCourse} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm text-danger">
										<Trash2 size={14} />
										Delete
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				{#if course.description}
					<p class="text-secondary-4 text-sm mb-3 line-clamp-2">{course.description}</p>
				{/if}

				<!-- Metadata -->
				<div class="flex items-center gap-6 text-xs text-secondary-4">
					<div class="flex items-center gap-1">
						<Users size={12} />
						<span>{course.enrolledCount || 0} students</span>
					</div>
					<div class="flex items-center gap-1">
						<Clock size={12} />
						<span>{getCourseDuration(course.estimatedHours)}</span>
					</div>
					<div class="flex items-center gap-1">
						<Calendar size={12} />
						<span>Updated {formatDate(course.updatedAt)}</span>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="flex items-center gap-2">
				<Button href="/learn/{course.courseId}" variant="outline" size="sm">
					<Play size={14} />
					View
				</Button>
				{#if canEdit}
					<Button href="/instructor/courses/{course.courseId}" variant="primary" size="sm">
						<PencilLine size={14} />
						Edit
					</Button>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<!-- Card View -->
	<div class="card hover:shadow-lg transition-shadow duration-200 relative">
		<!-- Action Menu -->
		<div class="absolute top-3 right-3 z-10">
			<div class="relative">
				<button 
					class="button icon-sm bg-white/80 hover:bg-white shadow-sm"
					onclick={() => showActions = !showActions}
					disabled={isProcessing}
				>
					<Ellipsis size={16} />
				</button>
				
				{#if showActions}
					<div class="absolute right-0 top-full mt-1 bg-white border border-primary-3 rounded-lg shadow-lg py-1 z-20 min-w-40">
						<a href="/learn/{course.courseId}" class="flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
							<Eye size={14} />
							View Course
						</a>
						{#if canEdit}
							<a href="/instructor/courses/{course.courseId}" class="flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
								<PencilLine size={14} />
								Edit Course
							</a>
							<a href="/instructor/courses/{course.courseId}/settings" class="flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
								<Settings size={14} />
								Settings
							</a>
							<button onclick={toggleArchive} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm">
								<Archive size={14} />
								{course.status === 'archived' ? 'Restore' : 'Archive'}
							</button>
							<button onclick={deleteCourse} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary-2 text-sm text-danger">
								<Trash2 size={14} />
								Delete
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Course Thumbnail -->
		<div class="aspect-video bg-primary-2 rounded-t-lg relative overflow-hidden">
			{#if course.thumbnail}
				<img src={course.thumbnail} alt={course.title} class="w-full h-full object-cover" />
			{:else}
				<div class="w-full h-full flex items-center justify-center">
					<BookOpen size={32} class="text-secondary-4" />
				</div>
			{/if}
			
			<!-- Status Badge -->
			<div class="absolute top-3 left-3">
				<span class="badge {statusColor} text-xs">
					{course.status}
				</span>
			</div>
		</div>

		<!-- Course Info -->
		<div class="p-4">
			<div class="mb-3">
				<h3 class="font-semibold text-lg mb-1 line-clamp-1">{course.title}</h3>
				{#if course.level}
					<p class="text-sm text-secondary-4">{course.level} Level</p>
				{/if}
			</div>
			
			{#if course.description}
				<p class="text-secondary-4 text-sm mb-4 line-clamp-2">
					{course.description}
				</p>
			{/if}

			<!-- Instructor Info -->
			{#if course.instructors?.length > 0}
				<div class="flex items-center gap-2 mb-3">
					<div class="flex items-center -space-x-1">
						{#each course.instructors.slice(0, 2) as instructor}
							<div class="w-6 h-6 bg-primary-accent rounded-full flex items-center justify-center text-xs text-white border border-white">
								{instructor.name?.charAt(0) || 'I'}
							</div>
						{/each}
						{#if course.instructors.length > 2}
							<div class="w-6 h-6 bg-secondary-4 rounded-full flex items-center justify-center text-xs text-white border border-white">
								+{course.instructors.length - 2}
							</div>
						{/if}
					</div>
					<span class="text-xs text-secondary-4">
						{course.instructors[0]?.name || 'Unknown Instructor'}
						{#if course.instructors.length > 1}
							+ {course.instructors.length - 1} more
						{/if}
					</span>
				</div>
			{/if}

			<!-- Metadata -->
			<div class="flex items-center justify-between text-xs text-secondary-4 mb-4">
				<div class="flex items-center gap-1">
					<Users size={12} />
					<span>{course.enrolledCount || 0} students</span>
				</div>
				<div class="flex items-center gap-1">
					<Clock size={12} />
					<span>{getCourseDuration(course.estimatedHours)}</span>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-2">
				<Button href="/learn/{course.courseId}" variant="outline" size="sm" full>
					<Play size={14} />
					View Course
				</Button>
				{#if canEdit}
					<Button href="/instructor/courses/{course.courseId}" variant="primary" size="sm" full>
						<PencilLine size={14} />
						Edit
					</Button>
				{/if}
			</div>
		</div>

		<!-- Course Progress (if available) -->
		{#if course.progress !== undefined}
			<div class="px-4 pb-4">
				<div class="flex justify-between items-center text-xs text-secondary-4 mb-1">
					<span>Progress</span>
					<span>{course.progress}%</span>
				</div>
				<div class="w-full bg-primary-2 rounded-full h-1.5">
					<div 
						class="bg-primary-accent h-1.5 rounded-full transition-all duration-300"
						style="width: {course.progress}%"
					></div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>