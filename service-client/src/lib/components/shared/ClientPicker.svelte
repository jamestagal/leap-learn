<script lang="ts">
	/**
	 * ClientPicker - Reusable client autocomplete component
	 *
	 * Use in creation forms to search and select existing clients,
	 * or allow manual entry of new client information.
	 */

	import { searchClients } from "$lib/api/clients.remote";
	import { Search, X, Building2, Mail, User } from "lucide-svelte";

	// Client type matching what searchClients returns
	type Client = {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	};

	interface Props {
		// Selected client (null = no selection)
		selected: Client | null;
		// Callback when client is selected or cleared
		onSelect: (client: Client | null) => void;
		// Placeholder text for search input
		placeholder?: string;
		// Label text above the picker
		label?: string;
		// Whether the field is disabled
		disabled?: boolean;
		// Show manual entry fields when no selection
		showManualEntry?: boolean;
		// Manual entry field values (for two-way binding)
		manualBusinessName?: string;
		manualEmail?: string;
		manualContactName?: string;
		manualPhone?: string;
		// Callbacks for manual entry changes
		onManualBusinessNameChange?: (value: string) => void;
		onManualEmailChange?: (value: string) => void;
		onManualContactNameChange?: (value: string) => void;
		onManualPhoneChange?: (value: string) => void;
	}

	let {
		selected = null,
		onSelect,
		placeholder = "Search clients by name or email...",
		label = "Client",
		disabled = false,
		showManualEntry = false,
		manualBusinessName = "",
		manualEmail = "",
		manualContactName = "",
		manualPhone = "",
		onManualBusinessNameChange,
		onManualEmailChange,
		onManualContactNameChange,
		onManualPhoneChange,
	}: Props = $props();

	// Local state
	let searchQuery = $state("");
	let searchResults = $state<Client[]>([]);
	let isSearching = $state(false);
	let showDropdown = $state(false);
	let searchCompleted = $state(false);

	// Debounce timer
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Handle search input
	async function handleSearch() {
		if (searchQuery.length < 2) {
			searchResults = [];
			showDropdown = false;
			searchCompleted = false;
			return;
		}

		// Debounce search
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			isSearching = true;
			searchCompleted = false;
			try {
				const results = await searchClients({ query: searchQuery, limit: 8 });
				searchResults = results.map((r) => ({
					id: r.id,
					businessName: r.businessName,
					email: r.email,
					contactName: r.contactName ?? null,
					phone: r.phone ?? null,
				}));
				showDropdown = true;
				searchCompleted = true;
			} catch (err) {
				console.error("Client search error:", err);
				searchResults = [];
				searchCompleted = true;
			} finally {
				isSearching = false;
			}
		}, 200);
	}

	function selectClient(client: Client) {
		// Handle legacy clients (from questionnaire_responses)
		const isLegacyClient = client.id.startsWith("legacy-");
		if (isLegacyClient) {
			// For legacy clients, populate manual entry fields instead
			onSelect(null);
			onManualBusinessNameChange?.(client.businessName);
			onManualEmailChange?.(client.email);
			onManualContactNameChange?.(client.contactName || "");
			onManualPhoneChange?.(client.phone || "");
		} else {
			onSelect(client);
		}
		searchQuery = "";
		showDropdown = false;
	}

	function clearSelection() {
		onSelect(null);
		searchQuery = "";
	}

	function handleBlur() {
		// Delay to allow click events to fire
		setTimeout(() => {
			showDropdown = false;
		}, 200);
	}
</script>

<div class="form-control w-full">
	{#if label}
		<label class="label" for="client-picker-search">
			<span class="label-text">{label}</span>
		</label>
	{/if}

	{#if selected}
		<!-- Selected Client Display -->
		<div class="flex items-center gap-3 p-3 bg-success/10 border border-success/30 rounded-lg">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20 shrink-0">
				<Building2 class="h-5 w-5 text-success" />
			</div>
			<div class="flex-1 min-w-0">
				<div class="font-medium truncate">{selected.businessName}</div>
				<div class="text-sm text-base-content/60 truncate">{selected.email}</div>
			</div>
			{#if !disabled}
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-square"
					onclick={clearSelection}
					title="Clear selection"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	{:else}
		<!-- Search Input -->
		<div class="relative">
			<input
				id="client-picker-search"
				type="text"
				class="input input-bordered w-full pr-10"
				{placeholder}
				bind:value={searchQuery}
				oninput={handleSearch}
				onfocus={() => searchQuery.length >= 2 && (showDropdown = true)}
				onblur={handleBlur}
				{disabled}
			/>
			{#if isSearching}
				<span
					class="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2"
				></span>
			{:else}
				<Search class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
			{/if}

			<!-- Dropdown Results -->
			{#if showDropdown}
				<div
					class="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-box shadow-lg max-h-64 overflow-auto"
				>
					{#if searchResults.length > 0}
						{#each searchResults as client (client.id)}
							<button
								type="button"
								class="w-full p-3 text-left hover:bg-base-200 flex items-center gap-3 border-b border-base-200 last:border-0"
								onclick={() => selectClient(client)}
							>
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-base-200 shrink-0">
									<Building2 class="h-4 w-4" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{client.businessName}</div>
									<div class="text-sm text-base-content/60 truncate">{client.email}</div>
								</div>
								{#if client.id.startsWith("legacy-")}
									<span class="badge badge-ghost badge-xs">Legacy</span>
								{/if}
							</button>
						{/each}
					{:else if searchCompleted && !isSearching}
						<div class="p-3 text-center text-sm text-base-content/60">
							No clients found matching "{searchQuery}"
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Manual Entry Fields -->
		{#if showManualEntry}
			<div class="divider text-xs my-3">OR ENTER MANUALLY</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="form-control sm:col-span-2">
					<label class="label py-1" for="manual-business-name">
						<span class="label-text text-sm">Business Name *</span>
					</label>
					<div class="join w-full">
						<span class="join-item flex items-center justify-center bg-base-200 px-3">
							<Building2 class="h-4 w-4" />
						</span>
						<input
							id="manual-business-name"
							type="text"
							class="input input-bordered input-sm join-item flex-1"
							placeholder="Client's Business Name"
							value={manualBusinessName}
							oninput={(e) => onManualBusinessNameChange?.(e.currentTarget.value)}
							{disabled}
						/>
					</div>
				</div>
				<div class="form-control sm:col-span-2">
					<label class="label py-1" for="manual-email">
						<span class="label-text text-sm">Email *</span>
					</label>
					<div class="join w-full">
						<span class="join-item flex items-center justify-center bg-base-200 px-3">
							<Mail class="h-4 w-4" />
						</span>
						<input
							id="manual-email"
							type="email"
							class="input input-bordered input-sm join-item flex-1"
							placeholder="client@example.com"
							value={manualEmail}
							oninput={(e) => onManualEmailChange?.(e.currentTarget.value)}
							{disabled}
						/>
					</div>
				</div>
				<div class="form-control">
					<label class="label py-1" for="manual-contact-name">
						<span class="label-text text-sm">Contact Name</span>
					</label>
					<div class="join w-full">
						<span class="join-item flex items-center justify-center bg-base-200 px-3">
							<User class="h-4 w-4" />
						</span>
						<input
							id="manual-contact-name"
							type="text"
							class="input input-bordered input-sm join-item flex-1"
							placeholder="John Smith"
							value={manualContactName}
							oninput={(e) => onManualContactNameChange?.(e.currentTarget.value)}
							{disabled}
						/>
					</div>
				</div>
				<div class="form-control">
					<label class="label py-1" for="manual-phone">
						<span class="label-text text-sm">Phone</span>
					</label>
					<input
						id="manual-phone"
						type="tel"
						class="input input-bordered input-sm w-full"
						placeholder="+61 400 000 000"
						value={manualPhone}
						oninput={(e) => onManualPhoneChange?.(e.currentTarget.value)}
						{disabled}
					/>
				</div>
			</div>
		{/if}
	{/if}
</div>
