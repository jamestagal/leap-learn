<script>
	/**
	 * H5P Quick Start Guide Component
	 * Helps new users get started with H5P content creation
	 */
	
	import Button from '@components/Button.svelte';
	import Card from '@components/Card.svelte';
	
	// Icons
	import Download from '@icons/download.svelte';
	import Plus from '@icons/plus.svelte';
	import BookOpen from '@icons/book-open.svelte';
	import Play from '@icons/play.svelte';
	import ExternalLink from '@icons/external-link.svelte';
	import ChevronRight from '@icons/chevron-right.svelte';
	import Lightbulb from '@icons/lightbulb.svelte';
	
	// Props
	let { 
		showGuide = true,
		onDismiss = null 
	} = $props();
	
	// Quick start steps
	const steps = [
		{
			icon: Download,
			title: 'Install H5P Libraries',
			description: 'Browse and install content types from H5P Hub',
			action: 'Browse Hub',
			href: '/instructor/h5p-library/hub',
			color: 'primary-accent'
		},
		{
			icon: Plus,
			title: 'Create Interactive Content',
			description: 'Use the H5P Editor to build engaging learning materials',
			action: 'Create Content',
			href: '/instructor/h5p-library/create',
			color: 'success'
		},
		{
			icon: BookOpen,
			title: 'Add to Courses',
			description: 'Integrate your H5P content into course modules',
			action: 'My Courses',
			href: '/instructor/courses',
			color: 'warning'
		}
	];
	
	// Popular content types
	const popularTypes = [
		{ name: 'Interactive Video', desc: 'Add quizzes to videos', icon: '🎥' },
		{ name: 'Course Presentation', desc: 'Interactive slideshows', icon: '📊' },
		{ name: 'Question Set', desc: 'Combine different quiz types', icon: '❓' },
		{ name: 'Timeline', desc: 'Interactive timelines', icon: '📅' }
	];
	
	// Dismiss the guide
	function dismissGuide() {
		showGuide = false;
		if (onDismiss) {
			onDismiss();
		}
	}
</script>

{#if showGuide}
	<Card class="p-6 mb-6 bg-gradient-to-br from-primary-accent/5 to-primary-2 border-primary-accent/20">
		<div class="flex items-start justify-between mb-4">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-primary-accent/10 rounded-lg flex items-center justify-center">
					<Lightbulb size={20} class="text-primary-accent" />
				</div>
				<div>
					<h3 class="text-xl font-semibold text-secondary">Welcome to H5P!</h3>
					<p class="text-secondary-4 mt-1">Get started with interactive content creation in 3 easy steps</p>
				</div>
			</div>
			
			<button 
				onclick={dismissGuide}
				class="text-secondary-4 hover:text-secondary p-1 rounded transition-colors"
				aria-label="Dismiss guide"
			>
				✕
			</button>
		</div>
		
		<!-- Steps -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			{#each steps as step, index}
				<div class="flex items-start gap-3 p-4 bg-white rounded-lg border border-primary-4">
					<!-- Step number -->
					<div class="w-8 h-8 bg-{step.color}/10 text-{step.color} rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
						{index + 1}
					</div>
					
					<!-- Step content -->
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-2">
							<svelte:component this={step.icon} size={16} class="text-{step.color}" />
							<h4 class="font-semibold text-secondary">{step.title}</h4>
						</div>
						<p class="text-sm text-secondary-4 mb-3">{step.description}</p>
						<Button href={step.href} variant="outline" size="sm" class="text-{step.color} border-{step.color}/20 hover:bg-{step.color}/10">
							{step.action}
							<ChevronRight size={14} />
						</Button>
					</div>
				</div>
			{/each}
		</div>
		
		<!-- Popular Content Types -->
		<div class="border-t border-primary-4 pt-4">
			<h4 class="font-semibold text-secondary mb-3">Popular Content Types</h4>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
				{#each popularTypes as type}
					<div class="p-3 bg-white rounded-lg border border-primary-4 text-center">
						<div class="text-2xl mb-2">{type.icon}</div>
						<div class="font-medium text-sm text-secondary">{type.name}</div>
						<div class="text-xs text-secondary-4 mt-1">{type.desc}</div>
					</div>
				{/each}
			</div>
		</div>
		
		<!-- Action buttons -->
		<div class="flex items-center justify-between mt-6 pt-4 border-t border-primary-4">
			<div class="flex items-center gap-4">
				<Button href="/instructor/h5p-library/hub" variant="primary">
					<Download size={16} />
					Get Started with H5P Hub
				</Button>
				<Button 
					href="https://h5p.org/content-types-and-applications" 
					target="_blank"
					variant="outline"
				>
					<ExternalLink size={16} />
					See Examples
				</Button>
			</div>
			
			<Button onclick={dismissGuide} variant="ghost" size="sm">
				Skip Guide
			</Button>
		</div>
	</Card>
{/if}