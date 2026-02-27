<script>
	import { onMount } from 'svelte';
	import { toast } from '@components/Toast.svelte';
	import Spinner from '@components/Spinner.svelte';
	import Play from '@icons/play.svelte';
	import Pause from '@icons/pause.svelte';
	import RotateCcw from '@icons/rotate-ccw.svelte';

	// Props using Svelte 5 $props rune
	let { 
		contentId, 
		organizationId = null,
		showControls = true,
		enableTracking = true,
		onProgress = null,
		onCompleted = null,
		className = ''
	} = $props();

	// State using Svelte 5 $state rune
	let h5pContainer = $state();
	let isLoading = $state(true);
	let isPlaying = $state(false);
	let error = $state(null);
	let h5pInstance = $state(null);
	let progress = $state(0);
	let contentData = $state(null);

	// Derived values using $derived
	let canPlay = $derived(contentData && !isLoading && !error);
	let playerClass = $derived(`h5p-player ${className} ${isLoading ? 'loading' : ''}`);

	// Load H5P content using hybrid delivery API
	async function loadContent() {
		try {
			isLoading = true;
			error = null;
			
			// Use the new hybrid delivery endpoint
			const response = await fetch(`/api/public/h5p/play/${contentId}`, {
				headers: {
					'Content-Type': 'application/json',
					'X-Organization-Id': organizationId || ''
				}
			});

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Content not found or not accessible');
				} else if (response.status === 403) {
					throw new Error('Access denied to this content');
				}
				throw new Error(`Failed to load content: ${response.statusText}`);
			}

			const data = await response.json();
			contentData = data;

			// Load h5p-standalone for fast delivery
			if (!window.H5PStandalone) {
				await loadH5PStandalone();
			}

			// Initialize H5P player with standalone
			initializeH5P(data);
		} catch (err) {
			console.error('Error loading H5P content:', err);
			error = err.message;
			toast.error('Failed to load H5P content');
		} finally {
			isLoading = false;
		}
	}

	// Load h5p-standalone library for fast content delivery
	async function loadH5PStandalone() {
		return new Promise((resolve, reject) => {
			if (window.H5PStandalone) {
				resolve();
				return;
			}

			// Load CSS first
			const cssLink = document.createElement('link');
			cssLink.rel = 'stylesheet';
			cssLink.href = '/h5p-standalone/styles/h5p-standalone.css';
			document.head.appendChild(cssLink);

			// Load JavaScript
			const script = document.createElement('script');
			script.src = '/h5p-standalone/dist/main.bundle.js';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load H5P Standalone'));
			document.head.appendChild(script);
		});
	}

	// Initialize H5P instance using h5p-standalone for optimal performance
	function initializeH5P(data) {
		if (!h5pContainer || !window.H5PStandalone) {
			error = 'H5P Standalone library not loaded';
			return;
		}

		try {
			// Clear existing content
			h5pContainer.innerHTML = '';

			// Configure h5p-standalone options for fast loading
			const options = {
				frameJs: data.integration?.core?.scripts || '/h5p-standalone/dist/frame.bundle.js',
				frameCss: data.integration?.core?.styles || '/h5p-standalone/dist/h5p.css',
				h5pJsonPath: data.contentUrl || `/api/public/h5p/assets/${contentId}/h5p.json`,
				librariesPath: data.librariesPath || '/h5p-libraries',
				contentJsonPath: data.contentJsonPath || `/api/public/h5p/assets/${contentId}/content/content.json`,
				displayOptions: {
					frame: true,
					export: false,
					embed: false,
					copyright: true,
					icon: false
				}
			};

			// Create H5P Standalone instance for fast delivery
			h5pInstance = new window.H5PStandalone.H5P(h5pContainer, options);
			
			// Set up event listeners for progress tracking
			if (enableTracking && window.H5P) {
				setupTracking();
			}
			
			isPlaying = true;
		} catch (err) {
			console.error('Error initializing H5P:', err);
			error = 'Failed to initialize H5P content';
		}
	}

	// Setup xAPI tracking with h5p-standalone
	function setupTracking() {
		if (!h5pInstance || !enableTracking || !window.H5P) return;

		// Listen for xAPI statements using H5P global event system
		window.H5P.on(h5pInstance, 'xAPI', (event) => {
			trackProgress(event.data.statement);
		});

		// Also listen for resize events to maintain proper display
		window.H5P.on(h5pInstance, 'resize', () => {
			if (h5pContainer && h5pInstance.trigger) {
				h5pInstance.trigger('resize');
			}
		});
	}

	// Track progress and send to backend
	async function trackProgress(statement) {
		try {
			// Update local progress
			if (statement.result && statement.result.score) {
				progress = Math.round(statement.result.score.scaled * 100);
			}

			// Send to backend
			const response = await fetch('/api/private/progress/track', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					contentId,
					organizationId,
					xapiStatement: statement
				})
			});

			if (response.ok) {
				// Call progress callback if provided
				if (onProgress) {
					onProgress(progress, statement);
				}

				// Check for completion
				if (statement.verb && statement.verb.id === 'http://adlnet.gov/expapi/verbs/completed') {
					if (onCompleted) {
						onCompleted(progress, statement);
					}
					toast.success('Content completed!');
				}
			}
		} catch (err) {
			console.error('Error tracking progress:', err);
		}
	}

	// Control functions
	function togglePlay() {
		if (!h5pInstance) return;
		
		if (isPlaying) {
			h5pInstance.pause?.();
			isPlaying = false;
		} else {
			h5pInstance.play?.();
			isPlaying = true;
		}
	}

	function resetContent() {
		if (!h5pInstance) return;
		
		h5pInstance.resetTask?.();
		progress = 0;
		toast.info('Content reset');
	}

	// Load content on mount
	onMount(() => {
		if (contentId) {
			loadContent();
		}

		// Cleanup on unmount
		return () => {
			if (h5pInstance) {
				h5pInstance.off?.('xAPI');
			}
		};
	});

	// Reload when contentId changes
	$effect(() => {
		if (contentId) {
			loadContent();
		}
	});
</script>

<div class={playerClass}>
	{#if isLoading}
		<div class="flex items-center justify-center p-8">
			<Spinner size={32} />
			<span class="ml-2 text-secondary-4">Loading H5P content...</span>
		</div>
	{:else if error}
		<div class="flex items-center justify-center p-8 text-center">
			<div class="card p-6 max-w-md">
				<h3 class="text-lg font-semibold text-danger mb-2">Error Loading Content</h3>
				<p class="text-secondary-4 mb-4">{error}</p>
				<button 
					class="button primary"
					onclick={loadContent}
				>
					Retry
				</button>
			</div>
		</div>
	{:else}
		<!-- H5P Container -->
		<div 
			bind:this={h5pContainer} 
			class="h5p-content-container"
			data-content-id={contentId}
		>
			<!-- H5P content will be rendered here -->
		</div>

		<!-- Control Bar -->
		{#if showControls && canPlay}
			<div class="h5p-controls card p-3 mt-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<button 
						class="button icon"
						onclick={togglePlay}
						title={isPlaying ? 'Pause' : 'Play'}
					>
						{#if isPlaying}
							<Pause size={20} />
						{:else}
							<Play size={20} />
						{/if}
					</button>

					<button 
						class="button icon"
						onclick={resetContent}
						title="Reset content"
					>
						<RotateCcw size={20} />
					</button>
				</div>

				{#if enableTracking}
					<div class="flex items-center gap-2">
						<span class="text-sm text-secondary-4">Progress:</span>
						<div class="w-24 bg-primary-2 rounded-full h-2">
							<div 
								class="bg-primary-accent h-2 rounded-full transition-all duration-300"
								style="width: {progress}%"
							></div>
						</div>
						<span class="text-sm font-medium">{progress}%</span>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.h5p-player {
		position: relative;
		width: 100%;
	}

	.h5p-content-container {
		width: 100%;
		min-height: 24rem;
		border-radius: 0.5rem;
		border: 1px solid var(--primary-3);
		background-color: var(--main);
	}

	.h5p-player.loading .h5p-content-container {
		opacity: 0.5;
	}

	.h5p-controls {
		border-color: var(--primary-2);
	}
</style>