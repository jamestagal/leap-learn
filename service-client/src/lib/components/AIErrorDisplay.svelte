<script lang="ts">
	import { AIErrorCode, ERROR_MESSAGES } from '$lib/constants/ai-errors';

	interface Props {
		errorCode: AIErrorCode;
		onRetry?: () => void;
		onUpgrade?: () => void;
		onContactSupport?: () => void;
	}

	let { errorCode, onRetry, onUpgrade, onContactSupport }: Props = $props();

	const errorInfo = $derived(ERROR_MESSAGES[errorCode]);
</script>

<div class="alert alert-error">
	<svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
	<div>
		<h3 class="font-bold">{errorInfo.title}</h3>
		<div class="text-sm">{errorInfo.description}</div>
	</div>
	<div class="flex-none">
		{#if errorInfo.action === 'Retry' && onRetry}
			<button class="btn btn-sm" onclick={onRetry}>Try Again</button>
		{:else if errorInfo.action === 'Upgrade Plan' && onUpgrade}
			<button class="btn btn-sm btn-primary" onclick={onUpgrade}>Upgrade</button>
		{:else if errorInfo.action === 'Contact Support' && onContactSupport}
			<button class="btn btn-sm" onclick={onContactSupport}>Contact Support</button>
		{:else if errorInfo.action === 'Edit Consultation'}
			<span class="text-sm opacity-70">Add more details and try again</span>
		{:else if errorInfo.action === 'View Partial Results'}
			<span class="text-sm opacity-70">Some content was generated</span>
		{/if}
	</div>
</div>
