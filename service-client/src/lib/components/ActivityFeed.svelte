<script lang="ts">
	import type { ActivityItem } from '$lib/api/reporting.types';
	import { formatRelativeTime } from '$lib/utils/formatting';
	import {
		FileText,
		Users,
		Settings,
		Package,
		Activity,
		ArrowUpCircle,
		CreditCard,
		Unplug
	} from 'lucide-svelte';

	let { activities }: { activities: ActivityItem[] } = $props();

	// Map action prefixes to icons
	function getIcon(action: string) {
		if (action.startsWith('form')) return FileText;
		if (action.startsWith('client')) return Users;
		if (action.startsWith('member')) return Users;
		if (action.startsWith('settings') || action.startsWith('profile')) return Settings;
		if (action.startsWith('package') || action.startsWith('addon')) return Package;
		if (action.startsWith('subscription')) return ArrowUpCircle;
		if (action.startsWith('payment')) return CreditCard;
		if (action.startsWith('stripe')) return Unplug;
		return Activity;
	}

	// Format action into human-readable string
	function formatAction(action: string, userName: string | null): string {
		const name = userName ?? 'Someone';
		const parts = action.split('.');
		const entity = parts[0] ?? '';
		const verb = parts[1] ?? '';

		const entityLabels: Record<string, string> = {
			form: 'form',
			client: 'client',
			member: 'team member',
			settings: 'settings',
			profile: 'profile',
			package: 'package',
			addon: 'add-on',
			organisation: 'organisation',
			data: 'data',
			subscription: 'subscription',
			payment: 'payment',
			stripe: 'Stripe account'
		};

		const entityLabel = entityLabels[entity] ?? entity;

		switch (verb) {
			case 'created':
				return `${name} created a ${entityLabel}`;
			case 'updated':
				return `${name} updated a ${entityLabel}`;
			case 'deleted':
				return `${name} deleted a ${entityLabel}`;
			case 'sent':
				return `${name} sent a ${entityLabel}`;
			case 'signed':
				return `${name} signed a ${entityLabel}`;
			case 'paid':
				return `${name} marked a ${entityLabel} as paid`;
			case 'invited':
				return `${name} invited a ${entityLabel}`;
			case 'removed':
				return `${name} removed a ${entityLabel}`;
			case 'archived':
				return `${name} archived a ${entityLabel}`;
			case 'completed':
				return `${name} completed a ${entityLabel}`;
			case 'exported':
				return `${name} exported ${entityLabel}`;
			case 'upgraded':
				return `${name} upgraded the ${entityLabel}`;
			case 'downgraded':
				return `${name} downgraded the ${entityLabel}`;
			case 'received':
				return `Payment received`;
			case 'connected':
				return `${name} connected ${entityLabel}`;
			case 'disconnected':
				return `${name} disconnected ${entityLabel}`;
			case 'account_updated':
				return `${entityLabel} status updated`;
			case 'status_changed':
				return `${name} changed ${entityLabel} status`;
			default:
				return `${name} ${verb} ${entityLabel}`;
		}
	}
</script>

{#if activities.length === 0}
	<div class="text-center py-8 text-base-content/60">
		<Activity class="h-8 w-8 mx-auto mb-2 opacity-40" />
		<p>No recent activity</p>
		<p class="text-sm mt-1">Activity will appear here as you work.</p>
	</div>
{:else}
	<div class="space-y-1">
		{#each activities as activity (activity.id)}
			{@const Icon = getIcon(activity.action)}
			<div
				class="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-base-200/50 transition-colors"
			>
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-base-200"
				>
					<Icon class="h-4 w-4 text-base-content/60" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm">{formatAction(activity.action, activity.userName)}</p>
					<p class="text-xs text-base-content/50">{formatRelativeTime(activity.createdAt)}</p>
				</div>
			</div>
		{/each}
	</div>
{/if}
