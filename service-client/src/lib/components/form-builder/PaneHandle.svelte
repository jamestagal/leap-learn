<script lang="ts">
	/**
	 * PaneHandle - Reusable resizer handle for paneforge
	 *
	 * Styled to match PaneForge docs example:
	 * - Solid brand/primary background
	 * - Black icon for high contrast
	 * - Border and rounded corners
	 */
	import GripVertical from "lucide-svelte/icons/grip-vertical";
</script>

<div class="bg-primary z-10 flex h-12 w-6 items-center justify-center rounded-md border-2 border-primary-content/30 shadow-md">
	<GripVertical class="size-5 shrink-0 text-primary-content" />
</div>
