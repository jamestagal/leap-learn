<script lang="ts">
	import { Star, MoreVertical, Pencil, Copy, Trash2, GripVertical } from 'lucide-svelte';

	interface PackageData {
		id: string;
		name: string;
		description: string | null;
		pricingModel: string;
		monthlyPrice: string | null;
		oneTimePrice: string | null;
		setupFee: string | null;
		minimumTermMonths: number | null;
		isFeatured: boolean;
		isActive: boolean;
	}

	interface Props {
		pkg: PackageData;
		organisationSlug: string;
		onDuplicate?: (id: string) => void;
		onDelete?: (id: string) => void;
		isDragging?: boolean;
	}

	let { pkg, organisationSlug, onDuplicate, onDelete, isDragging = false }: Props = $props();

	let menuOpen = $state(false);

	// Format price display
	function formatPrice(price: string | null): string {
		if (!price || price === '0.00') return '-';
		return `$${parseFloat(price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
	}

	// Get pricing model label
	function getPricingLabel(model: string): string {
		switch (model) {
			case 'subscription':
				return 'Monthly';
			case 'lump_sum':
				return 'One-time';
			case 'hybrid':
				return 'Hybrid';
			default:
				return model;
		}
	}

	// Get primary price based on model
	let primaryPrice = $derived.by(() => {
		switch (pkg.pricingModel) {
			case 'subscription':
				return { label: '/month', value: formatPrice(pkg.monthlyPrice) };
			case 'lump_sum':
				return { label: 'one-time', value: formatPrice(pkg.oneTimePrice) };
			case 'hybrid':
				return { label: '/month', value: formatPrice(pkg.monthlyPrice) };
			default:
				return { label: '', value: '-' };
		}
	});
</script>

<div
	class="card bg-base-100 border border-base-300 transition-all duration-200"
	class:opacity-50={isDragging}
	class:ring-2={isDragging}
	class:ring-primary={isDragging}
>
	<div class="card-body p-4">
		<div class="flex items-start justify-between gap-3">
			<!-- Drag handle -->
			<div class="cursor-grab text-base-content/30 hover:text-base-content/60 mt-1">
				<GripVertical class="h-5 w-5" />
			</div>

			<!-- Package info -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<h3 class="font-semibold truncate">{pkg.name}</h3>
					{#if pkg.isFeatured}
						<div class="badge badge-warning badge-sm gap-1">
							<Star class="h-3 w-3" />
							Featured
						</div>
					{/if}
					{#if !pkg.isActive}
						<div class="badge badge-ghost badge-sm">Inactive</div>
					{/if}
				</div>

				<div class="flex items-baseline gap-1 mt-1">
					<span class="text-xl font-bold">{primaryPrice.value}</span>
					<span class="text-sm text-base-content/60">{primaryPrice.label}</span>
				</div>

				{#if pkg.pricingModel === 'hybrid' && pkg.setupFee && pkg.setupFee !== '0.00'}
					<div class="text-sm text-base-content/60 mt-1">
						+ {formatPrice(pkg.setupFee)} setup
					</div>
				{/if}

				<div class="flex items-center gap-2 mt-2">
					<span
						class="badge badge-sm"
						class:badge-primary={pkg.pricingModel === 'subscription'}
						class:badge-secondary={pkg.pricingModel === 'lump_sum'}
						class:badge-accent={pkg.pricingModel === 'hybrid'}
					>
						{getPricingLabel(pkg.pricingModel)}
					</span>
					{#if pkg.minimumTermMonths && pkg.minimumTermMonths > 1}
						<span class="text-xs text-base-content/60">
							{pkg.minimumTermMonths} month min
						</span>
					{/if}
				</div>

				{#if pkg.description}
					<p class="text-sm text-base-content/60 mt-2 line-clamp-2">{pkg.description}</p>
				{/if}
			</div>

			<!-- Actions dropdown -->
			<div class="dropdown dropdown-end">
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-square"
					onclick={() => (menuOpen = !menuOpen)}
				>
					<MoreVertical class="h-4 w-4" />
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<ul
						class="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-2 shadow-lg border border-base-300"
						onclick={() => (menuOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
					>
						<li>
							<a href="/{organisationSlug}/settings/packages/{pkg.id}">
								<Pencil class="h-4 w-4" />
								Edit
							</a>
						</li>
						<li>
							<button type="button" onclick={() => onDuplicate?.(pkg.id)}>
								<Copy class="h-4 w-4" />
								Duplicate
							</button>
						</li>
						<li>
							<button
								type="button"
								class="text-error"
								onclick={() => onDelete?.(pkg.id)}
							>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						</li>
					</ul>
				{/if}
			</div>
		</div>
	</div>
</div>
