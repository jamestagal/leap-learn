<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateOrganisationProfile } from '$lib/api/organisation-profile.remote';
	import { updateOrganisationBranding } from '$lib/api/organisation.remote';

	const toast = getToast();
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import FormField from '$lib/components/settings/FormField.svelte';
	import { Share2, Type, Quote, Image, Palette, Upload, X, Check } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Extract initial values (wrapped in function to signal intentional non-reactive capture)
	function getInitialFormData() {
		return {
			tagline: data.profile?.tagline ?? '',
			brandFont: data.profile?.brandFont ?? '',
			socialLinkedin: data.profile?.socialLinkedin ?? '',
			socialFacebook: data.profile?.socialFacebook ?? '',
			socialInstagram: data.profile?.socialInstagram ?? '',
			socialTwitter: data.profile?.socialTwitter ?? ''
		};
	}

	function getInitialBrandingData() {
		return {
			logoUrl: data.organisation?.logoUrl ?? '', // Horizontal logo for documents
			logoAvatarUrl: data.organisation?.logoAvatarUrl ?? '', // Square avatar for nav/UI
			primaryColor: data.organisation?.primaryColor ?? '#3b82f6',
			secondaryColor: data.organisation?.secondaryColor ?? '#1e40af',
			accentColor: data.organisation?.accentColor ?? '#f59e0b',
			accentGradient: data.organisation?.accentGradient ?? ''
		};
	}

	// Form state - initialized once, maintains user edits until save
	let formData = $state(getInitialFormData());
	let brandingData = $state(getInitialBrandingData());

	let isSaving = $state(false);
	let isSavingBranding = $state(false);
	let error = $state('');

	// Logo upload state - separate for each logo type
	let logoPreview = $state<string | null>(null); // For horizontal logo
	let avatarPreview = $state<string | null>(null); // For avatar logo
	let isDragging = $state(false);
	let isDraggingAvatar = $state(false);
	let fileInput: HTMLInputElement;
	let avatarFileInput: HTMLInputElement;

	// Common font options
	const fontOptions = [
		{ value: '', label: 'Default (System)' },
		{ value: 'Inter', label: 'Inter' },
		{ value: 'Roboto', label: 'Roboto' },
		{ value: 'Open Sans', label: 'Open Sans' },
		{ value: 'Lato', label: 'Lato' },
		{ value: 'Montserrat', label: 'Montserrat' },
		{ value: 'Poppins', label: 'Poppins' },
		{ value: 'Raleway', label: 'Raleway' },
		{ value: 'Playfair Display', label: 'Playfair Display' },
		{ value: 'Source Sans Pro', label: 'Source Sans Pro' }
	];

	// Handle file selection for logo
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			processLogoFile(file);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files[0];
		if (file && file.type.startsWith('image/')) {
			processLogoFile(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function processLogoFile(file: File) {
		// Validate file size (max 2MB for logos)
		if (file.size > 2 * 1024 * 1024) {
			toast.error('File too large', 'Logo must be under 2MB');
			return;
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			toast.error('Invalid file', 'Please upload an image file');
			return;
		}

		// Read file as base64 data URL
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			logoPreview = result;
			brandingData.logoUrl = result;
		};
		reader.readAsDataURL(file);
	}

	function removeLogo() {
		logoPreview = null;
		brandingData.logoUrl = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	// Avatar logo handling functions
	function handleAvatarFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			processAvatarFile(file);
		}
	}

	function handleAvatarDrop(event: DragEvent) {
		event.preventDefault();
		isDraggingAvatar = false;
		const file = event.dataTransfer?.files[0];
		if (file && file.type.startsWith('image/')) {
			processAvatarFile(file);
		}
	}

	function handleAvatarDragOver(event: DragEvent) {
		event.preventDefault();
		isDraggingAvatar = true;
	}

	function handleAvatarDragLeave() {
		isDraggingAvatar = false;
	}

	function processAvatarFile(file: File) {
		// Validate file size (max 1MB for avatars)
		if (file.size > 1 * 1024 * 1024) {
			toast.error('File too large', 'Avatar must be under 1MB');
			return;
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			toast.error('Invalid file', 'Please upload an image file');
			return;
		}

		// Read file as base64 data URL
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			avatarPreview = result;
			brandingData.logoAvatarUrl = result;
		};
		reader.readAsDataURL(file);
	}

	function removeAvatar() {
		avatarPreview = null;
		brandingData.logoAvatarUrl = '';
		if (avatarFileInput) {
			avatarFileInput.value = '';
		}
	}

	async function handleSaveBranding() {
		isSavingBranding = true;
		error = '';

		try {
			await updateOrganisationBranding({
				logoUrl: brandingData.logoUrl,
				logoAvatarUrl: brandingData.logoAvatarUrl,
				primaryColor: brandingData.primaryColor,
				secondaryColor: brandingData.secondaryColor,
				accentColor: brandingData.accentColor,
				accentGradient: brandingData.accentGradient
			});
			await invalidateAll();
			logoPreview = null; // Clear preview after successful save
			avatarPreview = null; // Clear avatar preview after successful save
			toast.success('Branding updated', 'Logos and colors saved successfully');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save branding';
			toast.error('Save failed', error);
		} finally {
			isSavingBranding = false;
		}
	}

	async function handleSave() {
		isSaving = true;
		error = '';

		try {
			await updateOrganisationProfile(formData);
			await invalidateAll();
			toast.success('Branding updated');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save branding';
			toast.error('Save failed', error);
		} finally {
			isSaving = false;
		}
	}

	// Derived: check if branding has changes
	let brandingHasChanges = $derived(
		brandingData.logoUrl !== (data.organisation?.logoUrl ?? '') ||
		brandingData.logoAvatarUrl !== (data.organisation?.logoAvatarUrl ?? '') ||
		brandingData.primaryColor !== (data.organisation?.primaryColor ?? '#3b82f6') ||
		brandingData.secondaryColor !== (data.organisation?.secondaryColor ?? '#1e40af') ||
		brandingData.accentColor !== (data.organisation?.accentColor ?? '#f59e0b') ||
		brandingData.accentGradient !== (data.organisation?.accentGradient ?? '')
	);

	// Helper: Get background style (gradient if set, otherwise solid accent color)
	let accentBackground = $derived(
		brandingData.accentGradient || brandingData.accentColor
	);

	// Current display logos (file preview takes precedence, then form state, then server data)
	let displayLogo = $derived(logoPreview || brandingData.logoUrl || data.organisation?.logoUrl);
	let displayAvatar = $derived(avatarPreview || brandingData.logoAvatarUrl || data.organisation?.logoAvatarUrl);

	// Sync branding data with server data on initial load
	$effect(() => {
		const serverLogoUrl = data.organisation?.logoUrl ?? '';
		const serverAvatarUrl = data.organisation?.logoAvatarUrl ?? '';

		if (!brandingData.logoUrl && serverLogoUrl) {
			brandingData.logoUrl = serverLogoUrl;
		}
		if (!brandingData.logoAvatarUrl && serverAvatarUrl) {
			brandingData.logoAvatarUrl = serverAvatarUrl;
		}
	});
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold">Branding</h1>
		<p class="text-base-content/70 mt-1">Customize your organisation's appearance and social presence</p>
	</div>

	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<!-- Tagline -->
	<SettingsSection
		title="Tagline"
		description="A short phrase that describes your organisation"
		icon={Quote}
	>
		<FormField label="Tagline" hint="Appears on documents and emails">
			<input
				type="text"
				class="input input-bordered w-full"
				placeholder="Building digital experiences that matter"
				bind:value={formData.tagline}
			/>
		</FormField>
	</SettingsSection>

	<!-- Typography -->
	<SettingsSection
		title="Typography"
		description="Font used in generated documents"
		icon={Type}
	>
		<FormField label="Brand Font" hint="Font for documents and emails">
			<select class="select select-bordered w-full" bind:value={formData.brandFont}>
				{#each fontOptions as font}
					<option value={font.value}>{font.label}</option>
				{/each}
			</select>
		</FormField>
	</SettingsSection>

	<!-- Social Links -->
	<SettingsSection
		title="Social Links"
		description="Connect your social media profiles"
		icon={Share2}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="LinkedIn">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">linkedin.com/company/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-company"
						bind:value={formData.socialLinkedin}
					/>
				</label>
			</FormField>

			<FormField label="Facebook">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">facebook.com/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-page"
						bind:value={formData.socialFacebook}
					/>
				</label>
			</FormField>

			<FormField label="Instagram">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">instagram.com/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-handle"
						bind:value={formData.socialInstagram}
					/>
				</label>
			</FormField>

			<FormField label="X (Twitter)">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">x.com/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-handle"
						bind:value={formData.socialTwitter}
					/>
				</label>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Save Profile Button -->
	<div class="flex justify-end gap-3">
		<button type="button" class="btn btn-primary" onclick={handleSave} disabled={isSaving}>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			Save Profile
		</button>
	</div>

	<div class="divider"></div>

	<!-- Square Logo (Avatar) -->
	<SettingsSection
		title="Square Logo (Avatar)"
		description="Square logo for navigation and compact UI elements"
		icon={Image}
	>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<!-- Avatar Preview -->
			<div class="flex flex-col items-center gap-3">
				{#if displayAvatar}
					<div class="relative">
						<div class="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-base-300 bg-base-200 p-1">
							<img
								src={displayAvatar}
								alt="Avatar logo preview"
								class="h-full w-full rounded-lg object-cover"
							/>
						</div>
						<button
							type="button"
							class="btn btn-circle btn-error btn-xs absolute -right-2 -top-2"
							onclick={removeAvatar}
							title="Remove avatar"
						>
							<X class="h-3 w-3" />
						</button>
						{#if avatarPreview}
							<span class="badge badge-warning badge-sm absolute -bottom-2 left-1/2 -translate-x-1/2">
								Unsaved
							</span>
						{/if}
					</div>
				{:else}
					<div class="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-base-300 bg-base-200">
						<span class="text-2xl font-bold text-base-content/30">{data.organisation?.name?.charAt(0) ?? 'O'}</span>
					</div>
				{/if}
			</div>

			<!-- Upload Area -->
			<div class="flex-1">
				<div
					class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors
						{isDraggingAvatar ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}"
					role="button"
					tabindex="0"
					ondrop={handleAvatarDrop}
					ondragover={handleAvatarDragOver}
					ondragleave={handleAvatarDragLeave}
					onclick={() => avatarFileInput?.click()}
					onkeydown={(e) => e.key === 'Enter' && avatarFileInput?.click()}
				>
					<input
						bind:this={avatarFileInput}
						type="file"
						accept="image/*"
						class="hidden"
						onchange={handleAvatarFileSelect}
					/>
					<Upload class="mx-auto h-6 w-6 text-base-content/40" />
					<p class="mt-1 text-sm font-medium">
						{isDraggingAvatar ? 'Drop here' : 'Click or drag to upload'}
					</p>
					<p class="mt-1 text-xs text-base-content/60">
						Square image (1:1). Recommended: 256x256px, PNG/SVG
					</p>
				</div>

				<!-- Or enter URL -->
				<div class="mt-3">
					<FormField label="Or enter URL">
						<input
							type="url"
							class="input input-bordered input-sm w-full"
							placeholder="https://example.com/avatar.png"
							bind:value={brandingData.logoAvatarUrl}
						/>
					</FormField>
				</div>
			</div>
		</div>

		<!-- Used in indicator -->
		<div class="mt-4 flex items-start gap-2 text-xs text-base-content/60">
			<span class="font-medium">Used in:</span>
			<span>Sidebar navigation, Organisation switcher, Mobile menu</span>
		</div>
	</SettingsSection>

	<!-- Full Logo (Horizontal) -->
	<SettingsSection
		title="Full Logo (Horizontal)"
		description="Horizontal logo for documents and email headers"
		icon={Image}
	>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<!-- Logo Preview -->
			<div class="flex flex-col items-center gap-3">
				{#if displayLogo}
					<div class="relative">
						<div class="flex h-16 w-48 items-center justify-center rounded-xl border-2 border-base-300 bg-base-200 p-2">
							<img
								src={displayLogo}
								alt="Full logo preview"
								class="max-h-full max-w-full object-contain"
							/>
						</div>
						<button
							type="button"
							class="btn btn-circle btn-error btn-xs absolute -right-2 -top-2"
							onclick={removeLogo}
							title="Remove logo"
						>
							<X class="h-3 w-3" />
						</button>
						{#if logoPreview}
							<span class="badge badge-warning badge-sm absolute -bottom-2 left-1/2 -translate-x-1/2">
								Unsaved
							</span>
						{/if}
					</div>
				{:else}
					<div class="flex h-16 w-48 items-center justify-center rounded-xl border-2 border-dashed border-base-300 bg-base-200">
						<Image class="h-8 w-8 text-base-content/30" />
					</div>
				{/if}
			</div>

			<!-- Upload Area -->
			<div class="flex-1">
				<div
					class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors
						{isDragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}"
					role="button"
					tabindex="0"
					ondrop={handleDrop}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					onclick={() => fileInput?.click()}
					onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
				>
					<input
						bind:this={fileInput}
						type="file"
						accept="image/*"
						class="hidden"
						onchange={handleFileSelect}
					/>
					<Upload class="mx-auto h-6 w-6 text-base-content/40" />
					<p class="mt-1 text-sm font-medium">
						{isDragging ? 'Drop here' : 'Click or drag to upload'}
					</p>
					<p class="mt-1 text-xs text-base-content/60">
						Horizontal logo (e.g., 400x100px). PNG, JPG, SVG up to 2MB
					</p>
				</div>

				<!-- Or enter URL -->
				<div class="mt-3">
					<FormField label="Or enter URL">
						<input
							type="url"
							class="input input-bordered input-sm w-full"
							placeholder="https://example.com/logo.png"
							bind:value={brandingData.logoUrl}
						/>
					</FormField>
				</div>
			</div>
		</div>

		<!-- Used in indicator -->
		<div class="mt-4 flex items-start gap-2 text-xs text-base-content/60">
			<span class="font-medium">Used in:</span>
			<span>Documents, email headers, PDF exports</span>
		</div>
	</SettingsSection>

	<!-- Brand Colors -->
	<SettingsSection
		title="Brand Colors"
		description="Colors used across your organisation's documents and UI"
		icon={Palette}
	>
		<div class="grid gap-6 sm:grid-cols-3">
			<!-- Primary Color -->
			<div>
				<FormField label="Primary Color" hint="Main brand color">
					<div class="flex items-center gap-3">
						<input
							type="color"
							class="h-10 w-14 cursor-pointer rounded-lg border border-base-300"
							bind:value={brandingData.primaryColor}
						/>
						<input
							type="text"
							class="input input-bordered flex-1 font-mono text-sm uppercase"
							placeholder="#3b82f6"
							bind:value={brandingData.primaryColor}
							pattern="^#[0-9A-Fa-f]{6}$"
						/>
					</div>
				</FormField>
				<p class="mt-1 text-xs text-base-content/50">Used in: Email headers, buttons, links</p>
			</div>

			<!-- Secondary Color -->
			<div>
				<FormField label="Secondary Color" hint="Light background color">
					<div class="flex items-center gap-3">
						<input
							type="color"
							class="h-10 w-14 cursor-pointer rounded-lg border border-base-300"
							bind:value={brandingData.secondaryColor}
						/>
						<input
							type="text"
							class="input input-bordered flex-1 font-mono text-sm uppercase"
							placeholder="#1e40af"
							bind:value={brandingData.secondaryColor}
							pattern="^#[0-9A-Fa-f]{6}$"
						/>
					</div>
				</FormField>
				<p class="mt-1 text-xs text-base-content/50">Used in: Document backgrounds</p>
			</div>

			<!-- Accent Color -->
			<div>
				<FormField label="Accent Color" hint="Highlight color">
					<div class="flex items-center gap-3">
						<input
							type="color"
							class="h-10 w-14 cursor-pointer rounded-lg border border-base-300"
							bind:value={brandingData.accentColor}
						/>
						<input
							type="text"
							class="input input-bordered flex-1 font-mono text-sm uppercase"
							placeholder="#f59e0b"
							bind:value={brandingData.accentColor}
							pattern="^#[0-9A-Fa-f]{6}$"
						/>
					</div>
				</FormField>
				<p class="mt-1 text-xs text-base-content/50">Used in: Borders, section highlights</p>
			</div>
		</div>

		<!-- Accent Gradient (Optional) -->
		<div class="mt-6 pt-6 border-t border-base-300">
			<FormField label="Accent Gradient (Optional)" hint="CSS gradient for premium elements">
				<textarea
					class="textarea textarea-bordered w-full font-mono text-sm"
					rows="2"
					placeholder="linear-gradient(180deg, rgba(247, 1, 120, 1) 0%, rgba(160, 8, 156, 1) 51%, rgba(99, 13, 178, 1) 100%)"
					bind:value={brandingData.accentGradient}
				></textarea>
			</FormField>
			<p class="mt-1 text-xs text-base-content/60">
				Tip: Use CSS gradient syntax. Leave empty to use the solid accent color.
			</p>
		</div>

		<!-- Color Preview -->
		<div class="mt-6 rounded-lg border border-base-300 p-4">
			<p class="mb-3 text-sm font-medium text-base-content/70">Preview</p>
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<div
						class="h-10 w-10 rounded-lg shadow-sm"
						style="background-color: {brandingData.primaryColor}"
					></div>
					<span class="text-sm">Primary</span>
				</div>
				<div class="flex items-center gap-2">
					<div
						class="h-10 w-10 rounded-lg shadow-sm"
						style="background-color: {brandingData.secondaryColor}"
					></div>
					<span class="text-sm">Secondary</span>
				</div>
				<div class="flex items-center gap-2">
					<div
						class="h-10 w-10 rounded-lg shadow-sm"
						style="background-color: {brandingData.accentColor}"
					></div>
					<span class="text-sm">Accent</span>
				</div>
				{#if brandingData.accentGradient}
					<div class="flex items-center gap-2">
						<div
							class="h-10 w-10 rounded-lg shadow-sm"
							style="background: {brandingData.accentGradient}"
						></div>
						<span class="text-sm">Gradient</span>
					</div>
				{/if}
			</div>

			<!-- Sample CTA with gradient -->
			<div class="mt-4 flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2 rounded-lg px-4 py-2" style="background-color: {brandingData.primaryColor}">
					<span class="font-medium text-white">Primary Button</span>
				</div>
				<div class="flex items-center gap-2 rounded-lg px-4 py-2" style="background: {accentBackground}">
					<span class="font-medium text-white">Accent Button</span>
				</div>
			</div>
		</div>
	</SettingsSection>

	<!-- Save Branding Button -->
	<div class="flex justify-end gap-3">
		{#if brandingHasChanges}
			<span class="badge badge-warning self-center">Unsaved changes</span>
		{/if}
		<button
			type="button"
			class="btn btn-primary"
			onclick={handleSaveBranding}
			disabled={isSavingBranding || !brandingHasChanges}
		>
			{#if isSavingBranding}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<Check class="h-4 w-4" />
			{/if}
			Save Logo & Colors
		</button>
	</div>
</div>
