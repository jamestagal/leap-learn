<script>
	let {
		title,
		maxWidth = "max-w-2xl",
		height = "h-auto",
		position = "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
		showCloseButton = true,
		isOpen = $bindable(false),
		children,
	} = $props();

	let modalElement = $state();

	// Sync isOpen prop with dialog state
	$effect(() => {
		if (!modalElement) return;
		if (isOpen && !modalElement.open) {
			modalElement.showModal();
		} else if (!isOpen && modalElement.open) {
			modalElement.close();
		}
	});

	// Handle dialog close events (ESC key, backdrop click)
	function handleClose() {
		isOpen = false;
	}

	export function close() {
		isOpen = false;
	}

	export function showModal() {
		isOpen = true;
	}
</script>

<dialog
	bind:this={modalElement}
	onclose={handleClose}
	class={`${maxWidth} ${height} ${position} bg-base-100 text-base-content fixed z-50 max-h-svh w-11/12 overflow-x-hidden rounded-xl shadow-xl border border-base-300`}
>
	{#if title || showCloseButton}
		<div class="flex h-14 items-center px-4 {title ? 'justify-between' : 'justify-end'}">
			{#if title}
				<h1 class="p-2 font-semibold">{title}</h1>
			{/if}
			{#if showCloseButton}
				<button class="button p-2" onclick={close} aria-label="Close modal">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 6 6 18"></path>
						<path d="m6 6 12 12"></path>
					</svg>
				</button>
			{/if}
		</div>
	{/if}
	{@render children?.()}
</dialog>

<!-- @component Modal
### Usage
```svelte
<script>
    import Modal from '$lib/components/ui/Modal.svelte';
    let modalReference = $state();
</script>
<button type="button" onclick={() => modalReference?.showModal()}>Open Modal</button>
<Modal bind:this={modalReference} title="Modal Title" showCloseButton>
    <div class="flex flex-col gap-8 p-4">
        <p>This is a modal! It's a dialog that can be used to display information or ask for user input.</p>
        <button onclick={() => modalReference?.close()}>Okay</button>
    </div>
</Modal>
```
-->

<style>
	dialog {
		animation: scaleIn 100ms ease-in forwards;
		scrollbar-width: thin;
		-ms-overflow-style: none;
	}

	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
