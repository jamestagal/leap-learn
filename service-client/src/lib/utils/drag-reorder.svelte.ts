/**
 * Reusable drag-and-drop reordering composable for Svelte 5
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { createDragReorder } from '$lib/utils/drag-reorder.svelte';
 *
 *   let items = $state([...]);
 *   const drag = createDragReorder({
 *     onReorder: (newItems) => {
 *       items = newItems;
 *       // Optionally save to backend
 *     }
 *   });
 * </script>
 *
 * {#each items as item, index}
 *   <div
 *     draggable="true"
 *     ondragstart={(e) => drag.start(e, index)}
 *     ondragover={(e) => drag.over(e, index)}
 *     ondragleave={drag.leave}
 *     ondrop={(e) => drag.drop(e, index, items)}
 *     ondragend={drag.end}
 *     class:opacity-50={drag.isDragging(index)}
 *     class:border-primary={drag.isDragOver(index)}
 *   >
 *     ...
 *   </div>
 * {/each}
 * ```
 */

type DragReorderOptions<T> = {
	onReorder: (newItems: T[]) => void;
};

export function createDragReorder<T>(options: DragReorderOptions<T>) {
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function start(event: DragEvent, index: number) {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", index.toString());
		}
	}

	function over(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "move";
		}
		if (draggedIndex !== null && draggedIndex !== index) {
			dragOverIndex = index;
		}
	}

	function leave() {
		dragOverIndex = null;
	}

	function drop(event: DragEvent, dropIndex: number, items: T[]) {
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
			options.onReorder(newItems);
		}

		draggedIndex = null;
		dragOverIndex = null;
	}

	function end() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function isDragging(index: number): boolean {
		return draggedIndex === index;
	}

	function isDragOver(index: number): boolean {
		return dragOverIndex === index && draggedIndex !== index;
	}

	return {
		start,
		over,
		leave,
		drop,
		end,
		isDragging,
		isDragOver,
		get draggedIndex() {
			return draggedIndex;
		},
		get dragOverIndex() {
			return dragOverIndex;
		},
	};
}
