<script>
	/**
	 * H5P Drag & Drop Component
	 * Handles file uploads and content organization with drag-and-drop
	 */
	
	import { onMount } from 'svelte';
	import Upload from '@icons/upload.svelte';
	import File from '@icons/file.svelte';
	import X from '@icons/x.svelte';
	import CheckCircle from '@icons/circle-check.svelte';
	import AlertCircle from '@icons/circle-alert.svelte';

	let {
		mode = 'upload', // 'upload' | 'organize'
		accept = '.h5p',
		maxFiles = 10,
		maxSizeBytes = 50 * 1024 * 1024, // 50MB default
		disabled = false,
		multiple = true,
		onFilesAdded = () => {},
		onFilesRemoved = () => {},
		onDrop = () => {}, // For organize mode
		onDragOver = () => {},
		placeholder = 'Drag files here or click to upload',
		class: className = '',
		...restProps
	} = $props();

	let dragZoneRef = $state();
	let fileInputRef = $state();
	let files = $state([]);
	let isDragging = $state(false);
	let dragCounter = $state(0);
	let uploadProgress = $state(new Map());

	onMount(() => {
		const dragZone = dragZoneRef;
		if (!dragZone) return;

		// Prevent default drag behaviors
		const preventDefaults = (e) => {
			e.preventDefault();
			e.stopPropagation();
		};

		// Handle drag events
		const handleDragEnter = (e) => {
			preventDefaults(e);
			dragCounter++;
			if (dragCounter === 1) {
				isDragging = true;
			}
		};

		const handleDragOver = (e) => {
			preventDefaults(e);
			onDragOver(e);
		};

		const handleDragLeave = (e) => {
			preventDefaults(e);
			dragCounter--;
			if (dragCounter === 0) {
				isDragging = false;
			}
		};

		const handleDrop = (e) => {
			preventDefaults(e);
			dragCounter = 0;
			isDragging = false;

			if (disabled) return;

			if (mode === 'organize') {
				onDrop(e);
				return;
			}

			// Handle file uploads
			const droppedFiles = Array.from(e.dataTransfer.files);
			handleFiles(droppedFiles);
		};

		// Add event listeners
		dragZone.addEventListener('dragenter', handleDragEnter);
		dragZone.addEventListener('dragover', handleDragOver);
		dragZone.addEventListener('dragleave', handleDragLeave);
		dragZone.addEventListener('drop', handleDrop);

		return () => {
			dragZone.removeEventListener('dragenter', handleDragEnter);
			dragZone.removeEventListener('dragover', handleDragOver);
			dragZone.removeEventListener('dragleave', handleDragLeave);
			dragZone.removeEventListener('drop', handleDrop);
		};
	});

	// Handle file input change
	function handleFileInput(event) {
		const selectedFiles = Array.from(event.target.files);
		handleFiles(selectedFiles);
	}

	// Process files
	function handleFiles(newFiles) {
		if (!newFiles.length) return;

		// Filter and validate files
		const validFiles = newFiles.filter(file => {
			// Check file type
			if (accept !== '*' && !file.name.toLowerCase().endsWith(accept.replace('*', ''))) {
				console.warn(`File ${file.name} does not match accepted type: ${accept}`);
				return false;
			}

			// Check file size
			if (file.size > maxSizeBytes) {
				console.warn(`File ${file.name} exceeds maximum size: ${formatFileSize(maxSizeBytes)}`);
				return false;
			}

			return true;
		});

		// Check max files limit
		const totalFiles = files.length + validFiles.length;
		if (totalFiles > maxFiles) {
			const allowedCount = maxFiles - files.length;
			validFiles.splice(allowedCount);
			console.warn(`Only ${allowedCount} more files can be added. Maximum is ${maxFiles}.`);
		}

		if (validFiles.length > 0) {
			const filesWithIds = validFiles.map(file => ({
				id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				file,
				name: file.name,
				size: file.size,
				status: 'pending' // 'pending', 'uploading', 'success', 'error'
			}));

			files = [...files, ...filesWithIds];
			onFilesAdded(filesWithIds);
		}
	}

	// Remove file
	function removeFile(fileId) {
		const removedFiles = files.filter(f => f.id === fileId);
		files = files.filter(f => f.id !== fileId);
		uploadProgress.delete(fileId);
		uploadProgress = uploadProgress; // Trigger reactivity
		onFilesRemoved(removedFiles);
	}

	// Clear all files
	function clearFiles() {
		const removedFiles = [...files];
		files = [];
		uploadProgress.clear();
		uploadProgress = uploadProgress; // Trigger reactivity
		onFilesRemoved(removedFiles);
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	// Format file size
	function formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Update progress (called externally)
	export function updateProgress(fileId, progress) {
		uploadProgress.set(fileId, progress);
		uploadProgress = uploadProgress; // Trigger reactivity
	}

	// Update file status (called externally)
	export function updateFileStatus(fileId, status, error = null) {
		files = files.map(f => f.id === fileId ? { ...f, status, error } : f);
	}

	// Click handler for drag zone
	function handleClick() {
		if (!disabled && mode === 'upload' && fileInputRef) {
			fileInputRef.click();
		}
	}
</script>

<div 
	bind:this={dragZoneRef}
	class="
		h5p-drag-drop relative
		border-2 border-dashed rounded-lg transition-all duration-200
		{isDragging && !disabled ? 'border-primary-accent bg-primary-accent/5' : 'border-primary-3'}
		{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
		{mode === 'upload' ? 'hover:border-primary-accent hover:bg-primary/20' : ''}
		{className}
	"
	onclick={handleClick}
	role={mode === 'upload' ? 'button' : undefined}
	tabindex={mode === 'upload' && !disabled ? '0' : undefined}
	aria-label={mode === 'upload' ? placeholder : undefined}
	{...restProps}
>
	{#if mode === 'upload'}
		<!-- Hidden file input -->
		<input
			bind:this={fileInputRef}
			type="file"
			{accept}
			{multiple}
			{disabled}
			class="hidden"
			onchange={handleFileInput}
		/>

		<!-- Upload area -->
		<div class="p-8 text-center">
			<div class="
				w-16 h-16 mx-auto mb-4 rounded-full
				flex items-center justify-center
				{isDragging ? 'bg-primary-accent/20 text-primary-accent' : 'bg-primary-2 text-secondary-4'}
			">
				<Upload class="w-8 h-8" />
			</div>
			
			<h3 class="text-lg font-medium text-secondary mb-2">
				{isDragging ? 'Drop files here' : 'Upload H5P Content'}
			</h3>
			
			<p class="text-sm text-secondary-4 mb-4">
				{placeholder}
			</p>
			
			<div class="text-xs text-secondary-4">
				<p>Maximum file size: {formatFileSize(maxSizeBytes)}</p>
				<p>Maximum files: {maxFiles}</p>
				{#if accept !== '*'}
					<p>Accepted formats: {accept}</p>
				{/if}
			</div>
		</div>

		<!-- File list -->
		{#if files.length > 0}
			<div class="border-t border-primary-2 p-4 bg-primary/20">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-sm font-medium text-secondary">
						Files ({files.length}/{maxFiles})
					</h4>
					<button
						onclick={(e) => { e.stopPropagation(); clearFiles(); }}
						class="text-xs text-secondary-4 hover:text-danger transition-colors"
						disabled={disabled}
					>
						Clear All
					</button>
				</div>
				
				<div class="space-y-2 max-h-32 overflow-y-auto">
					{#each files as file (file.id)}
						<div class="flex items-center gap-3 p-2 bg-white rounded border">
							<!-- File icon -->
							<div class="flex-shrink-0">
								{#if file.status === 'success'}
									<CheckCircle class="w-4 h-4 text-success" />
								{:else if file.status === 'error'}
									<AlertCircle class="w-4 h-4 text-danger" />
								{:else}
									<File class="w-4 h-4 text-secondary-4" />
								{/if}
							</div>
							
							<!-- File info -->
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-secondary truncate">
									{file.name}
								</p>
								<p class="text-xs text-secondary-4">
									{formatFileSize(file.size)}
								</p>
								
								<!-- Progress bar -->
								{#if file.status === 'uploading' && uploadProgress.has(file.id)}
									<div class="mt-1 w-full bg-primary-2 rounded-full h-1">
										<div 
											class="bg-primary-accent h-1 rounded-full transition-all duration-300"
											style="width: {uploadProgress.get(file.id)}%"
										></div>
									</div>
								{/if}
								
								<!-- Error message -->
								{#if file.status === 'error' && file.error}
									<p class="text-xs text-danger mt-1">
										{file.error}
									</p>
								{/if}
							</div>
							
							<!-- Remove button -->
							<button
								onclick={(e) => { e.stopPropagation(); removeFile(file.id); }}
								class="flex-shrink-0 p-1 hover:bg-primary-2 rounded transition-colors"
								disabled={disabled}
								aria-label="Remove {file.name}"
							>
								<X class="w-3 h-3 text-secondary-4" />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<!-- Organize mode - just the drop zone -->
		<div class="p-8 text-center">
			<slot>
				<div class="text-secondary-4">
					Drop items here to organize
				</div>
			</slot>
		</div>
	{/if}
</div>

<style>
	.h5p-drag-drop {
		/* Smooth transitions for drag states */
		transition: border-color 200ms ease, background-color 200ms ease;
	}
	
	/* Focus styles for accessibility */
	.h5p-drag-drop:focus-visible {
		outline: 2px solid var(--primary-accent);
		outline-offset: 2px;
	}
	
	/* Custom scrollbar for file list */
	.overflow-y-auto {
		scrollbar-width: thin;
		scrollbar-color: var(--primary-3) transparent;
	}
	
	.overflow-y-auto::-webkit-scrollbar {
		width: 4px;
	}
	
	.overflow-y-auto::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: var(--primary-3);
		border-radius: 2px;
	}
</style>