<script>
	import { onMount } from 'svelte';
	import { authClient } from '@actions/authClient';
	import { Organization } from '@actions/user.svelte';
	import { toast } from '@components/Toast.svelte';
	import Spinner from '@components/Spinner.svelte';
	import Button from '@components/Button.svelte';
	import Modal from '@components/Modal.svelte';
	import Input from '@components/Input.svelte';
	import Select from '@components/Select.svelte';
	import Search from '@icons/search.svelte';
	import Download from '@icons/download.svelte';
	import Upload from '@icons/upload.svelte';
	import Trash2 from '@icons/trash-2.svelte';
	import BookOpen from '@icons/book-open.svelte';
	import Package from '@icons/package.svelte';
	import CheckCircle from '@icons/circle-check.svelte';
	import AlertCircle from '@icons/circle-alert.svelte';
	import RefreshCw from '@icons/refresh-cw.svelte';
	import Zap from '@icons/zap.svelte';
	import Database from '@icons/database.svelte';
	import Server from '@icons/server.svelte';
	import Activity from '@icons/activity.svelte';
	import BarChart from '@icons/chart-bar.svelte';
	import TrendingUp from '@icons/trending-up.svelte';
	import Settings from '@icons/settings.svelte';

	// Props
	let { 
		libraries = [],
		selectionMode = false,
		onLibrarySelect = null,
		showActions = true
	} = $props();

	// State
	let availableLibraries = $state([]);
	let installedLibraries = $state([]);
	let isLoading = $state(true);
	let error = $state(null);
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let activeTab = $state('installed'); // 'installed' or 'available'
	let isInstalling = $state(null);
	let isRemoving = $state(null);
	let hubStatus = $state('unknown');
	let categories = $state([]);
	let searchTimeout = $state(null);
	let modalRef = $state();
	let categoryOptions = $derived(() => [
		{ value: '', name: 'All Categories' },
		...categories.map(cat => ({ value: cat, name: cat }))
	]);

	// File upload
	let fileInput = $state();
	let uploadProgress = $state(0);
	let isUploading = $state(false);

	// Library population
	let isPopulating = $state(false);
	let populationProgress = $state({ current: 0, total: 0, status: '' });
	let showPopulationModal = $state(false);
	let populationStats = $state(null);

	// Auth
	const session = authClient.useSession();
	const organization = Organization.useActiveOrganization();

	// Derived
	let organizationId = $derived($organization.data?.id);
	let currentUser = $derived($session.data?.user);
	let hasAdminPermission = $derived(currentUser && currentUser.role === 'admin');
	let hasInstructorPermission = $derived(currentUser && ['admin', 'member'].includes(currentUser.role));
	let hasAdminPermissionOnly = $derived(currentUser && ['admin'].includes(currentUser.role));
	let filteredLibraries = $derived(() => {
		const currentLibraries = activeTab === 'installed' ? installedLibraries : availableLibraries;
		if (!searchQuery.trim()) return currentLibraries;
		
		return currentLibraries.filter(lib => 
			lib.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			lib.machineName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			lib.description?.toLowerCase().includes(searchQuery.toLowerCase())
		);
	});

	// Load installed libraries
	async function loadInstalledLibraries() {
		try {
			console.log('Loading installed libraries from /api/private/h5p/libraries...');
			const response = await fetch('/api/private/h5p/libraries');
			if (!response.ok) {
				console.error('Failed to load installed libraries, status:', response.status);
				throw new Error('Failed to load installed libraries');
			}

			const data = await response.json();
			console.log('Installed libraries response:', data);
			installedLibraries = data.data || [];
			console.log('Set installedLibraries to:', installedLibraries.length, 'libraries');
		} catch (err) {
			console.error('Error loading installed libraries:', err);
			toast.error('Failed to load installed libraries');
		}
	}

	// Load available libraries from H5P hub
	async function loadAvailableLibraries() {
		try {
			// Fetch from real H5P Hub API
			const params = new URLSearchParams({
				limit: '100', // Increased to show all 53 H5P content types
				sort: 'popularity',
				installed: 'false' // Only show non-installed libraries initially
			});

			const response = await fetch(`/api/private/h5p/hub/libraries?${params}`);
			if (!response.ok) {
				// If hub is unavailable, show offline message but continue
				if (response.status === 502) {
					const errorData = await response.json().catch(() => ({}));
					console.warn('H5P Hub unavailable:', errorData.detail);
					toast.warning('H5P Hub is temporarily unavailable. Showing installed libraries only.');
					availableLibraries = [];
					return;
				}
				throw new Error('Failed to load available libraries');
			}

			const data = await response.json();
			
			// Transform hub response to component format
			availableLibraries = (data.data || []).map(library => ({
				id: library.id || library.machineName,
				machineName: library.id || library.machineName,
				title: library.title || 'Unknown',
				description: library.description || library.summary || '',
				majorVersion: library.version?.major || 1,
				minorVersion: library.version?.minor || 0,
				patchVersion: library.version?.patch || 0,
				version: library.version?.string || '1.0.0',
				icon: library.icon || '📚',
				category: library.category || 'General',
				author: library.author || 'H5P',
				popularity: library.popularity || 0,
				tags: library.tags || [],
				installed: library.isInstalled || false,
				hasUpdate: library.hasUpdate || false,
				installedVersion: library.installedVersion || null,
				screenshots: library.screenshots || [],
				dependencies: library.dependencies || []
			}));

			// Update categories and hub status
			categories = data.meta?.categories || [...new Set(availableLibraries.map(lib => lib.category))].sort();
			hubStatus = data.meta?.hubStatus || 'connected';

			// Show status message based on hub response
			if (data.meta?.warning) {
				toast.warning(data.meta.warning);
			}
			
			if (data.meta?.fromCache) {
				console.info('Showing cached H5P Hub data');
			}
			
		} catch (err) {
			console.error('Error loading available libraries:', err);
			toast.error('Failed to load available libraries from H5P Hub');
			// Set empty array so UI shows appropriate empty state
			availableLibraries = [];
		}
	}

	// Install library from hub
	async function installLibrary(library) {
		if (!hasAdminPermission) {
			toast.error('You need admin permissions to install libraries');
			return;
		}

		try {
			isInstalling = library.machineName;

			const response = await fetch('/api/private/h5p/hub/install', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					libraryId: library.id || library.machineName,
					version: library.version || `${library.majorVersion}.${library.minorVersion}.${library.patchVersion || 0}`
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				if (response.status === 403 && errorData.details) {
					// Security validation failed
					toast.error(`Security validation failed: ${errorData.details[0]?.details || 'Unsafe content detected'}`);
				} else {
					throw new Error(errorData.message || 'Failed to install library');
				}
				return;
			}

			const result = await response.json();
			
			toast.success(`${library.title} installed successfully!`);
			
			// Show installation details if available
			if (result.dependencies?.length > 0) {
				toast.info(`Installed ${result.dependencies.length} dependencies`);
			}
			
			// Reload libraries
			await loadInstalledLibraries();
			await loadAvailableLibraries();
			
		} catch (err) {
			console.error('Error installing library:', err);
			toast.error(`Failed to install ${library.title}: ${err.message}`);
		} finally {
			isInstalling = null;
		}
	}

	// Remove installed library
	async function removeLibrary(library) {
		if (!hasAdminPermission) {
			toast.error('You need admin permissions to remove libraries');
			return;
		}

		if (!confirm(`Are you sure you want to remove ${library.title}? This may affect existing content.`)) {
			return;
		}

		try {
			isRemoving = library.machineName;

			const response = await fetch(`/api/private/h5p/libraries/${library.machineName}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to remove library');
			}

			toast.success(`${library.title} removed successfully!`);
			
			// Reload libraries
			await loadInstalledLibraries();
			await loadAvailableLibraries();
		} catch (err) {
			console.error('Error removing library:', err);
			toast.error(`Failed to remove ${library.title}`);
		} finally {
			isRemoving = null;
		}
	}

	// Upload library file
	async function uploadLibrary() {
		if (!hasAdminPermission) {
			toast.error('You need admin permissions to upload libraries');
			return;
		}

		if (!fileInput?.files?.length) {
			toast.error('Please select a library file to upload');
			return;
		}

		try {
			isUploading = true;
			uploadProgress = 0;

			const formData = new FormData();
			formData.append('library', fileInput.files[0]);

			const response = await fetch('/api/private/upload/content', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Failed to upload library');
			}

			toast.success('Library uploaded successfully!');
			modalRef?.close();
			
			// Reset file input
			if (fileInput) fileInput.value = '';
			
			// Reload libraries
			await loadInstalledLibraries();
		} catch (err) {
			console.error('Error uploading library:', err);
			toast.error('Failed to upload library');
		} finally {
			isUploading = false;
			uploadProgress = 0;
		}
	}

	// Populate libraries from Catharsis Hub
	async function populateLibrariesFromHub() {
		if (!hasAdminPermission) {
			toast.error('You need admin permissions to populate libraries');
			return;
		}

		try {
			isPopulating = true;
			populationProgress = { current: 0, total: 0, status: 'Fetching available libraries...' };
			showPopulationModal = true;

			// Get real statistics from existing endpoints
			try {
				const [libsResponse, installedResponse] = await Promise.all([
					fetch('/api/private/h5p/hub/libraries?limit=100'),
					fetch('/api/private/h5p/libraries')
				]);

				let totalLibraries = 0;
				let installedLibraries = 0;
				let hubStatus = 'error';

				if (libsResponse.ok) {
					const libsData = await libsResponse.json();
					totalLibraries = libsData.meta?.total || libsData.data?.length || 0;
					hubStatus = libsData.meta?.hubStatus || 'unknown';
				}

				if (installedResponse.ok) {
					const installedData = await installedResponse.json();
					installedLibraries = installedData.data?.length || 0;
				}

				populationStats = {
					totalLibraries,
					installedLibraries,
					hubStatus,
					customLibraries: 0, // TODO: Calculate from installed libraries
					lastSync: new Date().toISOString()
				};
			} catch (error) {
				console.error('Failed to get real statistics:', error);
				throw new Error('Failed to get hub statistics');
			}

			// Get available libraries from existing H5P hub endpoint
			populationProgress.status = 'Loading library catalog...';
			const libsResponse = await fetch('/api/private/h5p/hub/libraries?limit=100');
			if (!libsResponse.ok) {
				throw new Error('Failed to fetch library catalog');
			}

			const libsData = await libsResponse.json();
			const availableForInstall = libsData.data.filter(lib => !lib.isInstalled);
			
			populationProgress.total = availableForInstall.length;
			populationProgress.status = `Found ${availableForInstall.length} libraries to install`;

			if (availableForInstall.length === 0) {
				toast.success('All available libraries are already installed!');
				showPopulationModal = false;
				return;
			}

			// Ask user confirmation before installing many libraries
			if (availableForInstall.length > 10 && !confirm(`This will install ${availableForInstall.length} libraries. This may take several minutes. Continue?`)) {
				showPopulationModal = false;
				return;
			}

			// Install libraries one by one with better error handling
			let installed = 0;
			let failed = 0;
			const failedLibraries = [];

			console.log(`Starting installation of ${availableForInstall.length} libraries...`);

			for (const library of availableForInstall) {
				try {
					populationProgress.current = installed + failed + 1;
					populationProgress.status = `Installing ${library.title}...`;

					const installResponse = await fetch('/api/private/h5p/hub/install', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							libraryId: library.machineName || library.id,
							version: library.version?.string || 'latest',
							title: library.title
						})
					});

					if (installResponse.ok) {
						installed++;
						console.log(`✅ Successfully installed: ${library.title} (${installed}/${availableForInstall.length})`);
					} else {
						failed++;
						const errorText = await installResponse.text();
						failedLibraries.push(`${library.title}: ${errorText}`);
						console.error(`❌ Failed to install: ${library.title} - Status: ${installResponse.status}, Error: ${errorText}`);
					}

					// Small delay to prevent overwhelming the hub
					await new Promise(resolve => setTimeout(resolve, 500));

				} catch (err) {
					failed++;
					failedLibraries.push(library.title);
					console.error(`Error installing ${library.title}:`, err);
				}
			}

			// Show results
			populationProgress.status = 'Population complete!';
			
			if (installed > 0) {
				toast.success(`Successfully installed ${installed} libraries!`);
			}
			
			if (failed > 0) {
				console.warn('Failed to install libraries:', failedLibraries);
				// Show first few failures in toast
				const firstFailures = failedLibraries.slice(0, 3).join(', ');
				const moreText = failedLibraries.length > 3 ? ` and ${failedLibraries.length - 3} more` : '';
				toast.error(`Installation failed for: ${firstFailures}${moreText}. Check console for full details.`);
			}

			// Refresh library lists
			await loadInstalledLibraries();
			await loadAvailableLibraries();

		} catch (err) {
			console.error('Error populating libraries:', err);
			toast.error(`Library population failed: ${err.message}`);
		} finally {
			isPopulating = false;
			// Auto-close modal after 3 seconds
			setTimeout(() => {
				showPopulationModal = false;
			}, 3000);
		}
	}

	// Get hub health status
	async function checkHubHealth() {
		try {
			const response = await fetch('/api/private/h5p/hub/libraries?limit=1');
			if (!response.ok) return 'error';
			
			const data = await response.json();
			return data.meta?.hubStatus === 'connected' ? 'healthy' : 'error';
		} catch (err) {
			return 'error';
		}
	}

	// Debounced search for available libraries
	async function performSearch() {
		if (activeTab !== 'available') return;

		try {
			const params = new URLSearchParams({
				limit: '50',
				sort: 'popularity',
				installed: 'false'
			});

			if (searchQuery.trim()) {
				params.set('search', searchQuery.trim());
			}

			if (selectedCategory) {
				params.set('category', selectedCategory);
			}

			const response = await fetch(`/api/private/h5p/hub/libraries?${params}`);
			if (response.ok) {
				const data = await response.json();
				availableLibraries = (data.data || []).map(library => ({
					id: library.id || library.machineName,
					machineName: library.id || library.machineName,
					title: library.title || 'Unknown',
					description: library.description || library.summary || '',
					majorVersion: library.version?.major || 1,
					minorVersion: library.version?.minor || 0,
					patchVersion: library.version?.patch || 0,
					version: library.version?.string || '1.0.0',
					icon: library.icon || '📚',
					category: library.category || 'General',
					author: library.author || 'H5P',
					popularity: library.popularity || 0,
					tags: library.tags || [],
					installed: library.isInstalled || false,
					hasUpdate: library.hasUpdate || false,
					installedVersion: library.installedVersion || null,
					screenshots: library.screenshots || [],
					dependencies: library.dependencies || []
				}));
			}
		} catch (err) {
			console.error('Search error:', err);
		}
	}

	// Handle search input changes
	function handleSearchChange() {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			if (activeTab === 'available') {
				performSearch();
			}
		}, 300); // Debounce search by 300ms
	}

	// Select library (for selection mode)
	function selectLibrary(library) {
		if (onLibrarySelect) {
			onLibrarySelect(library);
		}
	}

	// Load data using proper Svelte 5 $effect pattern
	$effect(() => {
		// Ensure all required state is available before loading
		if (organizationId && currentUser?.id && currentUser?.role) {
			const userHasPermission = ['admin', 'member'].includes(currentUser.role);
			
			if (userHasPermission) {
				isLoading = true;
				error = null;
				
				const loadData = async () => {
					try {
						console.log('LibraryManager: Loading data for user:', currentUser.id);
						await loadInstalledLibraries();
						await loadAvailableLibraries();
						console.log('LibraryManager: Loaded', installedLibraries.length, 'installed libraries');
					} catch (err) {
						console.error('LibraryManager: Error loading data:', err);
						error = err.message;
					} finally {
						isLoading = false;
					}
				};
				
				loadData();
			}
		}
	});
</script>

<div class="library-manager">
	{#if !selectionMode}
		<!-- Header -->
		<div class="flex justify-between items-center mb-6">
			<div>
				<div class="flex items-center gap-3 mb-2">
					<h2 class="text-2xl font-bold">H5P Library Manager</h2>
					<!-- Hub Health Status -->
					{#if hasAdminPermission}
						{#await checkHubHealth()}
							<div class="flex items-center gap-1 text-xs px-2 py-1 bg-secondary-4/20 text-secondary-4 rounded">
								<Server size={12} class="animate-pulse" />
								Checking...
							</div>
						{:then health}
							{#if health === 'healthy'}
								<div class="flex items-center gap-1 text-xs px-2 py-1 bg-success/20 text-success rounded" title="Hub is online and responsive">
									<CheckCircle size={12} />
									Hub Online
								</div>
							{:else if health === 'unhealthy'}
								<div class="flex items-center gap-1 text-xs px-2 py-1 bg-warning/20 text-warning rounded" title="Hub is experiencing issues">
									<AlertCircle size={12} />
									Hub Issues
								</div>
							{:else}
								<div class="flex items-center gap-1 text-xs px-2 py-1 bg-danger/20 text-danger rounded" title="Hub is offline or unreachable">
									<Server size={12} />
									Hub Offline
								</div>
							{/if}
						{:catch error}
							<div class="flex items-center gap-1 text-xs px-2 py-1 bg-danger/20 text-danger rounded" title="Unable to check hub status">
								<AlertCircle size={12} />
								Connection Error
							</div>
						{/await}
					{/if}
				</div>
				<p class="text-secondary-4">Manage your H5P content type libraries</p>
			</div>
			
			<div class="flex items-center gap-3">
				{#if currentUser?.role && ['admin', 'member'].includes(currentUser.role) && showActions}
					{#if hasAdminPermission}
						<Button 
							onclick={populateLibrariesFromHub} 
							variant="success"
							isLoading={isPopulating}
							title="Populate all available libraries from Catharsis Hub"
						>
							{#snippet children()}
								{#if isPopulating}
									<RefreshCw size={16} class="animate-spin" />
									Populating...
								{:else}
									<Zap size={16} />
									Populate All
								{/if}
							{/snippet}
						</Button>
					{/if}
					<Button href="/instructor/h5p-library/hub" variant="primary">
						<Download size={16} />
						Discover Libraries
					</Button>
					<Button onclick={() => modalRef?.showModal()} variant="outline">
						<Upload size={16} />
						Upload Library
					</Button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Admin Controls Section -->
	{#if hasAdminPermission && !selectionMode}
		<div class="card p-4 mb-4 bg-primary-accent/5 border border-primary-accent/20">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Settings size={18} class="text-primary-accent" />
					<h3 class="font-semibold text-primary-accent">Admin Controls</h3>
				</div>
				<div class="flex items-center gap-2">
					<div class="text-xs text-secondary-4">
						{installedLibraries.length} installed • {availableLibraries.filter(lib => !lib.installed).length} available
					</div>
				</div>
			</div>
			
			<div class="mt-4 flex flex-wrap gap-3">
				<!-- Library Statistics -->
				<div class="flex items-center gap-4 text-sm">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 bg-success rounded-full"></div>
						<span class="text-secondary-4">Installed:</span>
						<span class="font-medium">{installedLibraries.length}</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 bg-primary-accent rounded-full"></div>
						<span class="text-secondary-4">Available:</span>
						<span class="font-medium">{availableLibraries.filter(lib => !lib.installed).length}</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 bg-warning rounded-full"></div>
						<span class="text-secondary-4">Updates:</span>
						<span class="font-medium">{installedLibraries.filter(lib => lib.hasUpdate).length}</span>
					</div>
					{#if categories.length > 0}
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-secondary rounded-full"></div>
							<span class="text-secondary-4">Categories:</span>
							<span class="font-medium">{categories.length}</span>
						</div>
					{/if}
				</div>
			</div>
			
			<!-- Quick Actions -->
			<div class="mt-4 flex flex-wrap gap-2">
				<Button 
					size="xs" 
					variant="outline"
					onclick={async () => {
						isLoading = true;
						await loadInstalledLibraries();
						await loadAvailableLibraries();
						isLoading = false;
						toast.success('Libraries refreshed');
					}}
					title="Refresh library data"
				>
					{#snippet children()}
						<RefreshCw size={14} />
						Refresh
					{/snippet}
				</Button>
				
				<Button 
					size="xs" 
					variant="outline"
					onclick={() => {
						const updateCount = installedLibraries.filter(lib => lib.hasUpdate).length;
						if (updateCount === 0) {
							toast.info('All libraries are up to date!');
							return;
						}
						activeTab = 'installed';
						searchQuery = '';
						toast.info(`Found ${updateCount} libraries with updates`);
					}}
					title="View libraries that have updates available"
					disabled={installedLibraries.filter(lib => lib.hasUpdate).length === 0}
				>
					{#snippet children()}
						<TrendingUp size={14} />
						Check Updates
					{/snippet}
				</Button>
				
				<Button 
					size="xs" 
					variant="outline"
					onclick={() => {
						activeTab = 'available';
						searchQuery = '';
						selectedCategory = '';
						performSearch();
					}}
					title="Browse all available libraries"
				>
					{#snippet children()}
						<Package size={14} />
						Browse Hub
					{/snippet}
				</Button>
			</div>
		</div>
	{/if}

	<!-- Search and Tabs -->
	<div class="card p-4 mb-6">
		<!-- Search and Filters -->
		<div class="space-y-4 mb-4">
			<Input
				Icon={Search}
				bind:value={searchQuery}
				oninput={handleSearchChange}
				placeholder="Search libraries..."
			/>

			{#if activeTab === 'available' && categories.length > 0}
				<div class="flex items-center gap-2">
					<div class="w-48">
						<Select
							options={categoryOptions}
							bind:value={selectedCategory}
							onSelect={performSearch}
							placeholder="All Categories"
						/>
					</div>

					{#if hubStatus !== 'connected'}
						<div class="text-xs px-2 py-1 bg-warning/10 text-warning rounded">
							{hubStatus === 'offline' ? '🔶 Offline' : '⚠️ Hub Issues'}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Tabs -->
		<div class="flex gap-1 bg-primary-2 rounded-lg p-1">
			<button 
				class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
				class:bg-primary-accent={activeTab === 'installed'}
				class:shadow-sm={activeTab === 'installed'}
				class:text-secondary={activeTab === 'installed'}
				class:text-secondary-4={activeTab !== 'installed'}
				onclick={() => activeTab = 'installed'}
			>
				=� Installed ({installedLibraries.length})
			</button>
			<button 
				class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
				class:bg-primary-accent={activeTab === 'available'}
				class:shadow-sm={activeTab === 'available'}
				class:text-secondary={activeTab === 'available'}
				class:text-secondary-4={activeTab !== 'available'}
				onclick={() => activeTab = 'available'}
			>
				=� Available ({availableLibraries.filter(lib => !lib.installed).length})
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center py-12">
			<Spinner size={32} />
		</div>
	{:else if error}
		<div class="card p-8 text-center">
			<h3 class="text-lg font-semibold text-danger mb-2">Error Loading Libraries</h3>
			<p class="text-secondary-4 mb-4">{error}</p>
			<Button onclick={() => window.location.reload()}>
				{#snippet children()}
					Retry
				{/snippet}
			</Button>
		</div>
	{:else}
		<!-- Library Grid -->
		{#if filteredLibraries.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each filteredLibraries as library}
					<div class="card hover:shadow-lg transition-shadow duration-200">
						<!-- Library Icon & Header -->
						<div class="p-4 pb-2">
							<div class="flex items-start justify-between mb-3">
								<div class="flex items-center gap-3">
									<div class="w-12 h-12 bg-primary-2 rounded-lg flex items-center justify-center text-xl">
										{library.icon || '=�'}
									</div>
									<div>
										<h3 class="font-semibold text-lg leading-tight">{library.title}</h3>
										<p class="text-xs text-secondary-4">v{library.majorVersion}.{library.minorVersion}{library.patchVersion ? `.${library.patchVersion}` : ''}</p>
									</div>
								</div>

								<!-- Status Badge -->
								{#if activeTab === 'installed'}
									<span class="badge bg-success text-white flex items-center gap-1">
										<CheckCircle size={12} />
										Installed
									</span>
								{:else if library.installed}
									<span class="badge bg-success text-white flex items-center gap-1">
										<CheckCircle size={12} />
										Installed
									</span>
								{:else}
									<span class="badge bg-primary">
										Available
									</span>
								{/if}
							</div>

							<!-- Description -->
							{#if library.description}
								<p class="text-sm text-secondary-4 mb-4 line-clamp-2">
									{library.description}
								</p>
							{/if}

							<!-- Category and Author -->
							<div class="flex items-center gap-2 mb-3">
								{#if library.category}
									<span class="text-xs px-2 py-1 bg-primary-accent/20 text-primary-accent rounded">
										{library.category}
									</span>
								{/if}
								{#if library.author}
									<span class="text-xs text-secondary-4">by {library.author}</span>
								{/if}
								{#if library.hasUpdate && activeTab === 'installed'}
									<span class="text-xs px-2 py-1 bg-warning/20 text-warning rounded">
										Update Available
									</span>
								{/if}
							</div>

							<!-- Machine Name and Version -->
							<div class="space-y-1 mb-4">
								<p class="text-xs text-secondary-4 font-mono bg-primary-2 px-2 py-1 rounded">
									{library.machineName}
								</p>
								{#if library.installedVersion && library.hasUpdate}
									<p class="text-xs text-secondary-4">
										Installed: v{library.installedVersion} → Available: v{library.version}
									</p>
								{/if}
							</div>
						</div>

						<!-- Actions -->
						<div class="px-4 pb-4">
							{#if selectionMode && activeTab === 'installed'}
								<Button 
									variant="primary" 
									full
									onclick={() => selectLibrary(library)}
								>
									{#snippet children()}
										Select
									{/snippet}
								</Button>
							{:else if activeTab === 'installed' && showActions}
								<div class="flex gap-2">
									<Button variant="outline" size="sm" full>
										{#snippet children()}
											Details
										{/snippet}
									</Button>
									{#if hasAdminPermission}
										<Button 
											variant="outline" 
											size="sm"
											class="text-danger hover:bg-danger/10"
											onclick={() => removeLibrary(library)}
											isLoading={isRemoving === library.machineName}
										>
											{#snippet children()}
												{#if isRemoving === library.machineName}
													Removing...
												{:else}
													<Trash2 size={14} />
												{/if}
											{/snippet}
										</Button>
									{/if}
								</div>
							{:else if activeTab === 'available' && !library.installed && hasAdminPermission}
								<Button 
									variant="primary" 
									full
									onclick={() => installLibrary(library)}
									isLoading={isInstalling === library.machineName}
								>
									{#snippet children()}
										{#if isInstalling === library.machineName}
											Installing...
										{:else}
											<Download size={16} />
											Install
										{/if}
									{/snippet}
								</Button>
							{:else if library.installed}
								<Button variant="outline" full disabled>
									{#snippet children()}
										<CheckCircle size={16} />
										Already Installed
									{/snippet}
								</Button>
							{:else if !hasAdminPermission}
								<Button variant="outline" full disabled>
									{#snippet children()}
										<AlertCircle size={16} />
										Admin Required
									{/snippet}
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<div class="card p-12 text-center">
				<div class="w-16 h-16 bg-primary-2 rounded-full flex items-center justify-center mx-auto mb-4">
					<BookOpen size={24} class="text-secondary-4" />
				</div>
				<h3 class="text-lg font-semibold mb-2">
					{#if searchQuery}
						No libraries found
					{:else if activeTab === 'installed'}
						No libraries installed
					{:else}
						No libraries available
					{/if}
				</h3>
				<p class="text-secondary-4 mb-6">
					{#if searchQuery}
						Try adjusting your search query.
					{:else if activeTab === 'installed'}
						Install libraries from the available tab or upload your own.
					{:else}
						Check back later for available libraries from the H5P hub.
					{/if}
				</p>
				{#if hasAdminPermission && showActions && activeTab === 'installed'}
					<div class="flex gap-3">
						<Button href="/instructor/h5p-library/hub" variant="primary">
							<Download size={16} />
							Discover Libraries
						</Button>
						<Button onclick={() => modalRef?.showModal()} variant="outline">
							<Upload size={16} />
							Upload Library
						</Button>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Upload Modal -->
<Modal bind:this={modalRef} title="Upload H5P Library">
	<div class="p-4 space-y-4">
		<p class="text-secondary-4">
			Upload an H5P library file (.h5p) to install new content types.
		</p>

		<div>
			<label for="library-file-input" class="block text-sm font-medium mb-2">
				Library File (.h5p)
			</label>
			<input
				id="library-file-input"
				type="file"
				accept=".h5p"
				bind:this={fileInput}
				class="w-full px-3 py-2 border border-primary-4 rounded-xl focus:outline-2"
				disabled={isUploading}
			/>
		</div>

		{#if isUploading}
			<div class="space-y-2">
				<div class="flex justify-between text-sm">
					<span>Uploading...</span>
					<span>{uploadProgress}%</span>
				</div>
				<div class="w-full bg-primary-2 rounded-full h-2">
					<div 
						class="bg-primary-accent h-2 rounded-full transition-all duration-300"
						style="width: {uploadProgress}%"
					></div>
				</div>
			</div>
		{/if}

		<div class="flex justify-end gap-2 p-4 border-t border-primary-4">
			<Button 
				variant="outline" 
				onclick={() => modalRef?.close()}
				disabled={isUploading}
			>
				{#snippet children()}
					Cancel
				{/snippet}
			</Button>
			<Button 
				variant="primary" 
				onclick={uploadLibrary}
				disabled={isUploading || !fileInput?.files?.length}
				isLoading={isUploading}
			>
				{#snippet children()}
					{#if isUploading}
						Uploading...
					{:else}
						<Upload size={16} />
						Upload
					{/if}
				{/snippet}
			</Button>
		</div>
	</div>
</Modal>

<!-- Population Progress Modal -->
<Modal bind:isOpen={showPopulationModal} title="Populating H5P Libraries" maxWidth="max-w-lg">
	<div class="p-6 space-y-6">
		<!-- Hub Statistics -->
		{#if populationStats}
			<div class="bg-primary-2 rounded-lg p-4">
				<h4 class="font-semibold text-sm mb-3 flex items-center gap-2">
					<BarChart size={16} />
					Hub Statistics
				</h4>
				<div class="grid grid-cols-2 gap-4">
					<div class="text-center">
						<div class="text-lg font-bold text-primary-accent">{populationStats.totalLibraries || 0}</div>
						<div class="text-xs text-secondary-4">Total Available</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-success">{populationStats.installedLibraries || 0}</div>
						<div class="text-xs text-secondary-4">Already Installed</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-warning">{populationStats.customLibraries || 0}</div>
						<div class="text-xs text-secondary-4">Custom Libraries</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-secondary">{populationStats.categories || 0}</div>
						<div class="text-xs text-secondary-4">Categories</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Progress Section -->
		{#if isPopulating || populationProgress.total > 0}
			<div class="space-y-4">
				<!-- Progress Status -->
				<div class="flex items-center gap-3">
					{#if isPopulating}
						<div class="animate-spin">
							<RefreshCw size={20} class="text-primary-accent" />
						</div>
					{:else}
						<CheckCircle size={20} class="text-success" />
					{/if}
					<div>
						<div class="font-medium">
							{#if populationProgress.current > 0 && populationProgress.total > 0}
								Progress: {populationProgress.current} / {populationProgress.total}
							{:else}
								Library Population
							{/if}
						</div>
						<div class="text-sm text-secondary-4">{populationProgress.status}</div>
					</div>
				</div>

				<!-- Progress Bar -->
				{#if populationProgress.total > 0}
					<div class="w-full bg-primary-2 rounded-full h-3">
						<div 
							class="bg-primary-accent h-3 rounded-full transition-all duration-300"
							style="width: {Math.round((populationProgress.current / populationProgress.total) * 100)}%"
						></div>
					</div>
					<div class="flex justify-between text-xs text-secondary-4">
						<span>{populationProgress.current} completed</span>
						<span>{Math.round((populationProgress.current / populationProgress.total) * 100)}%</span>
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center py-8">
				<Database size={48} class="text-secondary-4 mx-auto mb-4" />
				<h4 class="font-medium mb-2">Preparing Library Population</h4>
				<p class="text-sm text-secondary-4">Fetching library catalog from Catharsis Hub...</p>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex justify-end gap-2 pt-4 border-t border-primary-4">
			{#if !isPopulating}
				<Button 
					variant="outline" 
					onclick={() => { showPopulationModal = false; }}
				>
					{#snippet children()}
						Close
					{/snippet}
				</Button>
			{:else}
				<Button variant="outline" disabled>
					{#snippet children()}
						<Activity size={16} class="animate-pulse" />
						Populating...
					{/snippet}
				</Button>
			{/if}
		</div>
	</div>
</Modal>

<style>
	.library-manager {
		width: 100%;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>