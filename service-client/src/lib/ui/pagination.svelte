<script lang="ts">
	import { page } from "$app/state";
	import type { Pagination } from "./pagination";

	let { pagination }: { pagination: Pagination } = $props();
	const current = $derived(page.url.searchParams.get("page") || "1");
</script>

<div class="bg-base flex items-center justify-between border-t px-4 py-3 sm:px-6">
	<div class="flex flex-1 justify-between sm:hidden">
		<a
			href="?page={pagination.prev}&limit={pagination.limit}"
			class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:opacity-60"
		>
			Previous
		</a>
		<a
			href="?page={pagination.next}&limit={pagination.limit}"
			class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:opacity-60"
		>
			Next
		</a>
	</div>
	<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
		<div>
			<p class="text-sm">
				Showing
				<span class="font-medium">{pagination.start}</span>
				to
				<span class="font-medium">{pagination.end}</span>
				of
				<span class="font-medium">{pagination.total}</span>
				results
			</p>
		</div>
		<div>
			<nav class="isolate inline-flex -space-x-px rounded-md shadow-xs" aria-label="Pagination">
				<a
					href="?page={pagination.prev}&limit={pagination.limit}"
					class="relative inline-flex items-center rounded-l-md px-2 py-2 text-base ring-1 ring-gray-300 ring-inset hover:opacity-60 focus:z-20 focus:outline-offset-0"
				>
					<span class="sr-only">Previous</span>
					<svg
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
						data-slot="icon"
					>
						<path
							fill-rule="evenodd"
							d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
							clip-rule="evenodd"
						/>
					</svg>
				</a>
				<!-- Current: "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600", Default: "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0" -->
				{#each pagination.schema as page (page)}
					{#if page === 0}
						<span
							class="relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-gray-300 ring-inset focus:outline-offset-0"
						>
							...
						</span>
					{:else}
						<a
							href="?page={page}&limit={pagination.limit}"
							class="relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20
                            {current === page.toString()
								? 'z-10 bg-emerald-700 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
								: 'ring-1 ring-gray-300 ring-inset hover:opacity-60 focus:outline-offset-0'}"
						>
							{page}
						</a>
					{/if}
				{/each}
				<a
					href="?page={pagination.next}&limit={pagination.limit}"
					class="relative inline-flex items-center rounded-r-md px-2 py-2 text-base ring-1 ring-gray-300 ring-inset hover:opacity-60 focus:z-20 focus:outline-offset-0"
				>
					<span class="sr-only">Next</span>
					<svg
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
						data-slot="icon"
					>
						<path
							fill-rule="evenodd"
							d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
							clip-rule="evenodd"
						/>
					</svg>
				</a>
			</nav>
		</div>
	</div>
</div>
