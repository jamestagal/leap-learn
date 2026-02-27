<script>
	import CheckCircle from '@icons/check-circle.svelte';
	import Circle from '@icons/circle.svelte';
	import Play from '@icons/play.svelte';
	import Clock from '@icons/clock.svelte';
	import BookOpen from '@icons/book-open.svelte';

	// Props
	let { 
		course,
		currentIndex,
		completedContents,
		contentProgress,
		onNavigate
	} = $props();

	// Derived
	let contents = $derived(course?.contents || []);
	let totalContents = $derived(contents.length);
	let completedCount = $derived(completedContents.size);
	let progressPercentage = $derived(totalContents ? Math.round((completedCount / totalContents) * 100) : 0);

	// Get content status
	function getContentStatus(content, index) {
		if (completedContents.has(content.id)) {
			return 'completed';
		} else if (index === currentIndex) {
			return 'current';
		} else if (contentProgress[content.id]) {
			return 'in-progress';
		} else {
			return 'not-started';
		}
	}

	// Get estimated time
	function getEstimatedTime(content) {
		if (!content.estimatedMinutes) return null;
		const minutes = content.estimatedMinutes;
		if (minutes < 60) {
			return `${minutes}m`;
		} else {
			return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
		}
	}

	// Format last accessed date
	function formatLastAccessed(dateString) {
		if (!dateString) return null;
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 60) {
			return `${diffMins}m ago`;
		} else if (diffHours < 24) {
			return `${diffHours}h ago`;
		} else {
			return `${diffDays}d ago`;
		}
	}
</script>

<div class="navigation-menu h-full flex flex-col">
	<!-- Course Progress Header -->
	<div class="p-4 border-b border-primary-3">
		<div class="mb-3">
			<div class="flex justify-between items-center mb-2">
				<h3 class="font-semibold text-lg truncate">{course?.title || 'Course'}</h3>
				<span class="text-sm font-medium">{progressPercentage}%</span>
			</div>
			<div class="w-full bg-primary-2 rounded-full h-2">
				<div 
					class="bg-primary-accent h-2 rounded-full transition-all duration-300"
					style="width: {progressPercentage}%"
				></div>
			</div>
		</div>
		
		<div class="flex justify-between text-sm text-secondary-4">
			<span>{completedCount} of {totalContents} completed</span>
			{#if course?.estimatedHours}
				<span>{course.estimatedHours} hours total</span>
			{/if}
		</div>
	</div>

	<!-- Content List -->
	<div class="flex-1 overflow-y-auto">
		{#if contents.length > 0}
			<div class="p-2">
				{#each contents as content, index}
					{@const status = getContentStatus(content, index)}
					{@const progress = contentProgress[content.id]}
					{@const estimatedTime = getEstimatedTime(content)}
					{@const lastAccessed = formatLastAccessed(progress?.lastAccessed)}
					
					<button
						class="w-full p-3 rounded-lg text-left transition-all duration-200 mb-2"
						class:bg-primary-accent={status === 'current'}
						class:text-white={status === 'current'}
						class:bg-success/10={status === 'completed' && status !== 'current'}
						class:bg-primary-2={status === 'in-progress' && status !== 'current'}
						class:hover:bg-primary-3={status !== 'current'}
						onclick={() => onNavigate(index)}
					>
						<div class="flex items-start gap-3">
							<!-- Status Icon -->
							<div class="flex-shrink-0 mt-0.5">
								{#if status === 'completed'}
									<CheckCircle size={20} class={status === 'current' ? 'text-white' : 'text-success'} />
								{:else if status === 'current'}
									<Play size={20} class="text-white" />
								{:else if status === 'in-progress'}
									<Circle size={20} class="text-primary-accent" />
								{:else}
									<Circle size={20} class="text-secondary-4" />
								{/if}
							</div>

							<!-- Content Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="text-xs font-mono px-1.5 py-0.5 rounded bg-primary-3 text-secondary-4">
										{index + 1}
									</span>
									<h4 class="font-medium text-sm truncate">
										{content.title}
									</h4>
								</div>
								
								{#if content.description}
									<p class="text-xs mb-2 line-clamp-2"
									   class:text-white/80={status === 'current'}
									   class:text-secondary-4={status !== 'current'}
									>
										{content.description}
									</p>
								{/if}

								<!-- Metadata -->
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center gap-3">
										{#if estimatedTime}
											<div class="flex items-center gap-1">
												<Clock size={12} 
													   class={status === 'current' ? 'text-white/70' : 'text-secondary-4'} />
												<span class={status === 'current' ? 'text-white/80' : 'text-secondary-4'}>
													{estimatedTime}
												</span>
											</div>
										{/if}
										
										{#if content.library}
											<div class="flex items-center gap-1">
												<BookOpen size={12} 
														   class={status === 'current' ? 'text-white/70' : 'text-secondary-4'} />
												<span class={status === 'current' ? 'text-white/80' : 'text-secondary-4'}>
													{content.library.title?.replace('H5P.', '') || 'H5P'}
												</span>
											</div>
										{/if}
									</div>
									
									{#if lastAccessed}
										<span class={status === 'current' ? 'text-white/60' : 'text-secondary-4'}>
											{lastAccessed}
										</span>
									{/if}
								</div>

								<!-- Progress Bar for In-Progress Content -->
								{#if progress && progress.progress > 0 && progress.progress < 100}
									<div class="mt-2">
										<div class="w-full rounded-full h-1.5"
											 class={status === 'current' ? 'bg-white/20' : 'bg-primary-2'}
										>
											<div 
												class="h-1.5 rounded-full transition-all duration-300"
												class:bg-white={status === 'current'}
												class:bg-primary-accent={status !== 'current'}
												style="width: {progress.progress}%"
											></div>
										</div>
										<div class="text-xs mt-1 text-right"
											 class={status === 'current' ? 'text-white/80' : 'text-secondary-4'}
										>
											{Math.round(progress.progress)}% complete
										</div>
									</div>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<div class="p-6 text-center">
				<BookOpen size={32} class="text-secondary-4 mx-auto mb-2" />
				<p class="text-secondary-4 text-sm">No content available in this course.</p>
			</div>
		{/if}
	</div>

	<!-- Course Info Footer -->
	{#if course}
		<div class="p-4 border-t border-primary-3">
			{#if course.description}
				<p class="text-sm text-secondary-4 mb-3 line-clamp-3">
					{course.description}
				</p>
			{/if}
			
			<div class="flex items-center justify-between text-xs text-secondary-4">
				{#if course.instructors?.length > 0}
					<span>By {course.instructors[0].name}</span>
				{/if}
				{#if course.level}
					<span>{course.level} level</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.navigation-menu {
		@apply bg-primary;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>