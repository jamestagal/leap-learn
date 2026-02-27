<script lang="ts">
	/**
	 * FormBranding - Wraps form content with organisation branding
	 *
	 * Applies organisation colors, logo, and styling to the form container.
	 * Generates DaisyUI theme CSS at runtime with premium visual design.
	 */
	import type { Snippet } from "svelte";
	import type { ResolvedBranding, FormBrandingOverrides } from "$lib/types/branding";
	import { generateDaisyTheme, hashString, radiusMap } from "./utils/theme-generator";

	interface Props {
		branding?: ResolvedBranding | undefined;
		formOverrides?: FormBrandingOverrides | undefined;
		children: Snippet;
	}

	let { branding, formOverrides, children }: Props = $props();

	// Generate unique theme name for this organisation
	let themeName = $derived(
		branding ? `leaplearn-${hashString(JSON.stringify(branding.colors))}` : "light"
	);

	// Generate DaisyUI theme CSS
	let themeCSS = $derived(branding ? generateDaisyTheme(themeName, branding) : "");

	// Merge organisation branding with form overrides
	let resolved = $derived({
		...branding,
		...formOverrides,
		colors: { ...branding?.colors, ...formOverrides?.colors },
		typography: { ...branding?.typography, ...formOverrides?.typography },
		borders: { ...branding?.borders, ...formOverrides?.borders },
		layout: { ...branding?.layout, ...formOverrides?.layout },
	});

	// Compute layout values
	let maxWidth = $derived(resolved.layout?.maxWidth || "720px");
	let borderRadius = $derived(radiusMap[resolved.borders?.cardRadius || "xl"]);

	// Background styles
	let backgroundStyle = $derived.by(() => {
		const bg = formOverrides?.background;
		if (!bg) return "";

		let style = "";
		if (bg.color) style += `background-color: ${bg.color};`;
		if (bg.image) {
			style += `background-image: url('${bg.image}');`;
			style += "background-size: cover; background-position: center;";
		}
		return style;
	});

	// Premium font imports - using refined, professional fonts
	let fontImports = $derived.by(() => {
		// Always include premium fonts for the form
		const baseFonts = ["DM+Sans:wght@400;500;600;700", "DM+Serif+Display:wght@400"];

		const customFonts: string[] = [];
		const t = resolved.typography;

		if (t?.headingFont && !t.headingFont.includes("system")) {
			const fontName = (t.headingFont.split(",")[0] ?? "").trim().replace(/['"]/g, "");
			if (fontName) customFonts.push(fontName.replace(/ /g, "+"));
		}
		if (t?.bodyFont && !t.bodyFont.includes("system")) {
			const fontName = (t.bodyFont.split(",")[0] ?? "").trim().replace(/['"]/g, "");
			if (fontName && !customFonts.includes(fontName.replace(/ /g, "+"))) {
				customFonts.push(fontName.replace(/ /g, "+"));
			}
		}

		const allFonts = [...baseFonts, ...customFonts.map(f => `${f}:wght@400;500;600;700`)];
		return `@import url('https://fonts.googleapis.com/css2?family=${allFonts.join("&family=")}&display=swap');`;
	});
</script>

<!-- Inject theme CSS and premium styles -->
<svelte:head>
	{#if fontImports}
		{@html `<style>${fontImports}</style>`}
	{/if}
	{#if themeCSS}
		{@html `<style>${themeCSS}</style>`}
	{/if}
</svelte:head>

<!-- Form wrapper with theme applied -->
<div data-theme={themeName} class="form-branding-wrapper min-h-screen" style={backgroundStyle}>
	<!-- Subtle gradient background -->
	<div class="form-bg-gradient"></div>

	<!-- Subtle noise texture overlay for depth -->
	<div class="form-noise-overlay"></div>

	{#if formOverrides?.background?.overlay}
		<div class="absolute inset-0" style="background-color: {formOverrides.background.overlay};"></div>
	{/if}

	<div
		class="form-branding-container relative mx-auto py-8 sm:py-12 lg:py-16 px-4"
		style="max-width: {maxWidth};"
	>
		<!-- Logo with refined presentation -->
		{#if resolved.logo?.url && formOverrides?.header?.showLogo !== false}
			<div class="mb-8 sm:mb-10 {resolved.logo.position === 'center' ? 'text-center' : ''}">
				<div class="inline-flex items-center justify-center p-2 rounded-xl bg-base-100/80 backdrop-blur-sm shadow-sm border border-base-200/50">
					<img
						src={resolved.logo.url}
						alt="Logo"
						class="logo-img"
						style="height: {resolved.logo.height || 44}px;"
					/>
				</div>
			</div>
		{/if}

		<!-- Header with premium typography -->
		{#if formOverrides?.header?.title}
			<div class="mb-8 sm:mb-10 text-center">
				<h1 class="form-title text-2xl sm:text-3xl lg:text-4xl font-semibold text-base-content tracking-tight">
					{formOverrides.header.title}
				</h1>
				{#if formOverrides.header.subtitle}
					<p class="mt-3 sm:mt-4 text-base sm:text-lg text-base-content/60 max-w-lg mx-auto leading-relaxed">
						{formOverrides.header.subtitle}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Premium Form Card -->
		<div
			class="form-card bg-base-100 shadow-xl shadow-base-content/5 ring-1 ring-base-content/5"
			style="border-radius: {borderRadius};"
		>
			<!-- Subtle top accent line -->
			<div class="form-card-accent" style="border-radius: {borderRadius} {borderRadius} 0 0;"></div>

			<div class="p-6 sm:p-8 lg:p-10">
				{@render children()}
			</div>
		</div>

		<!-- Refined Footer -->
		{#if formOverrides?.footer?.text || formOverrides?.footer?.showPoweredBy !== false}
			<div class="mt-8 sm:mt-10 text-center">
				{#if formOverrides?.footer?.text}
					<p class="text-sm text-base-content/50">{formOverrides.footer.text}</p>
				{/if}
				{#if formOverrides?.footer?.showPoweredBy !== false}
					<p class="mt-3 text-xs text-base-content/40 flex items-center justify-center gap-1.5">
						<span>Powered by</span>
						<a href="https://leaplearn.au" class="font-medium text-base-content/50 hover:text-primary transition-colors">
							LeapLearn
						</a>
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.form-branding-wrapper {
		font-family: 'DM Sans', system-ui, sans-serif;
		position: relative;
		overflow: hidden;
		/* Force light color scheme to prevent browser dark mode interference */
		color-scheme: light;
		/* Ensure background and text colors are explicitly set */
		background-color: hsl(var(--b2));
		color: hsl(var(--bc));
	}

	/* Premium gradient background */
	.form-bg-gradient {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 80% 50% at 50% -20%, hsla(var(--p), 0.08), transparent),
			radial-gradient(ellipse 60% 40% at 100% 100%, hsla(var(--s), 0.05), transparent),
			linear-gradient(to bottom, hsla(var(--b2), 1), hsla(var(--b1), 1));
		z-index: 0;
	}

	/* Subtle noise texture for depth */
	.form-noise-overlay {
		position: absolute;
		inset: 0;
		opacity: 0.4;
		z-index: 1;
		pointer-events: none;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
	}

	.form-branding-container {
		position: relative;
		z-index: 2;
	}

	/* Premium typography */
	.form-title {
		font-family: 'DM Serif Display', 'DM Sans', serif;
		letter-spacing: -0.02em;
	}

	.form-branding-wrapper :global(h1),
	.form-branding-wrapper :global(h2),
	.form-branding-wrapper :global(h3) {
		font-family: 'DM Sans', var(--font-heading, system-ui, sans-serif);
		letter-spacing: -0.01em;
	}

	/* Premium card styling */
	.form-card {
		position: relative;
		overflow: hidden;
		transition: box-shadow 0.3s ease, transform 0.3s ease;
		/* Explicit colors to prevent dark mode interference */
		background-color: hsl(var(--b1));
		color: hsl(var(--bc));
	}

	/* Subtle primary color accent at top of card */
	.form-card-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, hsl(var(--p)), hsla(var(--s), 0.8));
	}

	/* Logo image styling */
	.logo-img {
		display: block;
		object-fit: contain;
	}

	/* Enhanced input focus states */
	.form-branding-wrapper :global(.input:focus),
	.form-branding-wrapper :global(.textarea:focus),
	.form-branding-wrapper :global(.select:focus) {
		border-color: hsla(var(--p), 0.5);
		box-shadow: 0 0 0 3px hsla(var(--p), 0.1);
		outline: none;
	}

	/* Refined button hover states */
	.form-branding-wrapper :global(.btn-primary) {
		transition: all 0.2s ease;
	}

	.form-branding-wrapper :global(.btn-primary:hover:not(:disabled)) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px hsla(var(--p), 0.3);
	}

	.form-branding-wrapper :global(.btn-primary:active:not(:disabled)) {
		transform: translateY(0);
	}

	/* Smooth transitions for interactive elements */
	.form-branding-wrapper :global(.input),
	.form-branding-wrapper :global(.textarea),
	.form-branding-wrapper :global(.select),
	.form-branding-wrapper :global(.checkbox),
	.form-branding-wrapper :global(.radio) {
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
</style>
