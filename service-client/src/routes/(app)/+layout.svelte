<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LogOut, Shield } from 'lucide-svelte';
	import { setOrganisationConfig } from '$lib/stores/organisation-config.svelte';
	import { stopImpersonation } from '$lib/api/super-admin.remote';
	import { goto, invalidateAll } from '$app/navigation';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	async function handleStopImpersonation() {
		await stopImpersonation();
		await invalidateAll();
		await goto('/super-admin');
	}

	// Set organisation config context for child components
	$effect(() => {
		setOrganisationConfig(data.organisationConfig);
	});
</script>

<div id="content" class="h-full">
	<!-- Super Admin Impersonation Banner -->
	{#if data.isImpersonating}
		<div class="bg-error text-error-content px-4 py-2 text-center text-sm font-medium z-50 relative">
			<div class="flex items-center justify-center gap-2">
				<Shield class="h-4 w-4" />
				<span>Super Admin Mode - Viewing as organisation owner</span>
				<button onclick={handleStopImpersonation} class="btn btn-xs btn-ghost ml-2 gap-1">
					<LogOut class="h-3 w-3" />
					Exit
				</button>
			</div>
		</div>
	{/if}

	<main class="min-h-full">
		{@render children()}
	</main>
</div>
