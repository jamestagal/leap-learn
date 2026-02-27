<script>
	/**
	 * H5P Hub Browser Component
	 * Allows instructors to discover, preview, and install H5P content types
	 * from the official H5P Hub with real-time search and filtering
	 */
	
	import { authClient } from '@actions/authClient';
	import { Organization } from '@actions/user.svelte';
	import { toast } from '@components/Toast.svelte';
	
	// UI Components
	import Button from '@components/Button.svelte';
	import Input from '@components/Input.svelte';
	import Select from '@components/Select.svelte';
	import Card from '@components/Card.svelte';
	import Badge from '@components/Badge.svelte';
	import Spinner from '@components/Spinner.svelte';
	import Modal from '@components/Modal.svelte';
	
	// H5P Components
	import H5PHubStatus from '@components/h5p/H5PHubStatus.svelte';
	import H5PInstallationProgress from '@components/h5p/H5PInstallationProgress.svelte';
	
	// Icons
	import Search from '@icons/search.svelte';
	import Download from '@icons/download.svelte';
	import Heart from '@icons/heart.svelte';
	import Star from '@icons/star.svelte';
	import Filter from '@icons/list-filter.svelte';
	import Grid3x3 from '@icons/grid-3x3.svelte';
	import List from '@icons/list.svelte';
	import ExternalLink from '@icons/external-link.svelte';
	import Package from '@icons/package.svelte';
	import CheckCircle from '@icons/circle-check.svelte';
	import AlertCircle from '@icons/circle-alert.svelte';
	import RefreshCcw from '@icons/refresh-ccw.svelte';
	import BookOpen from '@icons/book-open.svelte';
	
	// Props
	let { 
		selectionMode = false,
		onLibrarySelect = null,
		showInstalled = false 
	} = $props();
	
	// Auth
	const session = authClient.useSession();
	const organization = Organization.useActiveOrganization();
	
	// State
	// Use undefined to signify "not yet loaded" - prevents derived state race conditions
let libraries = $state(undefined);
	let categories = $state([]);
	let isLoading = $state(true);
	let error = $state(null);
	let hubStatus = $state('unknown');
	
	// Search and filters
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let sortBy = $state('popularity');
	let viewMode = $state('grid'); // 'grid' | 'list'
	let showOnlyAvailable = $state(false);
	let searchTimeout = $state(null);
	
	// Installation
	let installingLibraries = $state(new Set());
	let installationProgress = $state(new Map());
	let showInstallModal = $state(false);
	let selectedLibrary = $state(null);
	
	// Pagination
	let currentPage = $state(1);
	let limit = $state(100); // Increased to show all H5P content types (53 total)
	let total = $state(0);
	let hasMore = $state(false);
	
	// Derived state
	let currentUser = $derived($session.data?.user);
	let organizationId = $derived($organization.data?.id);
	let hasAdminPermission = $derived(currentUser && currentUser.role === 'admin');
	let hasInstructorPermission = $derived(currentUser && ['admin', 'member'].includes(currentUser.role));
	let hasAdminPermissionOnly = $derived(currentUser && currentUser.role && ['admin'].includes(currentUser.role));
	let isConnected = $derived(hubStatus === 'connected');
	
	// Category options for filter
	let categoryOptions = $derived(() => {
		const baseOptions = [{ value: '', name: 'All Categories' }];
		const categoryMapped = Array.isArray(categories) 
			? categories.map(cat => ({ value: cat, name: cat }))
			: [];
		return [...baseOptions, ...categoryMapped];
	});
	
	// Sort options
	const sortOptions = [
		{ value: 'popularity', name: 'Most Popular' },
		{ value: 'title', name: 'Name A-Z' },
		{ value: 'created', name: 'Newest First' },
		{ value: 'updated', name: 'Recently Updated' }
	];
	
	// Use regular state instead of $derived to avoid timing issues
	let filteredLibraries = $state([]);
	
	// Update filtered libraries whenever dependencies change
	$effect(() => {
		console.log('H5P Hub: === FILTERING EFFECT STARTED ===');
		
		// Guard: only run filter if libraries has been populated
		if (libraries === undefined || libraries === null) {
			console.log('H5P Hub: Libraries not yet loaded, setting filteredLibraries to empty array');
			filteredLibraries = [];
			return;
		}
		
		let filtered = libraries;
		console.log('H5P Hub: Filtering libraries. Total libraries:', libraries.length);
		console.log('H5P Hub: showOnlyAvailable:', showOnlyAvailable);
		console.log('H5P Hub: First library isInstalled property:', libraries[0]?.isInstalled);
		console.log('H5P Hub: Raw libraries array:', libraries);
		console.log('H5P Hub: isLoading:', isLoading);
		console.log('H5P Hub: Sample library structure:', libraries[0]);
		
		// Apply availability filter
		if (showOnlyAvailable) {
			console.log('H5P Hub: Before availability filter - sample lib isInstalled:', libraries[0]?.isInstalled);
			filtered = filtered.filter(lib => !lib.isInstalled);
			console.log('H5P Hub: After availability filter:', filtered.length);
		}
		
		// Apply search filter (client-side for responsive search)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(lib => 
				lib.title?.toLowerCase().includes(query) ||
				lib.description?.toLowerCase().includes(query) ||
				lib.category?.toLowerCase().includes(query) ||
				lib.tags?.some(tag => tag.toLowerCase().includes(query))
			);
		}
		
		console.log('H5P Hub: Final filtered libraries:', filtered.length, filtered);
		console.log('H5P Hub: Sample filtered library structure:', filtered[0]);
		console.log('H5P Hub: Setting filteredLibraries state to:', filtered.length, 'items');
		
		// Update the state
		filteredLibraries = filtered;
	});
	
	// Load libraries from H5P Hub
	async function loadLibraries(resetPage = false) {
		try {
			if (resetPage) {
				currentPage = 1;
			}
			
			isLoading = true;
			error = null;
			
			const params = new URLSearchParams({
				limit: limit.toString(),
				offset: ((currentPage - 1) * limit).toString(),
				sort: sortBy,
				installed: showInstalled ? 'true' : 'false',
				_cb: Date.now() // Cache busting
			});
			
			if (searchQuery.trim()) {
				params.set('search', searchQuery.trim());
			}
			
			if (selectedCategory) {
				params.set('category', selectedCategory);
			}
			
			// For selection mode, show all libraries so users can see what's available
			if (selectionMode) {
				params.set('installed', 'false'); // Show all libraries regardless of installation status
			}
			
			// Use the content-type-cache endpoint which is properly implemented
			// This endpoint provides the H5P Hub with library information
			const apiEndpoint = '/api/private/h5p/content-type-cache';
			
			// For content-type-cache, we don't need query params as it returns all available libraries
			console.log('H5P Hub: Making API request to:', apiEndpoint);
			const response = await fetch(apiEndpoint, {
				credentials: 'include' // Include authentication cookies
			});
			
			console.log('H5P Hub: API response status:', response.status, response.statusText);
			if (!response.ok) {
				if (response.status === 502) {
					// Hub unavailable but not a fatal error
					const errorData = await response.json().catch(() => ({}));
					hubStatus = 'offline';
					toast.warning('H5P Hub is temporarily unavailable. Showing cached data.');
					libraries = [];
					return;
				}
				throw new Error(`Failed to load libraries: ${response.statusText}`);
			}
			
			const data = await response.json();
			console.log('H5P Hub: API response data:', data);
			console.log('H5P Hub: API response data.libraries:', data.libraries);
			console.log('H5P Hub: API response libraries length:', (data.libraries || []).length);
			
			// The content-type-cache endpoint returns libraries directly in data.libraries
			if (resetPage) {
				// Force reactivity update using proper Svelte 5 pattern
				const newLibraries = data.libraries || [];
				libraries = newLibraries;
				console.log('H5P Hub: Libraries assigned (resetPage=true):', libraries.length, libraries);
				console.log('H5P Hub: Libraries state after assignment:', libraries);
				
				// Force a microtask to ensure reactivity has time to propagate
				await new Promise(resolve => setTimeout(resolve, 0));
			} else {
				// Append for infinite scroll (though content-type-cache returns all at once)
				libraries = [...libraries, ...(data.libraries || [])];
				console.log('H5P Hub: Libraries appended (resetPage=false):', libraries.length, libraries);
			}
			
			// Update metadata from content-type-cache response
			categories = Object.keys(data.categories || {});
			hubStatus = data.hubIsEnabled ? 'connected' : 'offline';
			total = (data.libraries || []).length;
			hasMore = false; // Content-type-cache returns all libraries at once
			
			// Show errors if any
			if (data.error) {
				toast.error(data.error);
			}
			
		} catch (err) {
			console.error('Error loading libraries:', err);
			error = err.message;
			toast.error('Failed to load H5P libraries from Hub');
		} finally {
			isLoading = false;
		}
	}
	
	// Debounced search
	function handleSearchInput() {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		
		searchTimeout = setTimeout(() => {
			loadLibraries(true);
		}, 300);
	}
	
	// Filter change handlers
	function handleCategoryChange() {
		loadLibraries(true);
	}
	
	function handleSortChange() {
		loadLibraries(true);
	}
	
	// Install library
	async function installLibrary(library, showProgress = true) {
		if (!hasAdminPermission) {
			toast.error('Admin permissions required to install libraries');
			return;
		}
		
		const libraryKey = library.id || library.machineName;
		
		try {
			installingLibraries.add(libraryKey);
			
			if (showProgress) {
				installationProgress.set(libraryKey, {
					status: 'downloading',
					progress: 0,
					message: 'Downloading library package...'
				});
			}
			
			// Determine install endpoint based on context
			const isAdminContext = window.location.pathname.includes('/admin/');
			const installEndpoint = isAdminContext 
				? '/api/private/admin/libraries/install-from-hub'
				: '/api/private/h5p/hub/install';
			
			const response = await fetch(installEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include', // Include authentication cookies
				body: JSON.stringify({
					libraryId: libraryKey,
					version: library.version?.string || 'latest',
					installDependencies: true
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				
				if (response.status === 401) {
					toast.error('Authentication required. Please log in again.');
					// Optionally redirect to login
					// goto('/login');
					return;
				}
				
				if (response.status === 403) {
					toast.error(`Admin privileges required to install libraries`);
					return;
				}
				
				throw new Error(errorData.detail || errorData.message || `Installation failed (${response.status})`);
			}
			
			const result = await response.json();
			
			// Update library status in current list
			const libraryIndex = libraries.findIndex(lib => 
				(lib.id || lib.machineName) === libraryKey
			);
			
			if (libraryIndex !== -1) {
				libraries[libraryIndex] = {
					...libraries[libraryIndex],
					isInstalled: true,
					installedVersion: result.library?.version
				};
			}
			
			toast.success(`${library.title} installed successfully!`);
			
			// Show dependency information
			if (result.dependencies?.length > 0) {
				const depCount = result.dependencies.filter(d => d.status === 'satisfied').length;
				if (depCount > 0) {
					toast.info(`${depCount} dependencies verified`);
				}
			}
			
			// Show warnings if any
			if (result.warnings?.length > 0) {
				result.warnings.forEach(warning => toast.warning(warning));
			}
			
		} catch (err) {
			console.error('Installation error:', err);
			toast.error(`Failed to install ${library.title}: ${err.message}`);
		} finally {
			installingLibraries.delete(libraryKey);
			installationProgress.delete(libraryKey);
		}
	}
	
	
	// Show installation modal
	function showInstallationModal(library) {
		console.log('H5P Hub: showInstallationModal called with library:', library);
		selectedLibrary = library;
		showInstallModal = true;
		console.log('H5P Hub: Modal state set - showInstallModal:', showInstallModal, 'selectedLibrary:', selectedLibrary);
	}
	
	// Load more libraries (infinite scroll)
	async function loadMore() {
		if (!hasMore || isLoading) return;
		currentPage++;
		await loadLibraries(false);
	}
	
	// Select library (for selection mode)
	function selectLibrary(library) {
		if (onLibrarySelect) {
			onLibrarySelect(library);
		}
	}
	
	// Refresh hub data
	async function refreshHub() {
		await loadLibraries(true);
	}
	
	// Load libraries using proper Svelte 5 $effect pattern for async data
	$effect(() => {
		console.log('🔍 [HUB BROWSER] Effect triggered:', {
			organizationId,
			hasInstructorPermission,
			currentUser,
			userRole: currentUser?.role
		});
		
		if (organizationId && hasInstructorPermission) {
			console.log('✅ [HUB BROWSER] Conditions met, fetching libraries...');
			isLoading = true;
			error = null;
			
			const fetchLibraries = async () => {
				try {
					const params = new URLSearchParams({
						limit: limit.toString(),
						offset: '0',
						sort: sortBy,
						installed: showInstalled ? 'true' : 'false',
						_cb: Date.now() // Cache busting
					});
					
					if (searchQuery.trim()) {
						params.set('search', searchQuery.trim());
					}
					
					if (selectedCategory) {
						params.set('category', selectedCategory);
					}
					
					// For selection mode, show all libraries so users can see what's available
					if (selectionMode) {
						params.set('installed', 'false'); // Show all libraries regardless of installation status
					}
					
					// Use the content-type-cache endpoint for consistency
					const apiEndpoint = '/api/private/h5p/content-type-cache';
					
					console.log('H5P Hub: Making API request to:', apiEndpoint);
					const response = await fetch(apiEndpoint, {
						credentials: 'include' // Include authentication cookies
					});
					
					console.log('H5P Hub: API response status:', response.status, response.statusText);
					if (!response.ok) {
						if (response.status === 502) {
							hubStatus = 'offline';
							libraries = [];
							return;
						}
						throw new Error(`Failed to load libraries: ${response.statusText}`);
					}
					
					const data = await response.json();
					console.log('H5P Hub: API response data:', data);
					console.log('H5P Hub: API response data.libraries:', data.libraries);
					console.log('H5P Hub: API response libraries length:', (data.libraries || []).length);
					
					// Direct state assignment - this will trigger derived state updates
					libraries = data.libraries || [];
					console.log('H5P Hub: Libraries assigned via $effect:', libraries.length, libraries);
					
					// Update metadata from content-type-cache response
					categories = Object.keys(data.categories || {});
					hubStatus = data.hubIsEnabled ? 'connected' : 'offline';
					total = (data.libraries || []).length;
					hasMore = false; // Content-type-cache returns all libraries at once
					currentPage = 1;
					
					// Show errors if any
					if (data.error) {
						toast.error(data.error);
					}
					
				} catch (err) {
					console.error('Error loading libraries:', err);
					error = err.message;
					libraries = [];
				} finally {
					isLoading = false;
				}
			};
			
			fetchLibraries();
		} else {
			console.log('❌ [HUB BROWSER] Conditions NOT met:', {
				organizationIdPresent: !!organizationId,
				hasInstructorPermissionValue: hasInstructorPermission,
				reason: !organizationId ? 'Missing organizationId' : !hasInstructorPermission ? 'Missing instructor permission' : 'Unknown'
			});
		}
	});
</script>

<div class="h5p-hub-browser">
	<!-- Header -->
	<div class="flex flex-col gap-4 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold text-secondary">H5P Hub</h2>
				<p class="text-secondary-4 mt-1">
					Discover and install interactive content types
				</p>
			</div>
			
			<!-- Hub Status -->
			<div class="flex items-center gap-3">
				<H5PHubStatus status={hubStatus} />
				
				{#if hasInstructorPermission}
					<Button onclick={refreshHub} variant="outline" size="sm">
						<RefreshCcw size={16} class={isLoading ? 'animate-spin' : ''} />
						Refresh
					</Button>
				{/if}
			</div>
		</div>
		
		<!-- Stats Bar -->
		{#if !isLoading && libraries && libraries.length > 0}
			<div class="flex items-center gap-6 text-sm text-secondary-4">
				<div class="flex items-center gap-2">
					<Package size={16} />
					<span>{total} libraries available</span>
				</div>
				<div class="flex items-center gap-2">
					<CheckCircle size={16} />
					<span>{libraries ? libraries.filter(lib => lib.isInstalled).length : 0} installed</span>
				</div>
				{#if !isConnected}
					<div class="flex items-center gap-2 text-warning">
						<AlertCircle size={16} />
						<span>Limited offline features</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
	
	<!-- Search and Filters -->
	<Card class="p-4 mb-6">
		<div class="space-y-4">
			<!-- Search Bar -->
			<div class="flex items-center gap-4">
				<div class="flex-1">
					<Input
						Icon={Search}
						bind:value={searchQuery}
						oninput={handleSearchInput}
						placeholder="Search content types..."
						disabled={!isConnected && (!libraries || libraries.length === 0)}
					/>
				</div>
				
				<!-- View Mode Toggle -->
				<div class="flex bg-primary-2 rounded-lg p-1">
					<button
						class="px-3 py-1 rounded text-sm font-medium transition-colors"
						class:bg-primary-accent={viewMode === 'grid'}
						class:shadow-sm={viewMode === 'grid'}
						class:text-secondary={viewMode === 'grid'}
						class:text-secondary-4={viewMode !== 'grid'}
						onclick={() => viewMode = 'grid'}
					>
						<Grid3x3 size={16} />
					</button>
					<button
						class="px-3 py-1 rounded text-sm font-medium transition-colors"
						class:bg-primary-accent={viewMode === 'list'}
						class:text-white={viewMode === 'list'}
						class:shadow-sm={viewMode === 'list'}
						class:text-secondary-4={viewMode !== 'list'}
						onclick={() => viewMode = 'list'}
					>
						<List size={16} />
					</button>
				</div>
			</div>
			
			<!-- Advanced Filters -->
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<Filter size={16} class="text-secondary-4" />
					<Select
						options={categoryOptions}
						bind:value={selectedCategory}
						onSelect={handleCategoryChange}
						placeholder="All Categories"
						disabled={!isConnected && categories.length === 0}
					/>
				</div>
				
				<div class="flex items-center gap-2">
					<span class="text-sm text-secondary-4">Sort:</span>
					<Select
						options={sortOptions}
						bind:value={sortBy}
						onSelect={handleSortChange}
						disabled={!isConnected}
					/>
				</div>
				
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						bind:checked={showOnlyAvailable}
						onchange={() => loadLibraries(true)}
						class="rounded"
					/>
					<span class="text-secondary-4">Available only</span>
				</label>
			</div>
		</div>
	</Card>
	
	<!-- Content Area -->
	{#if error}
		<Card class="p-8 text-center">
			<AlertCircle size={32} class="mx-auto mb-4 text-danger" />
			<h3 class="text-lg font-semibold mb-2">Connection Error</h3>
			<p class="text-secondary-4 mb-4">{error}</p>
			<Button onclick={refreshHub} variant="primary">
				<RefreshCcw size={16} />
				Try Again
			</Button>
		</Card>
	{:else if isLoading && (!libraries || libraries.length === 0)}
		<div class="flex justify-center py-12">
			<Spinner size={32} />
		</div>
	{:else if filteredLibraries.length === 0}
		<!-- Empty State -->
		<Card class="p-12 text-center">
			<BookOpen size={48} class="mx-auto mb-4 text-secondary-4" />
			<h3 class="text-xl font-semibold mb-2">
				{searchQuery ? 'No Results Found' : 'No Libraries Available'}
			</h3>
			<p class="text-secondary-4 mb-6">
				{#if searchQuery}
					Try adjusting your search terms or filters.
				{:else if !isConnected}
					Connect to H5P Hub to discover available content types.
				{:else}
					Check back later for new content types.
				{/if}
			</p>
			{#if searchQuery}
				<Button onclick={() => { searchQuery = ''; loadLibraries(true); }}>
					Clear Search
				</Button>
			{/if}
		</Card>
	{:else}
		<!-- Library Grid/List -->
		{#if viewMode === 'grid'}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{#each filteredLibraries as library (library.id || library.machineName)}
					<Card class="p-0 hover:shadow-lg transition-all duration-200 overflow-hidden">
						<!-- Library Header -->
						<div class="aspect-video bg-gradient-to-br from-primary-2 to-primary-3 relative">
							<div class="absolute inset-0 flex items-center justify-center p-4">
								{#if library.thumbnailImage}
									<img 
										src="/images/h5p-thumbnails/{library.thumbnailImage}" 
										alt="{library.title} thumbnail"
										class="w-full h-full object-contain drop-shadow-lg"
										loading="lazy"
										onerror={(e) => {
											// Fallback to emoji icon if image fails to load
											e.target.style.display = 'none';
											e.target.nextElementSibling.style.display = 'block';
										}}
									/>
									<div class="text-4xl hidden">📚</div>
								{:else}
									<div class="text-4xl">{library.icon || '📚'}</div>
								{/if}
							</div>
							
							<!-- Status Badge -->
							<div class="absolute top-3 right-3">
								{#if library.isInstalled}
									<Badge variant="success">Installed</Badge>
								{:else if installingLibraries.has(library.id || library.machineName)}
									<Badge variant="warning" class="flex items-center gap-1">
										<Spinner size={12} />
										Installing...
									</Badge>
								{:else}
									<Badge variant="info">Available</Badge>
								{/if}
							</div>
							
							<!-- Popularity -->
							{#if library.popularity}
								<div class="absolute bottom-3 left-3 flex items-center gap-1 text-xs bg-black/20 text-white px-2 py-1 rounded">
									<Star size={12} />
									{library.popularity}%
								</div>
							{/if}
						</div>
						
						<!-- Library Info -->
						<div class="p-4">
							<h3 class="font-semibold text-lg mb-2 line-clamp-1">{library.title}</h3>
							
							{#if library.description}
								<p class="text-sm text-secondary-4 mb-3 line-clamp-2">
									{library.description}
								</p>
							{/if}
							
							<!-- Metadata -->
							<div class="space-y-2 mb-4">
								{#if library.category}
									<div class="flex items-center gap-2">
										<span class="text-xs px-2 py-1 bg-primary-accent/20 text-primary-accent rounded">
											{library.category}
										</span>
										{#if library.version?.string}
											<span class="text-xs text-secondary-4">v{library.version.string}</span>
										{/if}
									</div>
								{/if}
								
								{#if library.author}
									<div class="text-xs text-secondary-4">
										by {library.author}
									</div>
								{/if}
							</div>
							
							<!-- Actions -->
							<div class="flex gap-2">
								{#if selectionMode && library.isInstalled}
									<Button 
										variant="primary" 
										size="sm" 
										full
										onclick={() => selectLibrary(library)}
									>
										Select
									</Button>
								{:else if library.isInstalled}
									<button 
										class="flex items-center justify-center gap-2 rounded-lg border bg-success/10 border-success/20 px-3 py-1.5 w-full"
										onclick={() => showInstallationModal(library)}
									>
										<CheckCircle size={14} class="text-success" />
										<span class="font-medium text-sm text-success">Installed</span>
									</button>
								{:else if hasAdminPermission}
									<Button 
										variant="action" 
										size="sm"
										full
										onclick={() => showInstallationModal(library)}
										disabled={installingLibraries.has(library.id || library.machineName)}
									>
										{#if installingLibraries.has(library.id || library.machineName)}
											<Spinner size={14} />
											Installing...
										{:else}
											<Download size={14} />
											Install
										{/if}
									</Button>
								{:else}
									<Button variant="outline" size="sm" full disabled>
										<AlertCircle size={14} />
										Admin Required
									</Button>
								{/if}
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<!-- List View -->
			<Card>
				<div class="divide-y divide-primary-4">
					{#each filteredLibraries as library (library.id || library.machineName)}
						<div class="flex items-center gap-4 p-4 hover:bg-primary-2/50 transition-colors">
							<!-- Icon -->
							<div class="w-12 h-12 bg-primary-2 rounded-lg flex items-center justify-center overflow-hidden">
								{#if library.thumbnailImage}
									<img 
										src="/images/h5p-thumbnails/{library.thumbnailImage}" 
										alt="{library.title} thumbnail"
										class="w-full h-full object-contain"
										loading="lazy"
										onerror={(e) => {
											// Fallback to emoji icon if image fails to load
											e.target.style.display = 'none';
											e.target.nextElementSibling.style.display = 'block';
										}}
									/>
									<span class="text-xl hidden">📚</span>
								{:else}
									<span class="text-xl">{library.icon || '📚'}</span>
								{/if}
							</div>
							
							<!-- Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h3 class="font-semibold text-lg">{library.title}</h3>
									{#if library.isInstalled}
										<Badge variant="success" size="sm">Installed</Badge>
									{:else if installingLibraries.has(library.id || library.machineName)}
										<Badge variant="warning" size="sm">Installing...</Badge>
									{:else}
										<Badge variant="info" size="sm">Available</Badge>
									{/if}
								</div>
								
								{#if library.description}
									<p class="text-sm text-secondary-4 line-clamp-1">{library.description}</p>
								{/if}
								
								<div class="flex items-center gap-3 mt-2 text-xs text-secondary-4">
									{#if library.category}
										<span>{library.category}</span>
									{/if}
									{#if library.author}
										<span>by {library.author}</span>
									{/if}
									{#if library.version?.string}
										<span>v{library.version.string}</span>
									{/if}
									{#if library.popularity}
										<div class="flex items-center gap-1">
											<Star size={12} />
											{library.popularity}%
										</div>
									{/if}
								</div>
							</div>
							
							<!-- Actions -->
							<div class="flex items-center gap-2">
								{#if selectionMode && library.isInstalled}
									<Button 
										variant="primary" 
										size="sm"
										onclick={() => selectLibrary(library)}
									>
										Select
									</Button>
								{:else if library.isInstalled}
									<button 
										class="flex items-center gap-2 rounded-lg border bg-success/10 border-success/20 px-3 py-1.5"
										onclick={() => showInstallationModal(library)}
									>
										<CheckCircle size={14} class="text-success" />
										<span class="font-medium text-sm text-success">Installed</span>
									</button>
								{:else if hasAdminPermission}
									<Button 
										variant="action" 
										size="sm"
										onclick={() => showInstallationModal(library)}
										disabled={installingLibraries.has(library.id || library.machineName)}
									>
										{#if installingLibraries.has(library.id || library.machineName)}
											<Spinner size={14} />
											Installing...
										{:else}
											<Download size={14} />
											Install
										{/if}
									</Button>
								{:else}
									<Button variant="outline" size="sm" disabled>
										<AlertCircle size={14} />
										Admin Required
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}
		
		<!-- Load More Button -->
		{#if hasMore && !isLoading}
			<div class="flex justify-center mt-8">
				<Button onclick={loadMore} variant="outline">
					Load More Libraries
				</Button>
			</div>
		{:else if isLoading && libraries && libraries.length > 0}
			<div class="flex justify-center py-8">
				<Spinner size={24} />
			</div>
		{/if}
	{/if}
</div>

<!-- Installation Confirmation Modal -->
<Modal bind:isOpen={showInstallModal} title="Install H5P Library">
	{#if selectedLibrary}
		<div class="p-6 space-y-4">
			<!-- Library Info -->
			<div class="flex items-start gap-4">
				<div class="w-16 h-16 bg-primary-2 rounded-lg flex items-center justify-center overflow-hidden">
					{#if selectedLibrary.thumbnailImage}
						<img 
							src="/images/h5p-thumbnails/{selectedLibrary.thumbnailImage}" 
							alt="{selectedLibrary.title} thumbnail"
							class="w-full h-full object-contain"
							loading="lazy"
							onerror={(e) => {
								// Fallback to emoji icon if image fails to load
								e.target.style.display = 'none';
								e.target.nextElementSibling.style.display = 'block';
							}}
						/>
						<span class="text-2xl hidden">📚</span>
					{:else}
						<span class="text-2xl">{selectedLibrary.icon || '📚'}</span>
					{/if}
				</div>
				<div class="flex-1">
					<h3 class="text-xl font-semibold">{selectedLibrary.title}</h3>
					{#if selectedLibrary.description}
						<p class="text-secondary-4 mt-1">{selectedLibrary.description}</p>
					{/if}
					<div class="flex items-center gap-3 mt-2 text-sm">
						{#if selectedLibrary.category}
							<span class="px-2 py-1 bg-primary-accent/20 text-primary-accent rounded text-xs">
								{selectedLibrary.category}
							</span>
						{/if}
						{#if selectedLibrary.version?.string}
							<span class="text-secondary-4">Version {selectedLibrary.version.string}</span>
						{/if}
						{#if selectedLibrary.author}
							<span class="text-secondary-4">by {selectedLibrary.author}</span>
						{/if}
					</div>
				</div>
			</div>
			
			<!-- Installation Details -->
			<div class="space-y-3 bg-primary-2 p-4 rounded-lg">
				<h4 class="font-medium">Installation Details</h4>
				<div class="space-y-2 text-sm text-secondary-4">
					<div class="flex justify-between">
						<span>Library Package:</span>
						<span>{selectedLibrary.title}</span>
					</div>
					<div class="flex justify-between">
						<span>Version:</span>
						<span>{selectedLibrary.version?.string || 'Latest'}</span>
					</div>
					<div class="flex justify-between">
						<span>Dependencies:</span>
						<span>
							{selectedLibrary.dependencies?.length || 0} 
							{selectedLibrary.dependencies?.length === 1 ? 'library' : 'libraries'}
						</span>
					</div>
				</div>
			</div>
			
			<!-- Actions -->
			<div class="flex justify-end gap-2 pt-4 border-t border-primary-4">
				<Button 
					variant="outline" 
					onclick={() => showInstallModal = false}
				>
					Cancel
				</Button>
				{#if selectedLibrary.isInstalled}
					<div class="flex items-center gap-2 rounded-lg border bg-success/10 border-success/20 px-3 py-1.5">
						<div class="flex items-center gap-1.5">
							<CheckCircle size={14} class="text-success" />
							<span class="font-medium text-sm text-success">Already Installed</span>
						</div>
					</div>
				{:else}
					<Button 
						variant="action" 
						onclick={() => {
							installLibrary(selectedLibrary);
							showInstallModal = false;
						}}
						disabled={selectedLibrary.isInstalled}
					>
						<Download size={16} />
						Install Library
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</Modal>

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