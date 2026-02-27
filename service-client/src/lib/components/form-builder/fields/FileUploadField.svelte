<script lang="ts">
	/**
	 * FileUploadField - File upload with drag & drop
	 */
	import Upload from "lucide-svelte/icons/upload";
	import X from "lucide-svelte/icons/x";
	import FileIcon from "lucide-svelte/icons/file";

	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: string | undefined;
		accept?: string | undefined;
		maxSize?: number | undefined;
		onchange: (value: string | null) => void;
	}

	let {
		id,
		name,
		label,
		description,
		required = false,
		disabled = false,
		error,
		value,
		accept = "*/*",
		maxSize,
		onchange,
	}: Props = $props();

	let isDragging = $state(false);
	let fileNameOverride = $state<string | null>(null);
	let fileName = $derived(fileNameOverride ?? value ?? "");

	function handleFileSelect(e: Event): void {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			if (maxSize && file.size > maxSize) {
				// File too large - would need toast here
				return;
			}
			fileNameOverride = file.name;
			onchange(file.name);
		}
	}

	function handleDrop(e: DragEvent): void {
		e.preventDefault();
		isDragging = false;

		if (disabled) return;

		const file = e.dataTransfer?.files[0];
		if (file) {
			if (maxSize && file.size > maxSize) {
				return;
			}
			fileNameOverride = file.name;
			onchange(file.name);
		}
	}

	function handleDragOver(e: DragEvent): void {
		e.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave(): void {
		isDragging = false;
	}

	function clearFile(): void {
		fileNameOverride = "";
		onchange(null);
	}
</script>

<div class="form-control w-full">
	<label class="label" for={id}>
		<span class="label-text">
			{label}
			{#if required}
				<span class="text-error ml-1">*</span>
			{/if}
		</span>
	</label>

	{#if description}
		<p class="text-xs text-base-content/60 mb-1">{description}</p>
	{/if}

	{#if fileName}
		<!-- File selected state -->
		<div
			class="flex items-center gap-3 p-3 border border-base-300 rounded-lg bg-base-200/50"
		>
			<FileIcon class="h-5 w-5 text-base-content/60" />
			<span class="flex-1 text-sm truncate">{fileName}</span>
			{#if !disabled}
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					onclick={clearFile}
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	{:else}
		<!-- Drop zone -->
		<div
			class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer {isDragging ? 'border-primary bg-primary/5' : ''} {!isDragging && !error ? 'border-base-300' : ''}"
			class:border-error={!!error}
			class:opacity-50={disabled}
			class:cursor-not-allowed={disabled}
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			role="button"
			tabindex="0"
		>
			<input
				{id}
				{name}
				type="file"
				class="hidden"
				{disabled}
				{accept}
				onchange={handleFileSelect}
			/>
			<label for={id} class="cursor-pointer">
				<Upload class="h-8 w-8 mx-auto mb-2 text-base-content/60" />
				<p class="text-sm text-base-content/70">
					<span class="font-medium text-primary">Click to upload</span> or drag and drop
				</p>
				{#if accept !== "*/*"}
					<p class="text-xs text-base-content/50 mt-1">
						{accept}
					</p>
				{/if}
			</label>
		</div>
	{/if}

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
