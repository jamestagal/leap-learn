<script lang="ts">
	/**
	 * AutoResizeTextarea - Auto-growing textarea component
	 *
	 * Automatically adjusts height based on content.
	 * Use for short-to-medium text fields where RichTextEditor is overkill.
	 */

	let {
		value = $bindable(''),
		placeholder = '',
		minRows = 2,
		maxRows = 12,
		disabled = false,
		id = '',
		class: className = '',
		oninput
	}: {
		value: string;
		placeholder?: string;
		minRows?: number;
		maxRows?: number;
		disabled?: boolean;
		id?: string;
		class?: string;
		oninput?: (e: Event & { currentTarget: HTMLTextAreaElement }) => void;
	} = $props();

	let textarea: HTMLTextAreaElement;

	function resize() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
		const minHeight = lineHeight * minRows + 16; // 16px for padding
		const maxHeight = lineHeight * maxRows + 16;
		const scrollHeight = textarea.scrollHeight;
		textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
	}

	$effect(() => {
		// Re-run resize whenever value changes
		void value;
		// Use tick-like delay to ensure DOM is updated
		requestAnimationFrame(resize);
	});

	function handleInput(e: Event & { currentTarget: HTMLTextAreaElement }) {
		value = e.currentTarget.value;
		resize();
		oninput?.(e);
	}
</script>

<textarea
	bind:this={textarea}
	{value}
	{placeholder}
	{disabled}
	{id}
	class="textarea textarea-bordered w-full resize-none overflow-y-auto {className}"
	oninput={handleInput}
></textarea>
