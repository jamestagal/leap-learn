<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		contentId: string;
		organisationId: string;
		courseItemId?: string;
		enrolmentId?: string;
		onXAPIStatement?: (statement: Record<string, unknown>) => void;
		onComplete?: () => void;
		onScore?: (score: number, maxScore: number) => void;
		className?: string;
	}

	let {
		contentId,
		organisationId,
		onXAPIStatement,
		onComplete,
		onScore,
		className = "",
	}: Props = $props();

	let iframeEl: HTMLIFrameElement | undefined = $state();
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let iframeHeight = $state(600);

	// Build embed URL with orgId param
	let embedUrl = $derived(
		`/api/h5p/play/${contentId}/embed?orgId=${organisationId}`,
	);

	function handleIframeLoad() {
		loading = false;
	}

	function handleIframeError() {
		loading = false;
		errorMsg = "Failed to load H5P content";
	}

	// Listen for postMessage events from the iframe (xAPI + resize)
	function handleMessage(event: MessageEvent) {
		if (!iframeEl) return;

		const data = event.data;
		if (!data || typeof data !== "object") return;

		// Handle xAPI statements from H5P
		if (data.context === "h5p" && data.action === "xAPI") {
			const statement = data.statement;
			if (!statement) return;

			onXAPIStatement?.(statement);

			// Check for completion
			const verb = statement?.verb as { id?: string } | undefined;
			if (verb?.id === "http://adlnet.gov/expapi/verbs/completed") {
				onComplete?.();
			}

			// Check for score
			const result = statement?.result as
				| { score?: { raw?: number; max?: number } }
				| undefined;
			if (result?.score && typeof result.score.raw === "number") {
				onScore?.(result.score.raw, result.score.max ?? 0);
			}
		}

		// Handle resize from H5P iframe
		if (data.context === "h5p" && data.action === "resize") {
			if (typeof data.scrollHeight === "number" && data.scrollHeight > 0) {
				iframeHeight = data.scrollHeight;
			}
		}
	}

	onMount(() => {
		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	});

	// Re-trigger loading state when contentId changes
	let prevContentId = contentId;
	$effect(() => {
		if (contentId !== prevContentId) {
			prevContentId = contentId;
			loading = true;
			errorMsg = null;
		}
	});
</script>

<div class="h5p-player-wrapper {className}">
	{#if loading}
		<div class="card bg-base-100 border border-base-300 overflow-hidden">
			<div class="w-full min-h-[500px] flex items-center justify-center">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		</div>
	{/if}

	{#if errorMsg}
		<div class="alert alert-error">
			<span>{errorMsg}</span>
			<button
				class="btn btn-sm btn-ghost"
				onclick={() => {
					errorMsg = null;
					loading = true;
				}}>Retry</button
			>
		</div>
	{:else}
		<iframe
			bind:this={iframeEl}
			src={embedUrl}
			class="h5p-iframe"
			class:hidden={loading}
			style="width:100%;height:{iframeHeight}px;border:none;"
			title="H5P Content"
			onload={handleIframeLoad}
			onerror={handleIframeError}
			allow="fullscreen"
		></iframe>
	{/if}
</div>

<style>
	.h5p-player-wrapper {
		width: 100%;
	}

	.h5p-iframe {
		width: 100%;
		min-height: 400px;
	}
</style>
