<script>
	import { fly } from "svelte/transition";

	let { children, activeIndex = 0, prevIndex = 0 } = $props();

	let distance = 200;

	// Calculate transition directions based on index change
	let inDir = $derived(activeIndex > prevIndex ? distance : -distance);
	let outDir = $derived(activeIndex > prevIndex ? -distance : distance);
</script>

<!-- Content -->
<div class="grid w-full grid-cols-1 grid-rows-1 overflow-x-hidden">
	{#key activeIndex}
		<div
			class="col-start-1 row-start-1 flex w-full flex-col gap-4"
			in:fly={{ x: inDir, duration: 500, delay: 200 }}
			out:fly={{ x: outDir, duration: 300 }}
		>
			{#if children}
				{@render children({ activeIndex, prevIndex })}
			{:else}
				<p class="text-fade text-xs italic">Content missing for index: {activeIndex}</p>
			{/if}
		</div>
	{/key}
</div>
