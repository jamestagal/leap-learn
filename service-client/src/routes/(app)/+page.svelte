<script lang="ts">
	import { Building2, Plus } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

{#if data.isAuthenticated}
	<!-- Authenticated user with no organisation — show create organisation card -->
	<div class="flex min-h-[60vh] items-center justify-center">
		<div class="card bg-base-100 border border-base-300 max-w-md w-full">
			<div class="card-body items-center text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<Building2 class="h-8 w-8" />
				</div>
				<h1 class="text-2xl font-bold">Welcome to LeapLearn</h1>
				<p class="text-base-content/70">
					You don't have an organisation yet. Create one to get started.
				</p>
				<div class="mt-6 flex flex-col gap-3 w-full">
					<a href="/organisations/create" class="btn btn-primary">
						<Plus class="h-4 w-4" />
						Create Organisation
					</a>
				</div>
				<div class="mt-4 text-sm text-base-content/50">
					Logged in as {data.email}
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Not authenticated — redirect to login -->
	<div class="flex min-h-[60vh] items-center justify-center">
		<div class="card bg-base-100 border border-base-300 max-w-md w-full">
			<div class="card-body items-center text-center">
				<h1 class="text-2xl font-bold">LeapLearn</h1>
				<p class="text-base-content/70">
					Please sign in to continue.
				</p>
				<div class="mt-6">
					<a href="/login" class="btn btn-primary">Sign In</a>
				</div>
			</div>
		</div>
	</div>
{/if}
