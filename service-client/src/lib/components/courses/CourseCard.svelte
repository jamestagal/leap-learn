<script lang="ts">
	import {
		Eye,
		Pencil,
		Users,
		Clock,
		BookOpen,
		Puzzle,
	} from "lucide-svelte";

	interface Props {
		title: string;
		description?: string;
		status: string;
		itemCount: number;
		enrolmentCount: number;
		totalDurationMinutes?: number;
		coverImage?: string | null;
		href: string;
		editHref?: string;
		view?: "card" | "list";
		// Learner mode
		progress?: {
			completedItems: number;
			totalItems: number;
			percentage: number;
		} | null;
	}

	let {
		title,
		description = "",
		status,
		itemCount,
		enrolmentCount,
		totalDurationMinutes = 0,
		coverImage = null,
		href,
		editHref,
		view = "card",
		progress = null,
	}: Props = $props();

	function statusBadgeClass(s: string): string {
		switch (s) {
			case "published":
				return "badge-success";
			case "draft":
				return "badge-warning";
			case "archived":
				return "badge-ghost";
			default:
				return "badge-ghost";
		}
	}

	function formatDuration(minutes: number): string {
		if (!minutes) return "";
		if (minutes < 60) return `${minutes} min`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
</script>

{#if view === "list"}
	<!-- List View -->
	<div class="flex items-center gap-4 p-4 border border-base-300 rounded-lg hover:border-primary/40 transition-colors bg-base-100">
		<!-- Thumbnail -->
		<div class="w-20 h-14 bg-base-200 rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
			{#if coverImage}
				<img src={coverImage} alt={title} class="w-full h-full object-cover" />
			{:else}
				<BookOpen class="h-6 w-6 text-base-content/20" />
			{/if}
		</div>

		<!-- Info -->
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-0.5">
				<a href={href} class="font-semibold truncate hover:underline">{title}</a>
				<span class="badge badge-sm {statusBadgeClass(status)}">{status}</span>
			</div>
			{#if description}
				<p class="text-xs text-base-content/50 line-clamp-1">{description}</p>
			{/if}
		</div>

		<!-- Stats -->
		<div class="flex items-center gap-4 text-xs text-base-content/50 shrink-0">
			<span class="flex items-center gap-1">
				<Puzzle class="h-3 w-3" />
				{itemCount}
			</span>
			<span class="flex items-center gap-1">
				<Users class="h-3 w-3" />
				{enrolmentCount}
			</span>
			{#if totalDurationMinutes && totalDurationMinutes > 0}
				<span class="flex items-center gap-1">
					<Clock class="h-3 w-3" />
					{formatDuration(totalDurationMinutes)}
				</span>
			{/if}
		</div>

		<!-- Progress or Actions -->
		{#if progress}
			<div class="w-24 shrink-0">
				<div class="text-xs text-base-content/50 text-right mb-1">{progress.percentage}%</div>
				<progress class="progress progress-primary w-full" value={progress.percentage} max="100"></progress>
			</div>
		{/if}

		<div class="flex gap-1 shrink-0">
			<a href={href} class="btn btn-ghost btn-xs" title="View">
				<Eye class="h-3.5 w-3.5" />
			</a>
			{#if editHref}
				<a href={editHref} class="btn btn-ghost btn-xs" title="Edit">
					<Pencil class="h-3.5 w-3.5" />
				</a>
			{/if}
		</div>
	</div>
{:else}
	<!-- Card View -->
	<a
		href={href}
		class="card bg-base-100 border border-base-300 hover:border-primary/40 hover:shadow-md transition-all"
	>
		<!-- Thumbnail -->
		<div class="aspect-video bg-base-200 rounded-t-2xl overflow-hidden relative flex items-center justify-center">
			{#if coverImage}
				<img src={coverImage} alt={title} class="w-full h-full object-cover" />
			{:else}
				<BookOpen class="h-10 w-10 text-base-content/10" />
			{/if}
			<div class="absolute top-2 left-2">
				<span class="badge badge-sm {statusBadgeClass(status)}">{status}</span>
			</div>
		</div>

		<div class="card-body p-4">
			<h3 class="card-title text-base line-clamp-1">{title}</h3>
			{#if description}
				<p class="text-sm text-base-content/60 line-clamp-2">{description}</p>
			{/if}

			<!-- Stats row -->
			<div class="flex items-center gap-3 mt-2 text-xs text-base-content/50">
				<span class="flex items-center gap-1">
					<Puzzle class="h-3 w-3" />
					{itemCount} item{itemCount !== 1 ? "s" : ""}
				</span>
				<span class="flex items-center gap-1">
					<Users class="h-3 w-3" />
					{enrolmentCount}
				</span>
				{#if totalDurationMinutes && totalDurationMinutes > 0}
					<span class="flex items-center gap-1">
						<Clock class="h-3 w-3" />
						{formatDuration(totalDurationMinutes)}
					</span>
				{/if}
			</div>

			<!-- Progress bar (learner mode) -->
			{#if progress}
				<div class="mt-3">
					<div class="flex items-center justify-between text-xs text-base-content/60 mb-1">
						<span>{progress.completedItems} / {progress.totalItems} items</span>
						<span class="font-medium">{progress.percentage}%</span>
					</div>
					<progress class="progress progress-primary w-full" value={progress.percentage} max="100"></progress>
				</div>
			{/if}

			<!-- Actions row -->
			{#if editHref}
				<div class="card-actions mt-3">
					<a href={editHref} class="btn btn-ghost btn-xs gap-1" onclick={(e) => e.stopPropagation()}>
						<Pencil class="h-3 w-3" />
						Edit
					</a>
				</div>
			{/if}
		</div>
	</a>
{/if}
