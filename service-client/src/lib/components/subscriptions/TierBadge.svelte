<script>
    import { Crown, Star, Zap, Rocket, Building2 } from 'lucide-svelte';

    let { subscription = null } = $props();

    // Get plan name and styling info
    let planInfo = $derived.by(() => {
        if (!subscription || !subscription.plan) {
            return {
                name: 'Free',
                plan: 'free',
                bgColor: 'bg-gray-500/20',
                borderColor: 'border-gray-500/30',
                textColor: 'text-gray-100',
                iconColor: 'text-gray-400'
            };
        }

        const plan = subscription.plan.toLowerCase();
        
        switch (plan) {
            case 'starter':
                return {
                    name: 'Starter',
                    plan: 'starter',
                    bgColor: 'bg-blue-500/20',
                    borderColor: 'border-blue-500/30',
                    textColor: 'text-blue-100',
                    iconColor: 'text-blue-400'
                };
            case 'growth':
                return {
                    name: 'Growth',
                    plan: 'growth',
                    bgColor: 'bg-green-500/20',
                    borderColor: 'border-green-500/30',
                    textColor: 'text-green-100',
                    iconColor: 'text-green-400'
                };
            case 'pro':
            case 'professional':
                return {
                    name: 'Pro',
                    plan: 'pro',
                    bgColor: 'bg-purple-500/20',
                    borderColor: 'border-purple-500/30',
                    textColor: 'text-purple-100',
                    iconColor: 'text-purple-400'
                };
            case 'enterprise':
                return {
                    name: 'Enterprise',
                    plan: 'enterprise',
                    bgColor: 'bg-yellow-500/20',
                    borderColor: 'border-yellow-500/30',
                    textColor: 'text-yellow-100',
                    iconColor: 'text-yellow-400'
                };
            default:
                return {
                    name: subscription?.plan || 'Unknown',
                    plan: 'unknown',
                    bgColor: 'bg-gray-500/20',
                    borderColor: 'border-gray-500/30',
                    textColor: 'text-gray-100',
                    iconColor: 'text-gray-400'
                };
        }
    });
</script>

<a href="/settings/billing" class="badge card card-ring text-sm text-secondary gap-2 {planInfo.bgColor} {planInfo.borderColor} hover:opacity-80 transition-opacity">
    {#if planInfo.plan === 'starter'}
        <Star size={16} class="flex-shrink-0 {planInfo.iconColor}" />
    {:else if planInfo.plan === 'growth'}
        <Zap size={16} class="flex-shrink-0 {planInfo.iconColor}" />
    {:else if planInfo.plan === 'pro'}
        <Rocket size={16} class="flex-shrink-0 {planInfo.iconColor}" />
    {:else if planInfo.plan === 'enterprise'}
        <Crown size={16} class="flex-shrink-0 {planInfo.iconColor}" />
    {:else}
        <Building2 size={16} class="flex-shrink-0 {planInfo.iconColor}" />
    {/if}
    <span class="{planInfo.textColor} font-medium">{planInfo.name}</span>
</a>