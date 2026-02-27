<script>
	import { authClient } from '@actions/authClient';
	import { Organization } from '@actions/user.svelte';
	import { toast } from '@components/Toast.svelte';
	import { goto } from '$app/navigation';
	import Spinner from '@components/Spinner.svelte';
	import Button from '@components/Button.svelte';
	import Modal from '@components/Modal.svelte';
	import Input from '@components/Input.svelte';
	import Select from '@components/Select.svelte';
	import CourseCard from './CourseCard.svelte';
	import CreateCourseModal from './CreateCourseModal.svelte';
	import Search from '@icons/search.svelte';
	import ListFilter from '@icons/list-filter.svelte';
	import Plus from '@icons/plus.svelte';
	import BookOpen from '@icons/book-open.svelte';
	import Users from '@icons/users.svelte';
	import Calendar from '@icons/calendar.svelte';

	// Props
	let { 
		view = 'grid', // 'grid' or 'list'
		showCreateButton = true,
		filterByInstructor = false
	} = $props();

	// State
	let courses = $state([]);
	let isLoading = $state(true);
	let error = $state(null);
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let sortBy = $state('updated'); // 'created', 'updated', 'title', 'students'
	let page = $state(1);
	let totalPages = $state(1);
	let limit = $state(12);
	let showCreateModal = $state(false);

	// Auth
	const session = authClient.useSession();
	const organization = Organization.useActiveOrganization();

	// Derived
	let organizationId = $derived($organization.data?.id);
	let currentUser = $derived($session.data?.user);
	let userRole = $derived(currentUser?.role);
	
	// Break down permission conditions for better debugging
	let sessionNotPending = $derived(!$session.isPending);
	let sessionNotRefetching = $derived(!$session.isRefetching);
	let hasUser = $derived(!!currentUser);
	let hasValidRole = $derived(userRole === 'admin' || userRole === 'instructor');
	
	let hasPermission = $derived(
		sessionNotPending && 
		sessionNotRefetching && 
		hasUser && 
		hasValidRole
	);
	
	// Function to manually refresh session
	async function refreshSession() {
		try {
			console.log('Manually refreshing session...');
			await $session.refetch();
			console.log('Session refreshed!', $session.data);
		} catch (error) {
			console.error('Error refreshing session:', error);
		}
	}

	// Debug permissions (disabled in production)
	// $effect(() => {
	//   console.log('CourseManager permissions:', { hasPermission, userRole });
	// });
	
	// Add session refetch function for debugging
	async function refetchSession() {
		console.log('Manually refetching session...');
		await $session.refetch();
	}

	// Add function to fetch session from API directly for comparison
	async function debugSessionFromAPI() {
		try {
			console.log('Fetching session data directly from API...');
			const response = await fetch('/api/auth/get-session');
			const sessionFromAPI = await response.json();
			console.log('Session from API:', sessionFromAPI);
			
			// Compare with client state
			console.log('Client session state vs API session:', {
				clientSession: $session.data,
				apiSession: sessionFromAPI,
				match: JSON.stringify($session.data) === JSON.stringify(sessionFromAPI)
			});
		} catch (error) {
			console.error('Error fetching session from API:', error);
		}
	}

	// Load courses
	async function loadCourses() {
		if (!organizationId) {
			isLoading = false;
			error = 'No organization selected. Please join or create an organization to manage courses.';
			return;
		}
		
		try {
			isLoading = true;
			error = null;

			const params = new URLSearchParams({
				page: page.toString(),
				limit: limit.toString(),
				sort: sortBy
			});

			if (searchQuery.trim()) {
				params.set('search', searchQuery.trim());
			}

			if (statusFilter !== 'all') {
				params.set('status', statusFilter);
			}

			if (filterByInstructor && currentUser) {
				params.set('instructorId', currentUser.id);
			}

			const url = `/api/private/courses?${params}`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to load courses: ${response.statusText}`);
			}

			const data = await response.json();
			
			// Ensure we have a clean array and avoid proxy issues
			const newCourses = Array.isArray(data.data) ? [...data.data] : [];
			courses = newCourses;
			totalPages = data.pagination?.pages || 1;
		} catch (err) {
			console.error('Error loading courses:', err);
			error = err.message;
			toast.error('Failed to load courses');
		} finally {
			isLoading = false;
		}
	}

	// Create new course
	async function createCourse(courseData) {
		try {
			const response = await fetch('/api/private/courses', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...courseData,
					organizationId
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to create course');
			}

			const result = await response.json();
			toast.success('Course created successfully!');
			showCreateModal = false;
			loadCourses(); // Reload courses
			
			// Redirect to course editor
			goto(`/instructor/courses/${result.courseId}`);
		} catch (err) {
			console.error('Error creating course:', err);
			toast.error(err.message || 'Failed to create course');
		}
	}

	// Handle search with debouncing
	$effect(() => {
		if (searchQuery !== undefined) {
			const timeoutId = setTimeout(() => {
				page = 1;
				loadCourses();
			}, 300);
			return () => clearTimeout(timeoutId);
		}
	});

	// Handle filter changes
	$effect(() => {
		if (statusFilter !== undefined || sortBy !== undefined) {
			page = 1;
			loadCourses();
		}
	});

	// Watch for organizationId changes and load courses when available
	$effect(() => {
		if (organizationId) {
			loadCourses();
		} else {
			courses = [];
			isLoading = false;
		}
	});
</script>

<div class="course-manager">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h2 class="text-2xl font-bold">Course Management</h2>
			<p class="text-secondary-4 mt-1">Create and manage your courses</p>
		</div>
		
		{#if hasPermission && showCreateButton}
			<Button onclick={() => showCreateModal = true} variant="primary">
				<Plus size={16} />
				Create Course
			</Button>
		{/if}
	</div>

	<!-- Search and Filters -->
	<div class="card p-4 mb-6">
		<div class="flex flex-col lg:flex-row gap-4">
			<!-- Search -->
			<div class="flex-1">
				<Input
					Icon={Search}
					IconSize={20}
					type="text"
					bind:value={searchQuery}
					placeholder="Search courses by title or description..."
				/>
			</div>

			<!-- Filters -->
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<ListFilter size={16} class="text-secondary-4" />
					<Select
						bind:value={statusFilter}
						options={[
							{ name: 'All Status', value: 'all' },
							{ name: 'Draft', value: 'draft' },
							{ name: 'Published', value: 'published' },
							{ name: 'Archived', value: 'archived' }
						]}
						placeholder="All Status"
					/>
				</div>

				<div class="flex items-center gap-2">
					<span class="text-sm text-secondary-4">Sort:</span>
					<Select
						bind:value={sortBy}
						options={[
							{ name: 'Recently Updated', value: 'updated' },
							{ name: 'Recently Created', value: 'created' },
							{ name: 'Title A-Z', value: 'title' },
							{ name: 'Most Students', value: 'students' }
						]}
						placeholder="Recently Updated"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if isLoading}
		<div class="flex justify-center py-12">
			<Spinner size={32} />
		</div>
	{/if}

	<!-- Error State -->
	{#if error && !isLoading}
		<div class="card p-8 text-center">
			<h3 class="text-lg font-semibold text-danger mb-2">Error Loading Courses</h3>
			<p class="text-secondary-4 mb-4">{error}</p>
			<Button onclick={loadCourses}>Retry</Button>
		</div>
	{/if}

	<!-- Courses Grid/List -->
	{#if !isLoading && !error}
		{#if courses && Array.isArray(courses) && courses.length > 0}
			{#if view === 'grid'}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each courses as course}
						<CourseCard 
							{course} 
							{currentUser}
							onUpdate={loadCourses}
						/>
					{/each}
				</div>
			{:else}
				<div class="space-y-4">
					{#each courses as course}
						<CourseCard 
							{course} 
							{currentUser}
							view="list"
							onUpdate={loadCourses}
						/>
					{/each}
				</div>
			{/if}

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="flex justify-center items-center gap-2 mt-8">
					<Button 
						variant="outline" 
						disabled={page === 1}
						onclick={() => { page = Math.max(1, page - 1); loadCourses(); }}
					>
						Previous
					</Button>
					
					<span class="px-4 py-2 text-sm">
						Page {page} of {totalPages}
					</span>
					
					<Button 
						variant="outline"
						disabled={page === totalPages}
						onclick={() => { page = Math.min(totalPages, page + 1); loadCourses(); }}
					>
						Next
					</Button>
				</div>
			{/if}
		{:else}
			<!-- Empty State -->
			<div class="card p-12 text-center">
				<div class="w-16 h-16 bg-primary-2 rounded-full flex items-center justify-center mx-auto mb-4">
					<BookOpen size={24} class="text-secondary-4" />
				</div>
				<h3 class="text-lg font-semibold mb-2">No Courses Found</h3>
				<p class="text-secondary-4 mb-6">
					{#if searchQuery || statusFilter !== 'all'}
						Try adjusting your search or filters to find courses.
					{:else}
						Start creating your first course with interactive H5P content.
					{/if}
				</p>
				{#if hasPermission && showCreateButton && !searchQuery && statusFilter === 'all'}
					<Button onclick={() => showCreateModal = true} variant="primary">
						<Plus size={16} />
						Create Your First Course
					</Button>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Create Course Modal -->
{#if showCreateModal}
	<CreateCourseModal 
		bind:show={showCreateModal}
		onCreate={createCourse}
	/>
{/if}

<style>
	.course-manager {
		width: 100%;
	}
</style>