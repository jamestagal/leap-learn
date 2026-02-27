<script>
	/**
	 * H5P Data Table Component
	 * Professional table with multi-select, sorting, and context menus
	 */
	
	import H5PCheckbox from './H5PCheckbox.svelte';
	import Spinner from '@components/Spinner.svelte';
	import ChevronUp from '@icons/chevron-up.svelte';
	import ChevronDown from '@icons/chevron-down.svelte';
	import MoreHorizontal from '@icons/ellipsis.svelte';

	let {
		columns = [],
		data = [],
		selectable = false,
		selectedItems = $bindable(new Set()),
		sortColumn = $bindable(''),
		sortDirection = $bindable('asc'),
		onRowClick = () => {},
		onSort = () => {},
		onContextMenu = () => {},
		loading = false,
		emptyMessage = 'No items found',
		emptyIcon = '📄',
		class: className = '',
		hoverable = true,
		striped = false,
		compact = false
	} = $props();

	// Selection state
	let allSelected = $derived(
		data.length > 0 && selectedItems.size > 0 && selectedItems.size === data.length
	);
	let someSelected = $derived(
		selectedItems.size > 0 && selectedItems.size < data.length
	);

	// Table classes
	let tableClasses = $derived(() => {
		const base = 'w-full divide-y divide-primary-2';
		return base;
	});

	let rowClasses = $derived(() => {
		let classes = 'transition-colors duration-150';
		if (hoverable) classes += ' hover:bg-primary/50';
		if (striped) classes += ' even:bg-primary/20';
		return classes;
	});

	// Selection handlers
	function toggleAll() {
		if (allSelected) {
			selectedItems.clear();
		} else {
			data.forEach(item => selectedItems.add(item.id || item.contentId));
		}
		selectedItems = selectedItems; // Trigger reactivity
	}

	function toggleItem(itemId) {
		if (selectedItems.has(itemId)) {
			selectedItems.delete(itemId);
		} else {
			selectedItems.add(itemId);
		}
		selectedItems = selectedItems; // Trigger reactivity
	}

	// Sorting
	function handleSort(column) {
		if (!column.sortable) return;

		if (sortColumn === column.key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column.key;
			sortDirection = 'asc';
		}

		onSort({ column: sortColumn, direction: sortDirection });
	}

	// Row click handler
	function handleRowClick(item, event) {
		// Don't trigger if clicking on checkbox or action buttons
		if (event.target.closest('input[type="checkbox"]') || 
		    event.target.closest('.table-action-button') ||
		    event.target.closest('.table-context-menu')) {
			return;
		}
		onRowClick(item);
	}

	// Context menu handler
	function handleContextMenu(item, event) {
		event.preventDefault();
		onContextMenu(item, { x: event.clientX, y: event.clientY });
	}
</script>

<div class="h5p-data-table overflow-x-auto {className}">
	<table class={tableClasses}>
		<!-- Header -->
		<thead class="bg-primary-2">
			<tr>
				{#if selectable}
					<th class="w-12 px-4 py-3 text-left">
						<H5PCheckbox
							checked={allSelected}
							indeterminate={someSelected}
							onchange={toggleAll}
							aria-label="Select all items"
							size={compact ? 'sm' : 'md'}
						/>
					</th>
				{/if}

				{#each columns as column}
					<th class="
						px-4 py-3 text-left text-sm font-medium text-secondary
						{column.width ? `w-${column.width}` : ''}
						{column.align === 'center' ? 'text-center' : ''}
						{column.align === 'right' ? 'text-right' : ''}
						{compact ? 'py-2' : ''}
					">
						{#if column.sortable}
							<button
								onclick={() => handleSort(column)}
								class="flex items-center gap-1 hover:text-secondary-accent transition-colors group"
							>
								<span>{column.label}</span>
								<div class="flex flex-col">
									<ChevronUp 
										class="w-3 h-3 {sortColumn === column.key && sortDirection === 'asc' ? 'text-secondary' : 'text-secondary-4 opacity-50'}" 
									/>
									<ChevronDown 
										class="w-3 h-3 -mt-1 {sortColumn === column.key && sortDirection === 'desc' ? 'text-secondary' : 'text-secondary-4 opacity-50'}" 
									/>
								</div>
							</button>
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}

				<!-- Actions column if needed -->
				{#if onContextMenu !== (() => {})}
					<th class="w-12 px-4 py-3"></th>
				{/if}
			</tr>
		</thead>

		<!-- Body -->
		<tbody class="divide-y divide-primary-2 bg-white">
			{#if loading}
				<tr>
					<td colspan={columns.length + (selectable ? 1 : 0) + (onContextMenu !== (() => {}) ? 1 : 0)} class="px-4 py-8 text-center">
						<div class="flex justify-center">
							<Spinner size={compact ? 20 : 32} />
						</div>
					</td>
				</tr>
			{:else if data.length === 0}
				<tr>
					<td colspan={columns.length + (selectable ? 1 : 0) + (onContextMenu !== (() => {}) ? 1 : 0)} class="px-4 py-8 text-center">
						<div class="text-center">
							<div class="text-4xl mb-3">{emptyIcon}</div>
							<p class="text-secondary-4">{emptyMessage}</p>
						</div>
					</td>
				</tr>
			{:else}
				{#each data as item (item.id || item.contentId)}
					{@const itemId = item.id || item.contentId}
					<tr 
						class="
							{rowClasses} 
							cursor-pointer
							{selectedItems.has(itemId) ? 'bg-primary-accent/5 ring-1 ring-primary-accent/20' : ''}
							{compact ? '' : ''}
						"
						onclick={(e) => handleRowClick(item, e)}
						oncontextmenu={(e) => handleContextMenu(item, e)}
					>
						{#if selectable}
							<td class="px-4 {compact ? 'py-2' : 'py-3'}" onclick={(e) => e.stopPropagation()}>
								<H5PCheckbox
									checked={selectedItems.has(itemId)}
									onchange={() => toggleItem(itemId)}
									aria-label="Select {item.name || item.title}"
									size={compact ? 'sm' : 'md'}
								/>
							</td>
						{/if}

						{#each columns as column}
							<td class="
								px-4 {compact ? 'py-2 text-sm' : 'py-3'}
								{column.align === 'center' ? 'text-center' : ''}
								{column.align === 'right' ? 'text-right' : ''}
							">
								{#if column.render}
									{@render column.render(item, { selected: selectedItems.has(itemId) })}
								{:else}
									<span class="text-sm text-secondary">
										{item[column.key] || '-'}
									</span>
								{/if}
							</td>
						{/each}

						<!-- Context menu trigger -->
						{#if onContextMenu !== (() => {})}
							<td class="px-4 {compact ? 'py-2' : 'py-3'}" onclick={(e) => e.stopPropagation()}>
								<button
									class="table-context-menu p-1 rounded hover:bg-primary-2 transition-colors"
									onclick={(e) => {
										e.stopPropagation();
										handleContextMenu(item, e);
									}}
									aria-label="More options for {item.name || item.title}"
								>
									<MoreHorizontal class="w-4 h-4 text-secondary-4" />
								</button>
							</td>
						{/if}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<!-- Selection summary -->
{#if selectable && selectedItems.size > 0}
	<div class="mt-4 px-4 py-2 bg-primary-accent/5 rounded-lg border border-primary-accent/20">
		<span class="text-sm text-primary-accent font-medium">
			{selectedItems.size} item{selectedItems.size === 1 ? '' : 's'} selected
		</span>
	</div>
{/if}

<style>
	.h5p-data-table {
		/* Custom scrollbar for better UX */
		scrollbar-width: thin;
		scrollbar-color: var(--primary-3) var(--primary);
	}
	
	.h5p-data-table::-webkit-scrollbar {
		height: 6px;
	}
	
	.h5p-data-table::-webkit-scrollbar-track {
		background: var(--primary);
	}
	
	.h5p-data-table::-webkit-scrollbar-thumb {
		background: var(--primary-3);
		border-radius: 3px;
	}
	
	.h5p-data-table::-webkit-scrollbar-thumb:hover {
		background: var(--primary-4);
	}

	/* Focus styles for accessibility */
	button:focus-visible {
		outline: 2px solid var(--primary-accent);
		outline-offset: 2px;
	}
	
	/* Row selection ring animation */
	tbody tr {
		position: relative;
	}
	
	/* Smooth transitions for interactive elements */
	.table-action-button,
	.table-context-menu {
		transition: all 150ms ease-in-out;
	}
</style>