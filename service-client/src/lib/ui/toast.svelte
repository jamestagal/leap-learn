<script lang="ts">
	import { cubicOut } from "svelte/easing";
	import { fade, fly } from "svelte/transition";
	import { getToast } from "./toast_store.svelte";
	import XIcon from "$lib/assets/icons/XIcon.svelte";
	import type { Toast } from "$lib/types";

	let { toast }: { toast: Toast } = $props();
	let t = getToast();
</script>

<div
	class="bg-base-300 pointer-events-auto w-full max-w-sm overflow-hidden rounded shadow-lg ring-2
    {toast.type === 'success' ? 'ring-green-500' : ''}
    {toast.type === 'error' ? 'ring-red-500' : ''}
    {toast.type === 'warning' ? 'ring-yellow-500' : ''}
    {toast.type === 'info' ? 'ring-blue-500' : ''}"
	in:fly={{ duration: 300, easing: cubicOut, x: 10 }}
	out:fade={{ duration: 100 }}
	role="alert"
>
	<div class="p-4">
		<div class="flex items-start">
			<div class="ml-3 w-0 flex-1 pt-0.5">
				<p class="text-base-content text-sm font-semibold">
					{toast.title}
				</p>
				{#if toast.description}
					<div class="text-base-content mt-1 text-sm whitespace-pre-wrap">
						{toast.description}
					</div>
				{/if}
				{#if toast.action}
					<button
						class="text-base-300 hover:text-base-content mt-4 text-sm"
						aria-hidden="true"
						onclick={() => {
							toast.action?.onClick();
						}}
					>
						{toast.action?.label}
					</button>
				{/if}
			</div>
			<div class="ml-4 flex shrink-0">
				<button
					type="button"
					class="text-base-content relative rounded-sm hover:text-white focus:ring-2 focus:ring-white"
					onclick={() => {
						t.removeToast(toast.id);
					}}
				>
					<span class="absolute -inset-2.5"></span>
					<span class="sr-only">Close modal</span>
					<div class="h-4 w-4">
						<XIcon />
					</div>
				</button>
			</div>
		</div>
	</div>
</div>
