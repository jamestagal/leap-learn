<script lang="ts">
	import { Blocks, LayoutDashboard, Building2, Users, Palette, Globe } from 'lucide-svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const features: { icon: any; title: string; description: string }[] = [
		{
			icon: Blocks,
			title: '40+ Interactive Content Types',
			description:
				'Quizzes, drag-and-drop, interactive video, fill-in-the-blanks, presentations — all powered by H5P.'
		},
		{
			icon: LayoutDashboard,
			title: 'Visual Course Builder',
			description:
				'Drag content into structured courses with sections and modules. Reorder with a click.'
		},
		{
			icon: Building2,
			title: 'Multi-Org Workspaces',
			description:
				'Each organisation gets its own workspace with separate content, members, and settings.'
		},
		{
			icon: Users,
			title: 'Team Collaboration',
			description:
				'Invite trainers and admins with role-based permissions. Owner, admin, and member roles built in.'
		},
		{
			icon: Palette,
			title: 'Your Brand, Your Platform',
			description:
				"Custom colours and logo per organisation. Learners see your brand, not ours."
		},
		{
			icon: Globe,
			title: 'No Install, No Plugins',
			description:
				'Runs in the browser. No LMS plugins to configure. Share a link and your learners are in.'
		}
	];

	let sectionEl: HTMLElement | undefined = $state();
	let visible = $state(false);

	$effect(() => {
		if (!sectionEl) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) visible = true;
			},
			{ threshold: 0.08 }
		);
		obs.observe(sectionEl);
		return () => obs.disconnect();
	});
</script>

<section bind:this={sectionEl} class="py-16 md:py-24 bg-base-200 bg-dot-pattern relative">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
		<div
			class="text-center max-w-2xl mx-auto mb-14"
			class:animate-fade-up={visible}
			style:opacity={visible ? undefined : '0'}
		>
			<h2 class="font-zodiak text-2xl md:text-3xl lg:text-4xl font-bold text-base-content tracking-tight">
				Built for Educators <span class="text-primary">Who Want More</span>
			</h2>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each features as feature, i}
				<div
					class="card bg-base-100 border border-base-300/50 shadow-sm
						   transition-all duration-300 ease-out
						   hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
					class:animate-fade-up={visible && i === 0}
					class:animate-fade-up-delay-1={visible && i === 1}
					class:animate-fade-up-delay-2={visible && i === 2}
					class:animate-fade-up-delay-3={visible && i === 3}
					class:animate-fade-up-delay-4={visible && i === 4}
					class:animate-fade-up-delay-5={visible && i === 5}
					style:opacity={visible ? undefined : '0'}
				>
					<div class="card-body">
						<div
							class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"
						>
							<feature.icon class="w-5 h-5 text-primary" />
						</div>
						<h3 class="font-semibold text-base-content text-lg mt-3">{feature.title}</h3>
						<p class="text-base-content/60 text-sm leading-relaxed">
							{feature.description}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
