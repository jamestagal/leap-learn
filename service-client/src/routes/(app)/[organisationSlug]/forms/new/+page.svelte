<script lang="ts">
	import { goto } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { createSubmissionForClient, createSubmissionFromTemplate } from "$lib/api/forms.remote";
	import { searchClients, getOrCreateClient } from "$lib/api/clients.remote";
	import {
		ChevronLeft,
		Plus,
		Building2,
		Mail,
		User,
		Search,
		Check,
		ClipboardList,
		MessageSquare,
		ThumbsUp,
		UserPlus,
		Settings2,
		Link,
		Copy,
		ExternalLink,
		ListOrdered,
	} from "lucide-svelte";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);

	// Step state
	let currentStep = $state<"client" | "form" | "success">("client");

	// Client form state
	let businessName = $state("");
	let email = $state("");
	let contactName = $state("");
	let selectedClientId = $state<string | null>(null);

	// Client search
	let clientSearch = $state("");
	let searchResults = $state<typeof data.clients>([]);
	let isSearching = $state(false);
	let showSearchResults = $state(false);

	// Form selection - supports 3 types: new (create from scratch), custom (organisation form), system (template)
	let selectionType = $state<"new" | "custom" | "system" | null>(null);
	let selectedFormId = $state<string | null>(null); // for custom organisation forms
	let selectedTemplateId = $state<string | null>(null); // for system templates

	// Helper to check if any selection is made
	let hasSelection = $derived(selectionType !== null);

	// Helper to get step count from schema
	function getStepCount(schema: unknown): number {
		if (!schema) return 0;
		try {
			const parsed = typeof schema === "string" ? JSON.parse(schema) : schema;
			if (parsed && Array.isArray(parsed.steps)) return parsed.steps.length;
			return 0;
		} catch {
			return 0;
		}
	}

	// Success state
	let createdSubmission = $state<{
		id: string;
		slug: string;
	} | null>(null);

	// Loading state
	let isCreating = $state(false);

	// Form type icons
	const formTypeIcons: Record<string, typeof ClipboardList> = {
		questionnaire: ClipboardList,
		consultation: MessageSquare,
		feedback: ThumbsUp,
		intake: UserPlus,
		custom: Settings2,
	};

	function getFormTypeIcon(type: string) {
		return formTypeIcons[type] || Settings2;
	}

	// Track if search has completed (for showing "no results" message)
	let searchCompleted = $state(false);

	// Client search handler
	async function handleClientSearch() {
		if (clientSearch.length < 2) {
			searchResults = [];
			showSearchResults = false;
			searchCompleted = false;
			return;
		}

		isSearching = true;
		searchCompleted = false;
		try {
			searchResults = await searchClients({ query: clientSearch, limit: 5 });
			showSearchResults = true;
			searchCompleted = true;
		} catch (err) {
			console.error("Client search error:", err);
			searchResults = [];
			searchCompleted = true;
			toast.error("Search failed", err instanceof Error ? err.message : "");
		} finally {
			isSearching = false;
		}
	}

	function selectClient(client: (typeof data.clients)[0]) {
		// Check if this is a legacy client (from questionnaire_responses, not clients table)
		const isLegacyClient = client.id.startsWith("legacy-");

		// For legacy clients, don't set selectedClientId - they'll be created as new clients
		// For real clients, set the ID to link the submission
		selectedClientId = isLegacyClient ? null : client.id;
		businessName = client.businessName;
		email = client.email;
		contactName = client.contactName || "";
		clientSearch = "";
		showSearchResults = false;
	}

	function clearClientSelection() {
		selectedClientId = null;
		businessName = "";
		email = "";
		contactName = "";
	}

	// Validation
	let isClientValid = $derived(businessName.trim().length > 0 && email.includes("@"));

	// Continue to form selection
	function continueToForm() {
		if (isClientValid) {
			currentStep = "form";
		}
	}

	// Create submission based on selection type
	async function createForm() {
		if (!hasSelection || !isClientValid) return;

		// Handle "Create New" - redirect to form builder with client context
		if (selectionType === "new") {
			// Get or create client first
			let clientId = selectedClientId;
			if (!clientId) {
				isCreating = true;
				try {
					const result = await getOrCreateClient({
						businessName,
						email,
						contactName: contactName || null,
					});
					if (!result?.client) {
						throw new Error("Failed to create client");
					}
					clientId = result.client.id;
				} catch (err) {
					toast.error("Failed to create client", err instanceof Error ? err.message : "");
					isCreating = false;
					return;
				}
				isCreating = false;
			}
			// Redirect to form builder with client context
			const params = new URLSearchParams({
				clientId: clientId,
				clientName: businessName,
				clientEmail: email,
			});
			goto(`/${organisationSlug}/settings/forms/new?${params.toString()}`);
			return;
		}

		isCreating = true;
		try {
			// Get or create client if needed
			let clientId = selectedClientId;
			if (!clientId) {
				const result = await getOrCreateClient({
					businessName,
					email,
					contactName: contactName || null,
				});
				if (!result?.client) {
					throw new Error("Failed to create client");
				}
				clientId = result.client.id;
			}

			let submission;

			if (selectionType === "custom" && selectedFormId) {
				// Create from custom organisation form
				submission = await createSubmissionForClient({
					formId: selectedFormId,
					clientId,
					clientBusinessName: businessName,
					clientEmail: email,
				});
			} else if (selectionType === "system" && selectedTemplateId) {
				// Create from system template
				submission = await createSubmissionFromTemplate({
					templateId: selectedTemplateId,
					clientId,
					clientBusinessName: businessName,
					clientEmail: email,
				});
			}

			if (!submission) {
				throw new Error("Failed to create submission");
			}

			createdSubmission = {
				id: submission.id,
				slug: submission.slug || "",
			};
			currentStep = "success";
		} catch (err) {
			toast.error("Failed to create form", err instanceof Error ? err.message : "");
		} finally {
			isCreating = false;
		}
	}

	function getFormUrl() {
		if (!createdSubmission?.slug) return "";
		return `${window.location.origin}/f/${createdSubmission.slug}`;
	}

	function copyLink() {
		navigator.clipboard.writeText(getFormUrl());
		toast.success("Link copied to clipboard");
	}

	function createAnother() {
		// Reset state
		currentStep = "client";
		businessName = "";
		email = "";
		contactName = "";
		selectedClientId = null;
		selectionType = null;
		selectedFormId = null;
		selectedTemplateId = null;
		createdSubmission = null;
	}

	// Helper to build mailto URL
	function getMailtoUrl() {
		const formUrl = getFormUrl();
		const subject = encodeURIComponent(`${data.organisation.name} - Please complete this form`);
		const body = encodeURIComponent(
			`Hi${contactName ? ` ${contactName}` : ""},\n\nPlease complete this form at your earliest convenience:\n${formUrl}\n\nThank you!`
		);
		return `mailto:${email}?subject=${subject}&body=${body}`;
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a href="/{organisationSlug}/forms" class="btn btn-ghost btn-sm btn-square" title="Back to Forms">
			<ChevronLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-xl font-bold">Create Form</h1>
			<p class="text-sm text-base-content/70">
				{#if currentStep === "client"}
					Link to a client
				{:else if currentStep === "form"}
					Choose a template
				{:else}
					Form created successfully
				{/if}
			</p>
		</div>
	</div>

	<!-- Progress Steps -->
	<ul class="steps w-full">
		<li class="step" class:step-primary={currentStep !== "success"}>Client</li>
		<li class="step" class:step-primary={currentStep === "form" || currentStep === "success"}>
			Form
		</li>
		<li class="step" class:step-primary={currentStep === "success"}>Done</li>
	</ul>

	<!-- Step 1: Client Details -->
	{#if currentStep === "client"}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base">Client Information</h2>

				<!-- Client Search -->
				<div class="form-control">
					<label class="label" for="client-search">
						<span class="label-text">Search Existing Clients</span>
					</label>
					<div class="relative">
						<input
							id="client-search"
							type="text"
							class="input input-bordered w-full pr-10"
							placeholder="Search by name or email..."
							bind:value={clientSearch}
							oninput={handleClientSearch}
							onfocus={() => clientSearch.length >= 2 && (showSearchResults = true)}
							onblur={() => setTimeout(() => (showSearchResults = false), 200)}
						/>
						{#if isSearching}
							<span
								class="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2"
							></span>
						{:else}
							<Search
								class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40"
							/>
						{/if}
					</div>
					{#if showSearchResults}
						<div
							class="absolute z-10 mt-1 w-full bg-base-100 border border-base-300 rounded-box shadow-lg max-h-48 overflow-auto"
						>
							{#if searchResults.length > 0}
								{#each searchResults as client (client.id)}
									<button
										type="button"
										class="w-full p-3 text-left hover:bg-base-200 flex items-center gap-3 border-b border-base-200 last:border-0"
										onclick={() => selectClient(client)}
									>
										<div class="flex-1">
											<div class="font-medium">{client.businessName}</div>
											<div class="text-sm text-base-content/60">{client.email}</div>
										</div>
										{#if selectedClientId === client.id}
											<Check class="h-4 w-4 text-success" />
										{/if}
									</button>
								{/each}
							{:else if searchCompleted && !isSearching}
								<div class="p-3 text-center text-sm text-base-content/60">
									No clients found matching "{clientSearch}"
								</div>
							{/if}
						</div>
					{/if}
				</div>

				{#if selectedClientId}
					<div class="alert alert-success">
						<Check class="h-4 w-4" />
						<span>Using existing client: {businessName}</span>
						<button type="button" class="btn btn-ghost btn-xs" onclick={clearClientSelection}>
							Change
						</button>
					</div>
				{/if}

				<div class="divider text-xs">OR ENTER NEW CLIENT</div>

				<!-- Manual Entry -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="form-control sm:col-span-2">
						<label class="label" for="business-name">
							<span class="label-text flex items-center gap-2">
								<Building2 class="h-4 w-4 text-base-content/50" />
								Business Name *
							</span>
						</label>
						<input
							id="business-name"
							type="text"
							class="input input-bordered w-full"
							placeholder="Client's Business Name"
							bind:value={businessName}
							disabled={!!selectedClientId}
						/>
					</div>
					<div class="form-control sm:col-span-2">
						<label class="label" for="email">
							<span class="label-text flex items-center gap-2">
								<Mail class="h-4 w-4 text-base-content/50" />
								Email Address *
							</span>
						</label>
						<input
							id="email"
							type="email"
							class="input input-bordered w-full"
							placeholder="client@example.com"
							bind:value={email}
							disabled={!!selectedClientId}
						/>
					</div>
					<div class="form-control sm:col-span-2">
						<label class="label" for="contact-name">
							<span class="label-text flex items-center gap-2">
								<User class="h-4 w-4 text-base-content/50" />
								Contact Name (Optional)
							</span>
						</label>
						<input
							id="contact-name"
							type="text"
							class="input input-bordered w-full"
							placeholder="John Smith"
							bind:value={contactName}
							disabled={!!selectedClientId}
						/>
					</div>
				</div>

				<div class="card-actions justify-end mt-4">
					<a href="/{organisationSlug}/forms" class="btn btn-ghost">Cancel</a>
					<button type="button" class="btn btn-primary" disabled={!isClientValid} onclick={continueToForm}>
						Continue
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Step 2: Form Selection -->
	{#if currentStep === "form"}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<h2 class="card-title text-base">Choose a Template</h2>
					<div class="text-sm text-base-content/60">
						For: <span class="font-medium">{businessName}</span>
					</div>
				</div>

				<div class="space-y-6 mt-2">
					<!-- Create New Option -->
					<div>
						<button
							type="button"
							class="w-full p-4 rounded-lg border-2 text-left transition-colors
								{selectionType === 'new'
								? 'border-primary bg-primary/5'
								: 'border-base-300 hover:border-base-400 border-dashed'}"
							onclick={() => {
								selectionType = "new";
								selectedFormId = null;
								selectedTemplateId = null;
							}}
						>
							<div class="flex items-start gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"
								>
									<Plus class="h-5 w-5" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium">Start from Scratch</span>
										{#if selectionType === "new"}
											<Check class="h-4 w-4 text-primary" />
										{/if}
									</div>
									<p class="text-sm text-base-content/60 mt-0.5">
										Create a custom form specifically for this client
									</p>
								</div>
							</div>
						</button>
					</div>

					<!-- Your Templates (Custom Organisation Forms) -->
					{#if data.customForms && data.customForms.length > 0}
						<div>
							<h3 class="text-sm font-medium text-base-content/70 mb-2">Your Templates</h3>
							<div class="grid gap-2">
								{#each data.customForms as form (form.id)}
									{@const Icon = getFormTypeIcon(form.formType)}
									{@const stepCount = getStepCount(form.schema)}
									<button
										type="button"
										class="w-full p-4 rounded-lg border-2 text-left transition-colors
											{selectionType === 'custom' && selectedFormId === form.id
											? 'border-primary bg-primary/5'
											: 'border-base-300 hover:border-base-400'}"
										onclick={() => {
											selectionType = "custom";
											selectedFormId = form.id;
											selectedTemplateId = null;
										}}
									>
										<div class="flex items-start gap-3">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-lg bg-base-200 shrink-0"
											>
												<Icon class="h-5 w-5" />
											</div>
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 flex-wrap">
													<span class="font-medium">{form.name}</span>
													{#if stepCount > 0}
														<span class="badge badge-ghost badge-sm gap-1">
															<ListOrdered class="h-3 w-3" />
															{stepCount} {stepCount === 1 ? "step" : "steps"}
														</span>
													{/if}
													{#if selectionType === "custom" && selectedFormId === form.id}
														<Check class="h-4 w-4 text-primary" />
													{/if}
												</div>
												<p class="text-sm text-base-content/60 line-clamp-2 mt-0.5">
													{form.description || "No description"}
												</p>
											</div>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- System Templates -->
					{#if data.templates && data.templates.length > 0}
						<div>
							<h3 class="text-sm font-medium text-base-content/70 mb-2">System Templates</h3>
							<div class="grid gap-2">
								{#each data.templates as template (template.id)}
									{@const Icon = getFormTypeIcon(template.category)}
									{@const stepCount = getStepCount(template.schema)}
									<button
										type="button"
										class="w-full p-4 rounded-lg border-2 text-left transition-colors
											{selectionType === 'system' && selectedTemplateId === template.id
											? 'border-primary bg-primary/5'
											: 'border-base-300 hover:border-base-400'}"
										onclick={() => {
											selectionType = "system";
											selectedTemplateId = template.id;
											selectedFormId = null;
										}}
									>
										<div class="flex items-start gap-3">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-lg bg-base-200 shrink-0"
											>
												<Icon class="h-5 w-5" />
											</div>
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 flex-wrap">
													<span class="font-medium">{template.name}</span>
													<span class="badge badge-ghost badge-sm text-base-content/50">System</span>
													{#if stepCount > 0}
														<span class="badge badge-ghost badge-sm gap-1">
															<ListOrdered class="h-3 w-3" />
															{stepCount} {stepCount === 1 ? "step" : "steps"}
														</span>
													{/if}
													{#if selectionType === "system" && selectedTemplateId === template.id}
														<Check class="h-4 w-4 text-primary" />
													{/if}
												</div>
												<p class="text-sm text-base-content/60 line-clamp-2 mt-0.5">
													{template.description || "No description"}
												</p>
											</div>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Empty state if no templates at all -->
					{#if (!data.customForms || data.customForms.length === 0) && (!data.templates || data.templates.length === 0)}
						<div class="alert alert-info">
							<span>
								No templates available yet. You can still create a form from scratch, or
								<a href="/{organisationSlug}/settings/forms" class="link">manage templates</a> first.
							</span>
						</div>
					{/if}
				</div>

				<div class="card-actions justify-between mt-4">
					<button type="button" class="btn btn-ghost" onclick={() => (currentStep = "client")}>
						Back
					</button>
					<button
						type="button"
						class="btn btn-primary"
						disabled={!hasSelection || isCreating}
						onclick={createForm}
					>
						{#if isCreating}
							<span class="loading loading-spinner loading-sm"></span>
							{selectionType === "new" ? "Redirecting..." : "Creating..."}
						{:else}
							{selectionType === "new" ? "Continue to Builder" : "Create Form"}
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Step 3: Success -->
	{#if currentStep === "success" && createdSubmission}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success mb-2"
				>
					<Check class="h-8 w-8" />
				</div>
				<h2 class="text-xl font-bold">Form Created!</h2>
				<p class="text-base-content/70">
					Share this link with <span class="font-medium">{businessName}</span> to collect their
					responses.
				</p>

				<div class="w-full mt-4">
					<div class="form-control">
						<label class="label" for="form-link">
							<span class="label-text">Form Link</span>
						</label>
						<div class="join w-full">
							<input
								id="form-link"
								type="text"
								class="input input-bordered join-item flex-1 font-mono text-sm"
								value={getFormUrl()}
								readonly
							/>
							<button type="button" class="btn join-item" onclick={copyLink}>
								<Copy class="h-4 w-4" />
								Copy
							</button>
						</div>
					</div>
				</div>

				<!-- Primary actions: Send Now / Copy Link -->
				<div class="flex flex-wrap gap-3 mt-6 w-full justify-center">
					<a href={getMailtoUrl()} class="btn btn-primary">
						<Mail class="h-4 w-4" />
						Send Now
					</a>
					<button type="button" class="btn btn-outline" onclick={copyLink}>
						<Copy class="h-4 w-4" />
						Copy Link
					</button>
				</div>

				<div class="divider text-xs text-base-content/50">OR</div>

				<!-- Secondary actions -->
				<div class="flex flex-wrap gap-3 justify-center">
					<a
						href="/f/{createdSubmission.slug}"
						target="_blank"
						rel="noopener"
						class="btn btn-ghost btn-sm"
					>
						<ExternalLink class="h-4 w-4" />
						Preview Form
					</a>
					<a href="/{organisationSlug}/forms/{createdSubmission.id}" class="btn btn-ghost btn-sm">
						View Details
					</a>
					<button type="button" class="btn btn-ghost btn-sm" onclick={createAnother}>
						Create Another
					</button>
				</div>

				<div class="divider"></div>

				<a href="/{organisationSlug}/forms" class="btn btn-ghost">
					<Link class="h-4 w-4" />
					Back to Forms
				</a>
			</div>
		</div>
	{/if}
</div>
