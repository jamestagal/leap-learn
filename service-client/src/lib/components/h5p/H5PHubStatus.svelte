<script>
	/**
	 * H5P Hub Status Component
	 * Displays the current connection status and health of the H5P Hub integration
	 */
	
	// Icons
	import CheckCircle from '@icons/circle-check.svelte';
	import AlertCircle from '@icons/circle-alert.svelte';
	import XCircle from '@icons/circle-x.svelte';
	import Clock from '@icons/clock.svelte';
	import Wifi from '@icons/wifi.svelte';
	import WifiOff from '@icons/wifi-off.svelte';
	
	// Props
	let { 
		status = 'unknown',
		lastUpdate = null,
		showDetails = false,
		size = 'sm'
	} = $props();
	
	// Status configuration
	const statusConfig = {
		connected: {
			icon: CheckCircle,
			color: 'text-success',
			bgColor: 'bg-success/10',
			borderColor: 'border-success/20',
			label: 'Connected',
			description: 'H5P Hub is online and accessible'
		},
		offline: {
			icon: WifiOff,
			color: 'text-warning',
			bgColor: 'bg-warning/10',
			borderColor: 'border-warning/20',
			label: 'Offline',
			description: 'Using cached data - some features limited'
		},
		error: {
			icon: XCircle,
			color: 'text-danger',
			bgColor: 'bg-danger/10',
			borderColor: 'border-danger/20',
			label: 'Error',
			description: 'Connection failed - check configuration'
		},
		connecting: {
			icon: Clock,
			color: 'text-primary-accent',
			bgColor: 'bg-primary-accent/10',
			borderColor: 'border-primary-accent/20',
			label: 'Connecting',
			description: 'Establishing connection to H5P Hub'
		},
		unknown: {
			icon: AlertCircle,
			color: 'text-secondary-4',
			bgColor: 'bg-primary-2',
			borderColor: 'border-primary-4',
			label: 'Unknown',
			description: 'Hub status not yet determined'
		}
	};
	
	// Derived status configuration
	let config = $derived(statusConfig[status] || statusConfig.unknown);
	
	// Size configuration
	const sizeConfig = {
		xs: { icon: 12, text: 'text-xs', padding: 'px-2 py-1' },
		sm: { icon: 14, text: 'text-sm', padding: 'px-3 py-1.5' },
		md: { icon: 16, text: 'text-base', padding: 'px-4 py-2' },
		lg: { icon: 20, text: 'text-lg', padding: 'px-5 py-2.5' }
	};
	
	let sizeSettings = $derived(sizeConfig[size] || sizeConfig.sm);
	
	// Format last update time
	let lastUpdateText = $derived(() => {
		if (!lastUpdate) return null;
		
		const date = new Date(lastUpdate);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		
		return date.toLocaleDateString();
	});
	
	// Status pulse animation for connecting state
	let shouldPulse = $derived(status === 'connecting');
</script>

<div 
	class="flex items-center gap-2 rounded-lg border {config.bgColor} {config.borderColor} {sizeSettings.padding}"
	class:animate-pulse={shouldPulse}
>
	<!-- Status Icon -->
	<div class="flex items-center gap-1.5">
		{#if config.icon === CheckCircle}
			<CheckCircle size={sizeSettings.icon} class={config.color} />
		{:else if config.icon === AlertCircle}
			<AlertCircle size={sizeSettings.icon} class={config.color} />
		{:else if config.icon === XCircle}
			<XCircle size={sizeSettings.icon} class={config.color} />
		{:else if config.icon === Clock}
			<Clock size={sizeSettings.icon} class={config.color} />
		{:else if config.icon === WifiOff}
			<WifiOff size={sizeSettings.icon} class={config.color} />
		{:else}
			<AlertCircle size={sizeSettings.icon} class={config.color} />
		{/if}
		<span class="font-medium {sizeSettings.text} {config.color}">
			{config.label}
		</span>
	</div>
	
	<!-- Details (when enabled) -->
	{#if showDetails}
		<div class="border-l border-primary-4 pl-2 ml-1">
			<p class="text-xs text-secondary-4">
				{config.description}
			</p>
			
			{#if lastUpdateText}
				<div class="flex items-center gap-1 mt-1 text-xs text-secondary-4">
					<Clock size={10} />
					<span>Updated {lastUpdateText}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Tooltip for minimal display -->
{#if !showDetails}
	<div class="sr-only" role="tooltip">
		{config.description}
		{#if lastUpdateText}
			Last updated {lastUpdateText}
		{/if}
	</div>
{/if}