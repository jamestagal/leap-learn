<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authClient } from '@actions/authClient';
	import { Organization } from '@actions/user.svelte';
	import { toast } from '@components/Toast.svelte';
	import Spinner from '@components/Spinner.svelte';
	import Button from '@components/Button.svelte';
	import Modal from '@components/Modal.svelte';
	import H5PPlayer from './H5PPlayer.svelte';
	import Search from '@icons/search.svelte';
	import Filter from '@icons/list-filter.svelte';
	import Eye from '@icons/eye.svelte';
	import Edit from '@icons/pencil.svelte';
	import Copy from '@icons/copy.svelte';
	import Trash2 from '@icons/trash-2.svelte';
	import Plus from '@icons/plus.svelte';
	import Calendar from '@icons/calendar.svelte';
	import User from '@icons/user.svelte';
	import Clock from '@icons/clock.svelte';
	import ChevronRight from '@icons/chevron-right.svelte';
	import Folder from '@icons/folder.svelte';
	import FolderOpen from '@icons/folder-open.svelte';
	import Home from '@icons/house.svelte';

	// Props
	let { 
		selectionMode = false,
		onContentSelect = null,
		showActions = true,
		filterByAuthor = false
	} = $props();

	// State
	let contents = $state([]);
	let filteredContents = $state([]);
	let folders = $state([]);
	let isLoading = $state(true);
	let error = $state(null);
	let searchQuery = $state('');
	let selectedType = $state('all');
	let showPreview = $state(false);
	let previewContent = $state(null);
	let currentPage = $state(1);
	let totalPages = $state(1);
	let limit = $state(12);
	let currentFolderId = $state('root');
	let currentFolderPath = $state([]);
	let breadcrumbs = $state([]);

	// Auth
	const session = authClient.useSession();
	const organization = Organization.useActiveOrganization();

	// Derived
	let organizationId = $derived($organization.data?.id);
	let currentUser = $derived($session.data?.user);
	let hasPermission = $derived(currentUser && (currentUser.role === 'admin'));
	let contentTypes = $derived(() => {
		const types = ['all'];
		contents.forEach(content => {
			if (content.library && !types.includes(content.library.machineName)) {
				types.push(content.library.machineName);
			}
		});
		return types;
	});

	// Track URL parameters for folder context
	$effect(() => {
		const parentParam = $page.url.searchParams.get('parent');
		if (parentParam && parentParam !== currentFolderId) {
			currentFolderId = parentParam;
			updateBreadcrumbs();
		} else if (!parentParam && currentFolderId !== 'root') {
			currentFolderId = 'root';
			updateBreadcrumbs();
		}
	});

	// Update breadcrumbs based on current folder
	function updateBreadcrumbs() {
		if (currentFolderId === 'root') {
			breadcrumbs = [{ id: 'root', name: 'Content Library', path: '' }];
		} else {
			// For now, create simple breadcrumbs - can be enhanced with actual folder hierarchy
			breadcrumbs = [
				{ id: 'root', name: 'Content Library', path: '' },
				{ id: currentFolderId, name: getFolderDisplayName(currentFolderId), path: `?parent=${currentFolderId}` }
			];
		}
	}

	// Get display name for folder
	function getFolderDisplayName(folderId) {
		const folderNames = {
			'course-materials': 'Course Materials',
			'templates': 'Templates',
			'archive': 'Archive',
			'interactive-videos': 'Interactive Videos',
			'quizzes': 'Quizzes'
		};
		return folderNames[folderId] || folderId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}

	// Navigate to folder
	function navigateToFolder(folderId) {
		if (folderId === 'root') {
			goto('/instructor/content');
		} else {
			goto(`/instructor/content?parent=${folderId}`);
		}
	}

	// Load content from API
	async function loadContent() {
		if (!organizationId) return;
		
		try {
			isLoading = true;
			error = null;

			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: limit.toString()
			});

			// Add folder context
			if (currentFolderId && currentFolderId !== 'root') {
				params.set('parent', currentFolderId);
			}

			if (searchQuery.trim()) {
				params.set('search', searchQuery.trim());
			}

			if (selectedType !== 'all') {
				params.set('type', selectedType);
			}

			if (filterByAuthor && currentUser) {
				params.set('authorId', currentUser.id);
			}

			const response = await fetch(`/api/private/content?${params}`);

			if (!response.ok) {
				throw new Error(`Failed to load content: ${response.statusText}`);
			}

			const data = await response.json();
			contents = data.contents || [];
			totalPages = data.totalPages || 1;
			filteredContents = contents;
		} catch (err) {
			console.error('Error loading content:', err);
			error = err.message;
			toast.error('Failed to load content');
		} finally {
			isLoading = false;
		}
	}

	// Delete content
	async function deleteContent(contentId) {
		if (!confirm('Are you sure you want to delete this content?')) return;

		try {
			const response = await fetch(`/api/private/content/${contentId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete content');
			}

			toast.success('Content deleted successfully');
			loadContent(); // Reload content list
		} catch (err) {
			console.error('Error deleting content:', err);
			toast.error('Failed to delete content');
		}
	}

	// Load folders for current context
	async function loadFolders() {
		if (currentFolderId === 'root') {
			// Static root folders for now - can be enhanced to load from API
			folders = [
				{ id: 'course-materials', name: 'Course Materials', type: 'folder', contentCount: 0 },
				{ id: 'templates', name: 'Templates', type: 'folder', contentCount: 0 },
				{ id: 'archive', name: 'Archive', type: 'folder', contentCount: 0 }
			];
		} else if (currentFolderId === 'course-materials') {
			folders = [
				{ id: 'interactive-videos', name: 'Interactive Videos', type: 'folder', contentCount: 0 },
				{ id: 'quizzes', name: 'Quizzes', type: 'folder', contentCount: 0 }
			];
		} else {
			folders = [];
		}
	}

	// Duplicate content
	async function duplicateContent(contentId) {
		try {
			const response = await fetch(`/api/private/content/${contentId}/duplicate`, {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('Failed to duplicate content');
			}

			toast.success('Content duplicated successfully');
			loadContent(); // Reload content list
		} catch (err) {
			console.error('Error duplicating content:', err);
			toast.error('Failed to duplicate content');
		}
	}

	// Preview content
	function previewContentHandler(content) {
		previewContent = content;
		showPreview = true;
	}

	// Select content (for selection mode)
	function selectContent(content) {
		if (onContentSelect) {
			onContentSelect(content);
		}
	}

	// Format date
	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Handle search
	$effect(() => {
		if (searchQuery !== undefined) {
			const timeoutId = setTimeout(() => {
				currentPage = 1; // Reset to first page when searching
				loadContent();
			}, 300);
			return () => clearTimeout(timeoutId);
		}
	});

	// Handle type filter change
	$effect(() => {
		if (selectedType !== undefined) {
			currentPage = 1; // Reset to first page when filtering
			loadContent();
		}
	});

	// Load content when organization changes
	$effect(() => {
		if (organizationId) {
			loadContent();
		}
	});

	// Load content on mount and when folder changes
	onMount(() => {
		updateBreadcrumbs();
	});

	// Load data when organization or folder changes
	$effect(() => {
		if (organizationId) {
			loadFolders();
			loadContent();
		}
	});
</script>

<div class="content-browser">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h2 class="text-2xl font-bold">H5P Content Library</h2>
			<p class="text-secondary-4 mt-1">Browse and manage your interactive content</p>
		</div>
		
		{#if currentUser?.role && ['admin', 'member'].includes(currentUser.role) && showActions}
			<Button href={`/instructor/content/new${currentFolderId !== 'root' ? `?parent=${currentFolderId}` : ''}`} variant="primary">
				<Plus size={16} />
				Create New Content
			</Button>
		{/if}
	</div>

	<!-- Breadcrumb Navigation -->
	{#if breadcrumbs.length > 0}
		<nav class="mb-4" aria-label="Breadcrumb">
			<ol class="flex items-center space-x-2 text-sm">
				{#each breadcrumbs as crumb, index}
					<li class="flex items-center">
						{#if index > 0}
							<ChevronRight size={16} class="text-secondary-4 mx-2" />
						{/if}
						
						{#if index === breadcrumbs.length - 1}
							<!-- Current page - not clickable -->
							<span class="text-secondary font-medium flex items-center gap-1">
								{#if crumb.id === 'root'}
									<Home size={16} />
								{:else}
									<FolderOpen size={16} />
								{/if}
								{crumb.name}
							</span>
						{:else}
							<!-- Clickable breadcrumb -->
							<button 
								onclick={() => navigateToFolder(crumb.id)}
								class="text-secondary-4 hover:text-secondary transition-colors flex items-center gap-1"
							>
								{#if crumb.id === 'root'}
									<Home size={16} />
								{:else}
									<Folder size={16} />
								{/if}
								{crumb.name}
							</button>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	{/if}

	<!-- Search and Filters -->
	<div class="card p-4 mb-6">
		<div class="flex flex-col lg:flex-row gap-4">
			<!-- Search -->
			<div class="flex-1 relative">
				<Search size={20} class="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-4" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search content by title or description..."
					class="input-field pl-10 w-full"
				/>
			</div>

			<!-- Type Filter -->
			<div class="flex items-center gap-2">
				<Filter size={16} class="text-secondary-4" />
				<select bind:value={selectedType} class="input-field min-w-40">
					{#each contentTypes as type}
						<option value={type}>
							{type === 'all' ? 'All Types' : type.replace('H5P.', '')}
						</option>
					{/each}
				</select>
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
			<h3 class="text-lg font-semibold text-danger mb-2">Error Loading Content</h3>
			<p class="text-secondary-4 mb-4">{error}</p>
			<Button onclick={loadContent}>Retry</Button>
		</div>
	{/if}

	<!-- Folders Grid -->
	{#if !isLoading && !error && folders.length > 0}
		<div class="mb-8">
			<h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
				<Folder size={20} />
				Folders
			</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each folders as folder}
					<button 
						onclick={() => navigateToFolder(folder.id)}
						class="card p-4 hover:shadow-lg transition-all duration-200 hover:bg-primary-2/50 text-left group"
					>
						<div class="flex items-center gap-3">
							<div class="text-primary group-hover:text-primary-accent transition-colors">
								<Folder size={24} />
							</div>
							<div class="flex-1">
								<h4 class="font-medium text-secondary group-hover:text-secondary-accent transition-colors">
									{folder.name}
								</h4>
								<p class="text-sm text-secondary-4">
									{folder.contentCount} items
								</p>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Content Grid -->
	{#if !isLoading && !error}
		{#if contents.length > 0 || folders.length > 0}
			{#if contents.length > 0}
				<div class="mb-4">
					<h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
						<BookOpen size={20} />
						Content ({contents.length})
					</h3>
				</div>
			{/if}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{#each contents as content}
					<div class="card hover:shadow-lg transition-shadow duration-200">
						<!-- Content Thumbnail -->
						<div class="aspect-video bg-primary-2 rounded-t-lg relative overflow-hidden">
							{#if content.thumbnail}
								<img 
									src={content.thumbnail} 
									alt={content.title}
									class="w-full h-full object-cover"
								/>
							{:else}
								<div class="w-full h-full flex items-center justify-center">
									<span class="text-4xl text-secondary-4">
										{content.library?.title?.charAt(0) || 'H'}
									</span>
								</div>
							{/if}
							
							<!-- Content Type Badge -->
							<div class="absolute top-2 right-2">
								<span class="badge bg-primary text-xs">
									{content.library?.title || 'H5P'}
								</span>
							</div>
						</div>

						<!-- Content Info -->
						<div class="p-4">
							<h3 class="font-semibold text-lg mb-2 line-clamp-1">
								{content.title}
							</h3>
							
							{#if content.description}
								<p class="text-secondary-4 text-sm mb-3 line-clamp-2">
									{content.description}
								</p>
							{/if}

							<!-- Metadata -->
							<div class="flex items-center gap-4 text-xs text-secondary-4 mb-4">
								<div class="flex items-center gap-1">
									<User size={12} />
									<span>{content.authorName || 'Unknown'}</span>
								</div>
								<div class="flex items-center gap-1">
									<Calendar size={12} />
									<span>{formatDate(content.createdAt)}</span>
								</div>
								{#if content.updatedAt !== content.createdAt}
									<div class="flex items-center gap-1">
										<Clock size={12} />
										<span>Updated {formatDate(content.updatedAt)}</span>
									</div>
								{/if}
							</div>

							<!-- Actions -->
							<div class="flex items-center justify-between">
								{#if selectionMode}
									<Button 
										variant="primary" 
										size="sm"
										onclick={() => selectContent(content)}
									>
										Select
									</Button>
								{:else}
									<div class="flex items-center gap-1">
										<button 
											class="button icon-sm"
											onclick={() => previewContentHandler(content)}
											title="Preview"
										>
											<Eye size={14} />
										</button>

										{#if hasPermission && showActions}
											<a 
												href="/author/content/{content.id}"
												class="button icon-sm"
												title="Edit"
											>
												<Edit size={14} />
											</a>

											<button 
												class="button icon-sm"
												onclick={() => duplicateContent(content.id)}
												title="Duplicate"
											>
												<Copy size={14} />
											</button>

											<button 
												class="button icon-sm text-danger hover:bg-danger/10"
												onclick={() => deleteContent(content.id)}
												title="Delete"
											>
												<Trash2 size={14} />
											</button>
										{/if}
									</div>
								{/if}
								
								<div class="text-xs text-secondary-4">
									v{content.version || '1.0'}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="flex justify-center items-center gap-2 mt-8">
					<Button 
						variant="outline" 
						disabled={currentPage === 1}
						onclick={() => { currentPage = Math.max(1, currentPage - 1); loadContent(); }}
					>
						Previous
					</Button>
					
					<span class="px-4 py-2 text-sm">
						Page {currentPage} of {totalPages}
					</span>
					
					<Button 
						variant="outline"
						disabled={currentPage === totalPages}
						onclick={() => { currentPage = Math.min(totalPages, currentPage + 1); loadContent(); }}
					>
						Next
					</Button>
				</div>
			{/if}
		{:else}
			<!-- Empty State -->
			{#if contents.length === 0 && folders.length === 0}
				<div class="card p-12 text-center">
					<div class="w-16 h-16 bg-primary-2 rounded-full flex items-center justify-center mx-auto mb-4">
						<Search size={24} class="text-secondary-4" />
					</div>
					<h3 class="text-lg font-semibold mb-2">No Content Found</h3>
					<p class="text-secondary-4 mb-6">
						{#if searchQuery || selectedType !== 'all'}
							Try adjusting your search or filters to find what you're looking for.
						{:else if currentFolderId !== 'root'}
							This folder is empty. Navigate back or create content here.
						{:else}
							Start creating your first interactive H5P content.
						{/if}
				</p>
				{#if currentUser?.role && ['admin', 'member'].includes(currentUser.role) && showActions && !searchQuery && selectedType === 'all'}
					<Button href={`/instructor/content/new${currentFolderId !== 'root' ? `?parent=${currentFolderId}` : ''}`} variant="primary">
						<Plus size={16} />
						Create Your First Content
					</Button>
				{/if}
			</div>
			{/if}
		{/if}
	{/if}
</div>

<!-- Preview Modal -->
{#if showPreview && previewContent}
	<Modal bind:show={showPreview} size="xl">
		{#snippet header()}
			<h2 class="text-xl font-bold">{previewContent.title}</h2>
		{/snippet}
		
		<div class="max-w-4xl mx-auto">
			<H5PPlayer 
				contentId={previewContent.id}
				organizationId={organizationId}
				showControls={true}
				enableTracking={false}
			/>
		</div>

		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => showPreview = false}>
					Close
				</Button>
				{#if hasPermission && showActions}
					<Button href="/author/content/{previewContent.id}" variant="primary">
						<Edit size={16} />
							Edit Content
					</Button>
				{/if}
			</div>
		{/snippet}
	</Modal>
{/if}

<style>
	.content-browser {
		width: 100%;
	}

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