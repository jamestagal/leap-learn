<script>
	/**
	 * H5P Context Menu Component
	 * Right-click context menu for content and folder actions
	 */
	
	import { onMount } from 'svelte';
	import Edit from '@icons/pencil.svelte';
	import Copy from '@icons/copy.svelte';
	import Share2 from '@icons/share-2.svelte';
	import Move from '@icons/move.svelte';
	import Trash2 from '@icons/trash-2.svelte';
	import FolderOpen from '@icons/folder-open.svelte';
	import Download from '@icons/download.svelte';
	import Eye from '@icons/eye.svelte';

	let {
		show = $bindable(false),
		x = 0,
		y = 0,
		items = [],
		target = null,
		onAction = () => {},
		class: className = ''
	} = $props();

	let menuRef = $state();
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

	// Close menu when clicking outside
	$effect(() => {
		if (show && mounted) {
			const handleClickOutside = (event) => {
				if (menuRef && !menuRef.contains(event.target)) {
					show = false;
				}
			};

			const handleEscape = (event) => {
				if (event.key === 'Escape') {
					show = false;
				}
			};

			document.addEventListener('click', handleClickOutside);
			document.addEventListener('keydown', handleEscape);

			return () => {
				document.removeEventListener('click', handleClickOutside);
				document.removeEventListener('keydown', handleEscape);
			};
		}
	});

	// Position menu within viewport
	let menuPosition = $derived(() => {
		if (!show || !mounted) return { x, y };

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = 200; // Approximate menu width
		const menuHeight = items.length * 40 + 16; // Approximate menu height

		let adjustedX = x;
		let adjustedY = y;

		// Adjust horizontal position
		if (x + menuWidth > viewportWidth) {
			adjustedX = x - menuWidth;
		}

		// Adjust vertical position
		if (y + menuHeight > viewportHeight) {
			adjustedY = y - menuHeight;
		}

		return { x: Math.max(8, adjustedX), y: Math.max(8, adjustedY) };
	});

	function handleAction(action) {
		show = false;
		onAction(action, target);
	}

	// Default menu items for H5P content
	const defaultContentItems = [
		{
			id: 'preview',
			label: 'Preview',
			icon: Eye,
			action: 'preview'
		},
		{
			id: 'edit',
			label: 'Edit',
			icon: Edit,
			action: 'edit'
		},
		{
			id: 'duplicate',
			label: 'Duplicate',
			icon: Copy,
			action: 'duplicate'
		},
		{ type: 'divider' },
		{
			id: 'move',
			label: 'Move to Folder',
			icon: Move,
			action: 'move'
		},
		{
			id: 'share',
			label: 'Share',
			icon: Share2,
			action: 'share'
		},
		{
			id: 'download',
			label: 'Download',
			icon: Download,
			action: 'download'
		},
		{ type: 'divider' },
		{
			id: 'delete',
			label: 'Delete',
			icon: Trash2,
			action: 'delete',
			destructive: true
		}
	];

	// Default menu items for folders
	const defaultFolderItems = [
		{
			id: 'open',
			label: 'Open Folder',
			icon: FolderOpen,
			action: 'open'
		},
		{
			id: 'edit',
			label: 'Rename',
			icon: Edit,
			action: 'rename'
		},
		{ type: 'divider' },
		{
			id: 'move',
			label: 'Move Folder',
			icon: Move,
			action: 'move'
		},
		{
			id: 'share',
			label: 'Share Folder',
			icon: Share2,
			action: 'share'
		},
		{ type: 'divider' },
		{
			id: 'delete',
			label: 'Delete Folder',
			icon: Trash2,
			action: 'delete',
			destructive: true
		}
	];

	// Use provided items or defaults based on target type
	let menuItems = $derived(() => {
		if (items.length > 0) return items;
		
		if (target?.type === 'folder') {
			return defaultFolderItems;
		}
		
		return defaultContentItems;
	});
</script>

{#if show}
	<div 
		bind:this={menuRef}
		class="
			fixed z-50 bg-white rounded-lg shadow-lg border border-primary-3
			min-w-48 py-2 {className}
		"
		style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
		role="menu"
		tabindex="-1"
	>
		{#each menuItems as item}
			{#if item.type === 'divider'}
				<hr class="my-1 border-primary-2" />
			{:else}
				<button
					class="
						w-full px-4 py-2 text-left text-sm
						flex items-center gap-3
						hover:bg-primary-2 transition-colors
						{item.destructive ? 'text-danger hover:bg-danger/5' : 'text-secondary'}
						{item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
					"
					onclick={() => handleAction(item.action)}
					disabled={item.disabled}
					role="menuitem"
				>
					{#if item.icon}
						<svelte:component 
							this={item.icon} 
							class="w-4 h-4 {item.destructive ? 'text-danger' : 'text-secondary-4'}" 
						/>
					{/if}
					<span>{item.label}</span>
				</button>
			{/if}
		{/each}
	</div>
{/if}

<style>
	/* Ensure menu appears above other content */
	.fixed {
		pointer-events: auto;
	}

	/* Animation for menu appearance */
	.fixed {
		animation: contextMenuShow 150ms ease-out;
		transform-origin: top left;
	}

	@keyframes contextMenuShow {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Focus styles for keyboard navigation */
	button:focus-visible {
		outline: 2px solid var(--primary-accent);
		outline-offset: -2px;
	}
</style>