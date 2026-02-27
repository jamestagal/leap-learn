<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { LayoutDashboard, Building2, Users, ScrollText, Shield, LogOut, Menu, Mail, Gift, FileText } from 'lucide-svelte';
	import { stopImpersonation } from '$lib/api/super-admin.remote';
	import { goto, invalidateAll } from '$app/navigation';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	let current = $derived(page.url.pathname);

	// Navigation items
	const nav = [
		{ label: 'Dashboard', url: '/super-admin', icon: LayoutDashboard, exact: true },
		{ label: 'Organisations', url: '/super-admin/organisations', icon: Building2 },
		{ label: 'Users', url: '/super-admin/users', icon: Users },
		{ label: 'Beta Invites', url: '/super-admin/beta-invites', icon: Mail },
		{ label: 'Freemium Users', url: '/super-admin/freemium', icon: Gift },
		{ label: 'Form Templates', url: '/super-admin/form-templates', icon: FileText },
		{ label: 'Audit Log', url: '/super-admin/audit-log', icon: ScrollText }
	];

	function isActive(item: (typeof nav)[0]): boolean {
		if (item.exact) {
			return current === item.url;
		}
		return current.startsWith(item.url);
	}

	async function handleStopImpersonation() {
		await stopImpersonation();
		await invalidateAll();
		await goto('/super-admin');
	}

	// Modal functions for mobile sidebar
	function showModal(): void {
		const modal = document.getElementById('super-admin-sidebar') as HTMLDialogElement;
		if (modal) {
			modal.showModal();
		}
	}

	function closeModal(): void {
		const modal = document.getElementById('super-admin-sidebar') as HTMLDialogElement;
		if (modal) {
			modal.close();
		}
	}

	// Get display name from email (first part before @)
	let displayName = $derived(data.superAdmin.email.split('@')[0]);
</script>

<!-- Super Admin Warning Banner -->
<div class="bg-error text-error-content px-4 py-2 text-center text-sm font-medium">
	<div class="flex items-center justify-center gap-2">
		<Shield class="h-4 w-4" />
		<span>Super Admin Mode</span>
		{#if data.isImpersonating}
			<span class="mx-2">|</span>
			<span class="hidden sm:inline">Currently impersonating organisation</span>
			<button onclick={handleStopImpersonation} class="btn btn-xs btn-ghost ml-2 gap-1">
				<LogOut class="h-3 w-3" />
				Exit
			</button>
		{/if}
	</div>
</div>

<div id="super-admin-content" class="min-h-[calc(100vh-40px)]">
	<!-- Desktop Sidebar (icon-only, like organisation layout) -->
	<div
		class="bg-error/5 hidden !overflow-visible lg:fixed lg:inset-y-[40px] lg:left-0 lg:z-30 lg:flex lg:w-20 lg:flex-col lg:overflow-y-auto lg:pb-4 lg:border-r lg:border-error/20"
	>
		<div class="flex grow flex-col">
			<!-- Super Admin Icon Header -->
			<a href="/super-admin" class="mt-4 flex h-10 shrink-0 items-center justify-center">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error text-error-content">
					<Shield class="h-5 w-5" />
				</div>
			</a>

			<!-- Navigation -->
			<nav class="mt-8 flex flex-1 flex-col">
				<ul role="list" class="flex flex-1 flex-col items-center space-y-1">
					{#each nav as item (item.url)}
						{@const active = isActive(item)}
						{@const NavIcon = item.icon}
						<li>
							<div class="tooltip tooltip-right" data-tip={item.label}>
								<a
									href={item.url}
									class="group relative flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold transition-all duration-200
										{active ? 'bg-error/10 text-error' : 'text-base-content/70 hover:bg-error/5 hover:text-error'}"
								>
									<NavIcon class="h-6 w-6" />
									<span class="sr-only">{item.label}</span>
									{#if active}
										<span
											class="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-error"
										></span>
									{/if}
								</a>
							</div>
						</li>
					{/each}

					<!-- Exit Super Admin -->
					<li class="!mt-auto">
						<div class="tooltip tooltip-right" data-tip="Exit Super Admin">
							<a
								href="/"
								class="group flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold text-base-content/70 hover:bg-error/5 hover:text-error"
							>
								<LogOut class="h-6 w-6" />
								<span class="sr-only">Exit Super Admin</span>
							</a>
						</div>
					</li>
				</ul>
			</nav>
		</div>
	</div>

	<!-- Mobile Header -->
	<div class="bg-error/5 sticky top-0 z-30 flex items-center gap-x-4 px-4 py-3 shadow-sm border-b border-error/20 lg:hidden">
		<button
			type="button"
			class="-m-2.5 cursor-pointer p-2.5 text-error hover:opacity-60"
			onclick={showModal}
		>
			<span class="sr-only">Open sidebar</span>
			<Menu class="h-6 w-6" />
		</button>
		<div class="flex-1 flex items-center gap-2">
			<Shield class="h-5 w-5 text-error" />
			<span class="font-semibold text-error">Super Admin</span>
		</div>
	</div>

	<!-- Mobile Sidebar Modal -->
	<dialog id="super-admin-sidebar" class="modal modal-start">
		<div class="modal-box w-full max-w-sm bg-base-100">
			<div class="mb-6 pb-4 border-b border-base-300">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error text-error-content">
						<Shield class="h-5 w-5" />
					</div>
					<div>
						<h1 class="text-lg font-bold text-error">Super Admin</h1>
						<p class="text-xs text-base-content/60 truncate max-w-[200px]">{data.superAdmin.email}</p>
					</div>
				</div>
			</div>

			<nav class="flex flex-1 flex-col">
				<ul role="list" class="-mx-2 flex-1 space-y-1">
					{#each nav as item (item.url)}
						{@const active = isActive(item)}
						{@const NavIcon = item.icon}
						<li>
							<a
								href={item.url}
								onclick={closeModal}
								class="group relative flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold transition-all duration-200
									{active ? 'bg-error/10 text-error' : 'text-base-content/70 hover:bg-error/5 hover:text-error'}"
							>
								<NavIcon class="h-6 w-6" />
								{item.label}
								{#if active}
									<span
										class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-error"
									></span>
								{/if}
							</a>
						</li>
					{/each}

					<li class="!mt-6 pt-4 border-t border-base-300">
						<a
							href="/"
							onclick={closeModal}
							class="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold text-base-content/70 hover:bg-error/5 hover:text-error"
						>
							<LogOut class="h-6 w-6" />
							Exit Super Admin
						</a>
					</li>
				</ul>
			</nav>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>

	<!-- Main Content -->
	<main class="min-h-full lg:pl-20">
		<!-- Desktop Header -->
		<div class="hidden lg:flex items-center justify-between border-b border-base-300 bg-base-100 px-8 py-3">
			<div class="flex items-center gap-3">
				<h1 class="text-lg font-semibold text-error">Super Admin</h1>
				<span class="text-sm text-base-content/60">
					{displayName}
				</span>
			</div>
		</div>

		<div class="px-4 py-6 sm:px-6 lg:px-8 xl:px-12 max-w-[1600px]">
			{@render children()}
		</div>
	</main>
</div>
