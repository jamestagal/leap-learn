<script lang="ts">
	import { Search, ChevronLeft, ChevronRight, ScrollText, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { getSystemAuditLogs, getOrganisations } from '$lib/api/super-admin.remote';
	import { formatDateTime } from '$lib/utils/formatting';
	import { onMount } from 'svelte';

	interface AuditLog {
		id: string;
		createdAt: Date;
		action: string;
		entityType: string;
		entityId: string | null;
		oldValues: unknown;
		newValues: unknown;
		ipAddress: string | null;
		organisationId: string;
		userId: string | null;
		organisationName: string | null;
		userEmail: string | null;
	}

	interface Organisation {
		id: string;
		name: string;
		slug: string;
	}

	let logs = $state<AuditLog[]>([]);
	let organisations = $state<Organisation[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let organisationFilter = $state('');
	let actionFilter = $state('');
	let currentPage = $state(1);
	const pageSize = 25;

	// Expanded rows
	let expandedRows = $state<Set<string>>(new Set());

	let searchDebounce: ReturnType<typeof setTimeout>;

	async function loadOrganisations() {
		try {
			const result = await getOrganisations({ limit: 100 });
			organisations = result.organisations;
		} catch (e) {
			console.error('Failed to load organisations for filter:', e);
		}
	}

	async function loadLogs() {
		loading = true;
		error = null;
		try {
			const result = await getSystemAuditLogs({
				organisationId: organisationFilter || undefined,
				action: actionFilter || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			logs = result.logs;
			total = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load audit logs';
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		await loadOrganisations();
		await loadLogs();
	});

	function handleFilterChange() {
		currentPage = 1;
		loadLogs();
	}

	function handleActionInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadLogs();
		}, 300);
	}

	function formatDate(date: Date | string): string {
		return formatDateTime(date);
	}

	function formatShortDate(date: Date | string): string {
		return formatDateTime(date);
	}

	function toggleExpanded(id: string) {
		if (expandedRows.has(id)) {
			expandedRows.delete(id);
		} else {
			expandedRows.add(id);
		}
		expandedRows = new Set(expandedRows);
	}

	function formatJson(value: unknown): string {
		if (!value) return '-';
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	function getActionBadgeClass(action: string): string {
		if (action.includes('create') || action.includes('add')) return 'badge-success';
		if (action.includes('delete') || action.includes('remove')) return 'badge-error';
		if (action.includes('update') || action.includes('edit')) return 'badge-warning';
		return 'badge-ghost';
	}

	let totalPages = $derived(Math.ceil(total / pageSize));
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Audit Log</h1>
		<p class="text-base-content/70">System-wide activity log across all organisations</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 space-y-3">
		<select
			class="select select-bordered w-full"
			bind:value={organisationFilter}
			onchange={handleFilterChange}
		>
			<option value="">All Organisations</option>
			{#each organisations as organisation (organisation.id)}
				<option value={organisation.id}>{organisation.name}</option>
			{/each}
		</select>

		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
			<input
				type="text"
				placeholder="Filter by action..."
				class="input input-bordered w-full pl-10"
				bind:value={actionFilter}
				oninput={handleActionInput}
			/>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if logs.length === 0}
		<div class="text-center py-12">
			<ScrollText class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No audit logs found</h3>
			<p class="text-base-content/60">Try adjusting your filters</p>
		</div>
	{:else}
		<!-- Mobile: Card Layout -->
		<div class="space-y-3 lg:hidden">
			{#each logs as log (log.id)}
				<div class="rounded-lg border border-base-300 overflow-hidden">
					<button
						class="w-full text-left p-4 hover:bg-base-200/50 transition-colors"
						onclick={() => toggleExpanded(log.id)}
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<span class="badge {getActionBadgeClass(log.action)} badge-sm">
									{log.action}
								</span>
								<p class="text-sm text-base-content/60 mt-1 truncate">
									{log.entityType}
									{#if log.entityId}
										<span class="text-xs">({log.entityId.slice(0, 8)}...)</span>
									{/if}
								</p>
							</div>
							<div class="flex items-center gap-2 shrink-0">
								{#if expandedRows.has(log.id)}
									<ChevronUp class="h-4 w-4 text-base-content/40" />
								{:else}
									<ChevronDown class="h-4 w-4 text-base-content/40" />
								{/if}
							</div>
						</div>
						<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/60">
							<span>{formatShortDate(log.createdAt)}</span>
							{#if log.organisationName}
								<span class="truncate max-w-[120px]">{log.organisationName}</span>
							{/if}
							{#if log.userEmail}
								<span class="truncate max-w-[120px]">{log.userEmail}</span>
							{:else}
								<span>System</span>
							{/if}
						</div>
					</button>

					{#if expandedRows.has(log.id)}
						<div class="border-t border-base-300 bg-base-200/30 p-4 space-y-3">
							<div>
								<p class="text-xs font-medium text-base-content/60 mb-1">Old Values</p>
								<pre class="text-xs bg-base-300 p-2 rounded overflow-auto max-h-32">{formatJson(log.oldValues)}</pre>
							</div>
							<div>
								<p class="text-xs font-medium text-base-content/60 mb-1">New Values</p>
								<pre class="text-xs bg-base-300 p-2 rounded overflow-auto max-h-32">{formatJson(log.newValues)}</pre>
							</div>
							{#if log.ipAddress}
								<p class="text-xs text-base-content/50">
									IP: {log.ipAddress}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Desktop: Table Layout -->
		<div class="hidden lg:block overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead class="bg-base-200">
					<tr>
						<th class="w-8"></th>
						<th>Time</th>
						<th>Organisation</th>
						<th>User</th>
						<th>Action</th>
						<th>Entity</th>
					</tr>
				</thead>
				<tbody>
					{#each logs as log (log.id)}
						<tr class="hover:bg-base-200/50">
							<td>
								<button
									class="btn btn-ghost btn-xs btn-circle"
									onclick={() => toggleExpanded(log.id)}
								>
									{#if expandedRows.has(log.id)}
										<ChevronUp class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</button>
							</td>
							<td class="text-sm whitespace-nowrap">{formatDate(log.createdAt)}</td>
							<td>
								{#if log.organisationName}
									<a
										href="/super-admin/organisations/{log.organisationId}"
										class="link link-hover text-sm"
									>
										{log.organisationName}
									</a>
								{:else}
									<span class="text-base-content/40">-</span>
								{/if}
							</td>
							<td class="text-sm">{log.userEmail || 'System'}</td>
							<td>
								<span class="badge {getActionBadgeClass(log.action)} badge-sm">
									{log.action}
								</span>
							</td>
							<td class="text-sm text-base-content/60">
								{log.entityType}
								{#if log.entityId}
									<span class="text-xs">({log.entityId.slice(0, 8)}...)</span>
								{/if}
							</td>
						</tr>
						{#if expandedRows.has(log.id)}
							<tr class="bg-base-200/30">
								<td colspan="6" class="p-4">
									<div class="grid gap-4 md:grid-cols-2">
										<div>
											<p class="text-sm font-medium text-base-content/60 mb-1">Old Values</p>
											<pre class="text-xs bg-base-300 p-3 rounded-lg overflow-auto max-h-48">{formatJson(log.oldValues)}</pre>
										</div>
										<div>
											<p class="text-sm font-medium text-base-content/60 mb-1">New Values</p>
											<pre class="text-xs bg-base-300 p-3 rounded-lg overflow-auto max-h-48">{formatJson(log.newValues)}</pre>
										</div>
									</div>
									{#if log.ipAddress}
										<p class="mt-2 text-xs text-base-content/50">
											IP Address: {log.ipAddress}
										</p>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
				<p class="text-sm text-base-content/60">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total}
				</p>
				<div class="flex items-center gap-2">
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === 1}
						onclick={() => {
							currentPage--;
							loadLogs();
						}}
					>
						<ChevronLeft class="h-4 w-4" />
						<span class="hidden sm:inline">Previous</span>
					</button>
					<span class="text-sm">
						{currentPage} / {totalPages}
					</span>
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === totalPages}
						onclick={() => {
							currentPage++;
							loadLogs();
						}}
					>
						<span class="hidden sm:inline">Next</span>
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
