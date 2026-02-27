<script>
	import { onMount } from 'svelte';
	import Spinner from '@components/Spinner.svelte';
	import Button from '@components/Button.svelte';
	import Play from '@icons/play.svelte';
	import BookOpen from '@icons/book-open.svelte';
	import Clock from '@icons/clock.svelte';
	import CheckCircle from '@icons/circle-check.svelte';

	// Props
	let { 
		courseId,
		course = null,
		user = null,
		contentId = null,
		showSidebar = true,
		autoplay = false
	} = $props();

	// State
	let isLoading = $state(true);
	let error = $state(null);
	let courseData = $state(course);
	let content = $state([]);
	let currentContent = $state(null);
	let progress = $state([]);

	// Load course data
	async function loadCourse() {
		if (!courseId) return;

		try {
			isLoading = true;
			error = null;

			// If course data is provided via props, use it
			if (course) {
				courseData = course;
				// For now, create mock content from course modules
				content = course.modules?.map((module, index) => ({
					id: `module_${index}`,
					title: module.title || `Module ${index + 1}`,
					description: module.description || '',
					estimatedDuration: module.estimatedDuration || 10,
					type: 'h5p'
				})) || [];
				progress = [];

				// Set current content (first content item or specified contentId)
				if (contentId) {
					currentContent = content.find(c => c.id === contentId) || content[0];
				} else {
					currentContent = content[0];
				}
			} else {
				// Fallback to API call if no course data provided
				const response = await fetch(`/api/private/courses/${courseId}`);
				if (!response.ok) {
					throw new Error('Failed to load course');
				}

				const data = await response.json();
				courseData = data.course;
				content = data.content || [];
				progress = data.progress || [];

				// Set current content (first content item or specified contentId)
				if (contentId) {
					currentContent = content.find(c => c.id === contentId) || content[0];
				} else {
					currentContent = content[0];
				}
			}

		} catch (err) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	// Mark content as completed
	async function markCompleted(contentItemId) {
		try {
			const response = await fetch(`/api/private/progress`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					courseId,
					contentId: contentItemId,
					completed: true,
					progress: 100
				})
			});

			if (response.ok) {
				// Update local progress
				const existingProgress = progress.find(p => p.contentId === contentItemId);
				if (existingProgress) {
					existingProgress.completed = true;
					existingProgress.progress = 100;
				} else {
					progress = [...progress, {
						contentId: contentItemId,
						completed: true,
						progress: 100,
						completedAt: new Date()
					}];
				}
			}
		} catch (err) {
			console.error('Failed to mark content as completed:', err);
		}
	}

	// Get progress for content item
	function getProgressForContent(contentItemId) {
		return progress.find(p => p.contentId === contentItemId);
	}

	// Check if content is completed
	function isContentCompleted(contentItemId) {
		const prog = getProgressForContent(contentItemId);
		return prog?.completed || false;
	}

	// Update progress from H5P Player
	async function updateProgress(contentItemId, progressPercent) {
		try {
			// Update local progress
			const existingProgress = progress.find(p => p.contentId === contentItemId);
			if (existingProgress) {
				existingProgress.progress = Math.max(existingProgress.progress || 0, progressPercent);
			} else {
				progress = [...progress, {
					contentId: contentItemId,
					progress: progressPercent,
					completed: false,
					lastUpdated: new Date()
				}];
			}
		} catch (err) {
			console.error('Failed to update progress:', err);
		}
	}

	// Handle content completion from H5P Player
	async function handleContentComplete(contentItemId, completionData) {
		try {
			// Update local progress
			const existingProgress = progress.find(p => p.contentId === contentItemId);
			if (existingProgress) {
				existingProgress.completed = true;
				existingProgress.progress = 100;
				existingProgress.completedAt = new Date();
				if (completionData.score !== null) {
					existingProgress.score = completionData.score;
				}
				if (completionData.duration) {
					existingProgress.duration = completionData.duration;
				}
			} else {
				progress = [...progress, {
					contentId: contentItemId,
					completed: true,
					progress: 100,
					completedAt: new Date(),
					score: completionData.score,
					duration: completionData.duration
				}];
			}

			// Show completion notification
			console.log(`Content completed: ${contentItemId}`, completionData);
		} catch (err) {
			console.error('Failed to handle content completion:', err);
		}
	}

	onMount(() => {
		loadCourse();
	});
</script>

<div class="flex flex-col lg:flex-row min-h-screen bg-main">
	{#if isLoading}
		<div class="flex items-center justify-center flex-1 p-8">
			<div class="text-center">
				<Spinner size={32} />
				<p class="mt-4 text-secondary-4">Loading course...</p>
			</div>
		</div>
	{:else if error}
		<div class="flex items-center justify-center flex-1 p-8">
			<div class="text-center">
				<div class="text-danger text-lg font-semibold mb-2">Error Loading Course</div>
				<p class="text-secondary-4 mb-4">{error}</p>
				<Button onclick={loadCourse}>Retry</Button>
			</div>
		</div>
	{:else if courseData}
		<!-- Sidebar -->
		{#if showSidebar}
			<div class="w-full lg:w-80 border-r border-primary-2 bg-main">
				<div class="p-4 border-b border-primary-2">
					<h1 class="text-lg font-bold text-secondary">{courseData.title}</h1>
					{#if courseData.description}
						<p class="text-sm text-secondary-4 mt-1">{courseData.description}</p>
					{/if}
				</div>

				<div class="p-4 space-y-2">
					<h2 class="text-sm font-semibold text-secondary-2 uppercase tracking-wide">Course Content</h2>
					
					{#if content.length === 0}
						<div class="text-center py-8">
							<BookOpen size={32} class="mx-auto text-secondary-4 mb-2" />
							<p class="text-secondary-4">No content available</p>
						</div>
					{:else}
						{#each content as item, index}
							{@const itemProgress = getProgressForContent(item.id)}
							{@const completed = isContentCompleted(item.id)}
							<button
								class="w-full p-3 rounded-lg text-left transition-colors duration-200 hover:bg-primary-2 {currentContent?.id === item.id ? 'bg-primary-2 ring-1 ring-primary' : 'bg-primary'}"
								onclick={() => currentContent = item}
							>
								<div class="flex items-start gap-3">
									<div class="flex-shrink-0 mt-0.5">
										{#if completed}
											<CheckCircle size={16} class="text-success" />
										{:else}
											<Play size={16} class="text-secondary-4" />
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium text-secondary truncate">
											{item.title}
										</div>
										{#if item.description}
											<div class="text-xs text-secondary-4 mt-1 line-clamp-2">
												{item.description}
											</div>
										{/if}
										<div class="flex items-center gap-2 mt-2 text-xs text-secondary-4">
											<Clock size={12} />
											<span>{item.estimatedDuration || '5'} min</span>
											{#if itemProgress && !completed}
												<span class="px-2 py-0.5 bg-primary-accent text-primary-accent rounded text-xs">
													{Math.round(itemProgress.progress)}%
												</span>
											{/if}
										</div>
									</div>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{/if}

		<!-- Main Content -->
		<div class="flex-1 flex flex-col">
			{#if currentContent}
				<div class="border-b border-primary-2 p-4">
					<h2 class="text-xl font-bold text-secondary">{currentContent.title}</h2>
					{#if currentContent.description}
						<p class="text-secondary-4 mt-1">{currentContent.description}</p>
					{/if}
				</div>

				<div class="flex-1 p-4">
					<!-- H5P Content Player -->
					{#if currentContent.type === 'h5p' && currentContent.h5pContentId}
						<div class="space-y-4">
							<!-- Import H5PPlayer dynamically -->
							{#await import('@components/h5p/H5PPlayer.svelte') then { default: H5PPlayer }}
								<H5PPlayer 
									contentId={currentContent.h5pContentId}
									organizationId={user?.organizationId}
									showControls={true}
									enableTracking={true}
									onProgress={(progressPercent) => updateProgress(currentContent.id, progressPercent)}
									onCompleted={(data) => handleContentComplete(currentContent.id, data)}
									className="learning-player"
								/>
							{:catch error}
								<div class="card p-8 text-center">
									<BookOpen size={48} class="mx-auto text-danger mb-4" />
									<h3 class="text-lg font-semibold text-danger mb-2">Player Error</h3>
									<p class="text-secondary-4 mb-4">Failed to load H5P content player</p>
									<Button onclick={() => window.location.reload()}>Reload</Button>
								</div>
							{/await}
						</div>
					{:else}
						<!-- Fallback for non-H5P content or missing content ID -->
						<div class="bg-white rounded-lg border border-primary-2 p-4">
							<div class="text-center py-8">
								<BookOpen size={48} class="mx-auto text-secondary-4 mb-4" />
								<h3 class="text-lg font-semibold text-secondary mb-2">Content Player</h3>
								<p class="text-secondary-4 mb-4">
									{#if currentContent.type !== 'h5p'}
										Content type "{currentContent.type}" is not yet supported.
									{:else}
										H5P content ID is missing for "{currentContent.title}".
									{/if}
								</p>
								<p class="text-xs text-secondary-4 mb-4">
									Content ID: {currentContent.id}
								</p>
								
								{#if !isContentCompleted(currentContent.id)}
									<Button onclick={() => markCompleted(currentContent.id)}>
										Mark as Complete
									</Button>
								{:else}
									<div class="flex items-center justify-center gap-2 text-success">
										<CheckCircle size={20} />
										<span class="font-semibold">Completed</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex-1 flex items-center justify-center">
					<div class="text-center">
						<BookOpen size={48} class="mx-auto text-secondary-4 mb-4" />
						<h3 class="text-lg font-semibold text-secondary mb-2">Select Content</h3>
						<p class="text-secondary-4">Choose content from the sidebar to start learning</p>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>