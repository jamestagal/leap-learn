<script lang="ts">
    import { formatDate } from '$lib/utils/formatting';

    interface UsageData {
        used: number;
        limit: number;
        unlimited: boolean;
        percentage: number;
    }

    interface StatsData {
        hasSubscription: boolean;
        plan?: string;
        usage: UsageData;
        period?: {
            end: string;
            daysRemaining: number;
        };
    }

    interface Props {
        compact?: boolean | undefined;
    }

    let { compact = false }: Props = $props();

    let stats = $state<StatsData | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    $effect(() => {
        async function loadStats() {
            try {
                // TODO: Replace with actual API call for subscription usage
                loading = false;
            } catch (err) {
                error = err instanceof Error ? err.message : 'Failed to fetch usage stats';
                loading = false;
            }
        }
        loadStats();
    });

    let usagePercentage = $derived(
        stats?.usage ? (stats.usage.unlimited ? 0 : stats.usage.percentage) : 0
    );
    let usageColor = $derived(
        usagePercentage >= 90 ? 'text-red-500' :
        usagePercentage >= 80 ? 'text-yellow-500' :
        usagePercentage >= 60 ? 'text-blue-500' :
        'text-green-500'
    );
</script>

{#if loading}
    <div class="animate-pulse">
        <div class="h-4 bg-gray-700 rounded w-32"></div>
    </div>
{:else if error}
    <div class="text-red-500 text-sm">Error loading limits</div>
{:else if stats?.hasSubscription}
    {#if compact}
        <div class="flex items-center gap-2">
            <span class="text-sm">
                Usage:
                <span class={usageColor}>
                    {stats.usage.used}/{stats.usage.unlimited ? '\u221E' : stats.usage.limit}
                </span>
            </span>
            {#if !stats.usage.unlimited && usagePercentage >= 80}
                <span class="text-yellow-500">Warning</span>
            {/if}
        </div>
    {:else}
        <div class="card p-4">
            <h3 class="font-semibold mb-3">Usage</h3>

            <div class="space-y-3">
                <div class="flex justify-between text-sm">
                    <span>Plan</span>
                    <span class="font-medium capitalize">{stats.plan}</span>
                </div>

                <div>
                    <div class="flex justify-between text-sm mb-1">
                        <span>Used</span>
                        <span class={usageColor}>
                            {stats.usage.used} / {stats.usage.unlimited ? 'Unlimited' : stats.usage.limit}
                        </span>
                    </div>
                    {#if !stats.usage.unlimited}
                        <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                class="h-full transition-all duration-300"
                                class:bg-green-500={usagePercentage < 60}
                                class:bg-blue-500={usagePercentage >= 60 && usagePercentage < 80}
                                class:bg-yellow-500={usagePercentage >= 80 && usagePercentage < 90}
                                class:bg-red-500={usagePercentage >= 90}
                                style="width: {Math.min(usagePercentage, 100)}%"
                            />
                        </div>
                    {/if}
                </div>

                {#if stats.period}
                    <div class="text-xs text-secondary-1">
                        <div>Period ends: {formatDate(stats.period.end)}</div>
                        <div>{stats.period.daysRemaining} days remaining</div>
                    </div>
                {/if}

                {#if !stats.usage.unlimited && usagePercentage >= 80}
                    <div class="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 text-xs">
                        {#if usagePercentage >= 100}
                            <span class="text-red-500">Usage limit reached. Upgrade your plan.</span>
                        {:else}
                            <span class="text-yellow-500">Approaching usage limit. Consider upgrading your plan.</span>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{:else}
    <div class="text-secondary-1 text-sm">No active subscription</div>
{/if}
