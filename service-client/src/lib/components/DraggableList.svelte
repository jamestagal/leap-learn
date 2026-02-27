<script lang="ts" generics="T extends { id: string }">
	/**
	 * DraggableList - Reusable drag-and-drop list component
	 *
	 * Usage:
	 * ```svelte
	 * <DraggableList
	 *   items={myItems}
	 *   onReorder={(newItems) => { myItems = newItems; saveOrder(); }}
	 * >
	 *   {#snippet item(item, index, isDragging, isDragOver)}
	 *     <div class:opacity-50={isDragging} class:border-primary={isDragOver}>
	 *       {item.name}
	 *     </div>
	 *   {/snippet}
	 * </DraggableList>
	 * ```
	 */
	import type { Snippet } from 'svelte';

	let {
		items,
		onReorder,
		item: itemSnippet,
		class: className = 'space-y-3'
	}: {
		items: T[];
		onReorder: (newItems: T[]) => void;
		item: Snippet<[item: T, index: number, isDragging: boolean, isDragOver: boolean]>;
		class?: string;
	} = $props();

	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		if (draggedIndex !== null && draggedIndex !== index) {
			dragOverIndex = index;
		}
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(event: DragEvent, dropIndex: number) {
		event.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}

		const newItems = [...items];
		const [draggedItem] = newItems.splice(draggedIndex, 1);
		if (draggedItem !== undefined) {
			newItems.splice(dropIndex, 0, draggedItem);
			onReorder(newItems);
		}

		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}
</script>

<div class={className}>
	{#each items as itemData, index (itemData.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			draggable="true"
			ondragstart={(e) => handleDragStart(e, index)}
			ondragover={(e) => handleDragOver(e, index)}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, index)}
			ondragend={handleDragEnd}
		>
			{@render itemSnippet(
				itemData,
				index,
				draggedIndex === index,
				dragOverIndex === index && draggedIndex !== index
			)}
		</div>
	{/each}
</div>
