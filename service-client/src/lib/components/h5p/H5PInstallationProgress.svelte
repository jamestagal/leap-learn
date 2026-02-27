<script>
	/**
	 * H5P Installation Progress Component
	 * Displays real-time progress for H5P library installations
	 */
	
	import { toast } from '@components/Toast.svelte';
	
	// Icons
	import Download from '@icons/download.svelte';
	import Package from '@icons/package.svelte';
	import Shield from '@icons/shield.svelte';
	import Database from '@icons/database.svelte';
	import CheckCircle from '@icons/circle-check.svelte';
	import XCircle from '@icons/circle-x.svelte';
	import AlertTriangle from '@icons/triangle-alert.svelte';
	import Spinner from '@components/Spinner.svelte';
	
	// Props
	let { 
		installations = new Map(),
		onComplete = null,
		onError = null,
		showDetails = true
	} = $props();
	
	// Installation stages with progress weights
	const installationStages = {
		'downloading': {
			icon: Download,
			label: 'Downloading',
			description: 'Fetching library package from H5P Hub',
			weight: 20
		},
		'extracting': {
			icon: Package,
			label: 'Extracting',
			description: 'Unpacking library files and dependencies',
			weight: 15
		},
		'validating': {
			icon: Shield,
			label: 'Validating',
			description: 'Security scanning and content validation',
			weight: 25
		},
		'installing': {
			icon: Database,
			label: 'Installing',
			description: 'Registering library in system database',
			weight: 25
		},
		'dependencies': {
			icon: Package,
			label: 'Dependencies',
			description: 'Processing required dependencies',
			weight: 15
		},
		'completed': {
			icon: CheckCircle,
			label: 'Completed',
			description: 'Library installed successfully',
			weight: 100
		},
		'failed': {
			icon: XCircle,
			label: 'Failed',
			description: 'Installation encountered an error',
			weight: 0
		}
	};
	
	// Convert installations Map to array for easier iteration
	let installationList = $derived(Array.from(installations.entries()));
	
	// Calculate overall progress for an installation
	function calculateProgress(installation) {
		const stage = installationStages[installation.status] || installationStages.downloading;
		const baseProgress = stage.weight;
		const stageProgress = installation.progress || 0;
		
		// For ongoing stages, interpolate within the stage weight
		if (installation.status !== 'completed' && installation.status !== 'failed') {
			return Math.min(baseProgress + (stageProgress * stage.weight / 100), 99);
		}
		
		return baseProgress;
	}
	
	// Format file size
	function formatFileSize(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
	
	// Format duration
	function formatDuration(ms) {
		if (ms < 1000) return `${ms}ms`;
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}
	
	// Handle installation completion
	function handleComplete(libraryId, result) {
		if (onComplete) {
			onComplete(libraryId, result);
		}
	}
	
	// Handle installation error
	function handleError(libraryId, error) {
		if (onError) {
			onError(libraryId, error);
		}
	}
</script>

{#if installationList.length > 0}
	<div class="space-y-4">
		{#each installationList as [libraryId, installation] (libraryId)}
			{@const stage = installationStages[installation.status] || installationStages.downloading}
			{@const progress = calculateProgress(installation)}
			{@const isCompleted = installation.status === 'completed'}
			{@const isFailed = installation.status === 'failed'}
			{@const isActive = !isCompleted && !isFailed}
			
			<div class="card p-4 {isCompleted ? 'border-success bg-success/5' : isFailed ? 'border-danger bg-danger/5' : 'border-primary-accent bg-primary-accent/5'}">
				<!-- Header -->
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-3">
						<!-- Stage Icon -->
						<div class="flex items-center justify-center w-8 h-8 rounded-full {isCompleted ? 'bg-success/20' : isFailed ? 'bg-danger/20' : 'bg-primary-accent/20'}">
							{#if isActive}
								<Spinner size={16} />
							{:else}
								{#if stage.icon === Download}
									<Download size={16} class={isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'} />
								{:else if stage.icon === Package}
									<Package size={16} class={isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'} />
								{:else if stage.icon === Shield}
									<Shield size={16} class={isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'} />
								{:else if stage.icon === Database}
									<Database size={16} class={isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'} />
								{:else if stage.icon === CheckCircle}
									<CheckCircle size={16} class={isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'} />
								{:else if stage.icon === XCircle}
									<XCircle size={16} class={isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'} />
								{/if}
							{/if}
						</div>
						
						<!-- Library Info -->
						<div>
							<h4 class="font-medium text-secondary">
								{installation.libraryTitle || libraryId}
							</h4>
							<p class="text-sm text-secondary-4">
								{stage.label}: {installation.message || stage.description}
							</p>
						</div>
					</div>
					
					<!-- Progress Percentage -->
					<div class="text-right">
						<div class="text-sm font-medium {isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-primary-accent'}">
							{isCompleted ? '100%' : isFailed ? 'Error' : `${Math.round(progress)}%`}
						</div>
						{#if installation.duration}
							<div class="text-xs text-secondary-4">
								{formatDuration(installation.duration)}
							</div>
						{/if}
					</div>
				</div>
				
				<!-- Progress Bar -->
				{#if !isFailed}
					<div class="w-full bg-primary-2 rounded-full h-2 mb-3">
						<div 
							class="h-2 rounded-full transition-all duration-300 {isCompleted ? 'bg-success' : 'bg-primary-accent'}"
							style="width: {progress}%"
						></div>
					</div>
				{:else}
					<div class="w-full bg-danger/20 rounded-full h-2 mb-3">
						<div class="h-2 rounded-full bg-danger" style="width: 100%"></div>
					</div>
				{/if}
				
				<!-- Details (when enabled) -->
				{#if showDetails}
					<div class="grid grid-cols-2 gap-4 text-xs text-secondary-4">
						<!-- Left Column -->
						<div class="space-y-1">
							{#if installation.version}
								<div class="flex justify-between">
									<span>Version:</span>
									<span class="font-mono">{installation.version}</span>
								</div>
							{/if}
							
							{#if installation.fileCount}
								<div class="flex justify-between">
									<span>Files:</span>
									<span>{installation.fileCount}</span>
								</div>
							{/if}
							
							{#if installation.dependenciesCount}
								<div class="flex justify-between">
									<span>Dependencies:</span>
									<span>{installation.dependenciesCount}</span>
								</div>
							{/if}
						</div>
						
						<!-- Right Column -->
						<div class="space-y-1">
							{#if installation.packageSize}
								<div class="flex justify-between">
									<span>Size:</span>
									<span>{formatFileSize(installation.packageSize)}</span>
								</div>
							{/if}
							
							{#if installation.source}
								<div class="flex justify-between">
									<span>Source:</span>
									<span class="capitalize">{installation.source}</span>
								</div>
							{/if}
							
							{#if installation.securityScore !== undefined}
								<div class="flex justify-between">
									<span>Security:</span>
									<span class="flex items-center gap-1">
										{installation.securityScore === 0 ? 'Safe' : 'Issues'}
										{#if installation.securityScore > 0}
											<AlertTriangle size={10} class="text-warning" />
										{/if}
									</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
				
				<!-- Error Details -->
				{#if isFailed && installation.error}
					<div class="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-lg">
						<div class="flex items-start gap-2">
							<XCircle size={16} class="text-danger mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-sm font-medium text-danger mb-1">Installation Failed</p>
								<p class="text-xs text-secondary-4">{installation.error}</p>
								
								{#if installation.suggestion}
									<p class="text-xs text-secondary-4 mt-1">
										<strong>Suggestion:</strong> {installation.suggestion}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				
				<!-- Success Details -->
				{#if isCompleted}
					<div class="mt-3 p-3 bg-success/10 border border-success/20 rounded-lg">
						<div class="flex items-start gap-2">
							<CheckCircle size={16} class="text-success mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-sm font-medium text-success mb-1">Installation Complete</p>
								<p class="text-xs text-secondary-4">
									{installation.libraryTitle || libraryId} is now available for content creation.
								</p>
								
								{#if installation.dependenciesInstalled}
									<p class="text-xs text-secondary-4 mt-1">
										{installation.dependenciesInstalled} dependencies were also installed.
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				
				<!-- Warnings -->
				{#if installation.warnings && installation.warnings.length > 0}
					<div class="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
						<div class="flex items-start gap-2">
							<AlertTriangle size={16} class="text-warning mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-sm font-medium text-warning mb-1">Warnings</p>
								<ul class="text-xs text-secondary-4 space-y-1">
									{#each installation.warnings as warning}
										<li>• {warning}</li>
									{/each}
								</ul>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<!-- No active installations -->
	<div class="text-center py-8 text-secondary-4">
		<Package size={32} class="mx-auto mb-2 opacity-50" />
		<p class="text-sm">No installations in progress</p>
	</div>
{/if}