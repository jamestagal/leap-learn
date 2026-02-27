<script lang="ts">
	/**
	 * RichTextEditor - Tiptap v3 with DaisyUI Toolbar
	 *
	 * A reusable rich text editor component for contract templates,
	 * terms & conditions, and schedule content.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';
	import Link from '@tiptap/extension-link';

	let {
		content = '',
		placeholder = 'Start typing...',
		minHeight = '200px',
		onUpdate,
		disabled = false
	}: {
		content: string;
		placeholder?: string;
		minHeight?: string;
		onUpdate?: (html: string) => void;
		disabled?: boolean;
	} = $props();

	let element: HTMLDivElement;
	let editor: Editor | null = $state(null);

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3]
					}
				}),
				Placeholder.configure({ placeholder }),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'text-primary underline'
					}
				})
			],
			content,
			editable: !disabled,
			onTransaction: () => {
				// Force Svelte reactivity for toolbar state
				editor = editor;
			},
			onUpdate: ({ editor }) => {
				onUpdate?.(editor.getHTML());
			}
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Update editor when content prop changes externally
	$effect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content);
		}
	});

	// Update editable state when disabled prop changes
	$effect(() => {
		if (editor) {
			editor.setEditable(!disabled);
		}
	});

	// Helper to insert text at cursor (used by MergeFieldPicker)
	export function insertText(text: string) {
		editor?.chain().focus().insertContent(text).run();
	}
</script>

<div class="border border-base-300 rounded-lg overflow-hidden" class:opacity-60={disabled}>
	{#if editor}
		<!-- DaisyUI Toolbar -->
		<div class="flex flex-wrap gap-1 p-2 bg-base-200 border-b border-base-300">
			<!-- Text formatting -->
			<div class="btn-group">
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('bold')}
					onclick={() => editor?.chain().focus().toggleBold().run()}
					{disabled}
					title="Bold (Ctrl+B)"
				>
					<span class="font-bold">B</span>
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('italic')}
					onclick={() => editor?.chain().focus().toggleItalic().run()}
					{disabled}
					title="Italic (Ctrl+I)"
				>
					<span class="italic">I</span>
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('strike')}
					onclick={() => editor?.chain().focus().toggleStrike().run()}
					{disabled}
					title="Strikethrough"
				>
					<span class="line-through">S</span>
				</button>
			</div>

			<div class="divider divider-horizontal mx-0.5 my-1"></div>

			<!-- Headings -->
			<div class="btn-group">
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('heading', { level: 1 })}
					onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
					{disabled}
					title="Heading 1"
				>
					H1
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('heading', { level: 2 })}
					onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
					{disabled}
					title="Heading 2"
				>
					H2
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('heading', { level: 3 })}
					onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
					{disabled}
					title="Heading 3"
				>
					H3
				</button>
			</div>

			<div class="divider divider-horizontal mx-0.5 my-1"></div>

			<!-- Lists -->
			<div class="btn-group">
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('bulletList')}
					onclick={() => editor?.chain().focus().toggleBulletList().run()}
					{disabled}
					title="Bullet List"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('orderedList')}
					onclick={() => editor?.chain().focus().toggleOrderedList().run()}
					{disabled}
					title="Numbered List"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
						/>
					</svg>
				</button>
			</div>

			<div class="divider divider-horizontal mx-0.5 my-1"></div>

			<!-- Block elements -->
			<div class="btn-group">
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('blockquote')}
					onclick={() => editor?.chain().focus().toggleBlockquote().run()}
					{disabled}
					title="Quote"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					onclick={() => editor?.chain().focus().setHorizontalRule().run()}
					{disabled}
					title="Horizontal Rule"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
					</svg>
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					class:btn-active={editor.isActive('link')}
					onclick={() => {
						if (editor?.isActive('link')) {
							editor?.chain().focus().unsetLink().run();
						} else {
							const url = prompt('Enter URL:');
							if (url) {
								editor?.chain().focus().setLink({ href: url }).run();
							}
						}
					}}
					{disabled}
					title="Insert Link"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
						/>
					</svg>
				</button>
			</div>

			<div class="flex-1"></div>

			<!-- Undo/Redo -->
			<div class="btn-group">
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					onclick={() => editor?.chain().focus().undo().run()}
					disabled={disabled || !editor.can().undo()}
					title="Undo (Ctrl+Z)"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
						/>
					</svg>
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					onclick={() => editor?.chain().focus().redo().run()}
					disabled={disabled || !editor.can().redo()}
					title="Redo (Ctrl+Shift+Z)"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Editor Content -->
	<div
		bind:this={element}
		class="prose prose-sm max-w-none p-4 focus-within:outline-none bg-base-100"
		style="min-height: {minHeight};"
	></div>
</div>

<style>
	/* Placeholder styling */
	:global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: oklch(var(--bc) / 0.4);
		pointer-events: none;
		height: 0;
	}

	/* Focus styling for the editor */
	:global(.tiptap:focus) {
		outline: none;
	}

	/* Prose styling adjustments for DaisyUI */
	:global(.tiptap h1) {
		font-size: 1.5rem;
		font-weight: 700;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
	}

	:global(.tiptap h2) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
	}

	:global(.tiptap h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	:global(.tiptap p) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.tiptap ul),
	:global(.tiptap ol) {
		margin-left: 1.5rem;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.tiptap ul) {
		list-style-type: disc;
	}

	:global(.tiptap ol) {
		list-style-type: decimal;
	}

	:global(.tiptap blockquote) {
		border-left: 4px solid oklch(var(--p));
		padding-left: 1rem;
		margin: 1rem 0;
		font-style: italic;
	}

	:global(.tiptap hr) {
		border: none;
		border-top: 1px solid oklch(var(--bc) / 0.2);
		margin: 1.5rem 0;
	}

	:global(.tiptap code) {
		background-color: oklch(var(--b2));
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: 0.875rem;
	}

	:global(.tiptap pre) {
		background-color: oklch(var(--b2));
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	:global(.tiptap pre code) {
		background: none;
		padding: 0;
	}
</style>
