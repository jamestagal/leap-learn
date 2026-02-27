<script lang="ts">
	/**
	 * SignatureField - Signature pad (Custom for WebKit)
	 *
	 * Uses canvas for drawing signatures.
	 * Outputs base64 encoded PNG image data.
	 */
	import PenTool from "lucide-svelte/icons/pen-tool";
	import Eraser from "lucide-svelte/icons/eraser";

	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: string | undefined;
		onchange: (value: string | null) => void;
	}

	let {
		id,
		name,
		label,
		description,
		required = false,
		disabled = false,
		error,
		value,
		onchange,
	}: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let isDrawing = $state(false);
	let hasDrawnSignature = $state(false);
	let hasSignature = $derived(hasDrawnSignature || !!value);

	$effect(() => {
		if (canvas && value) {
			// Load existing signature
			const ctx = canvas.getContext("2d");
			if (ctx) {
				const img = new Image();
				img.onload = (): void => {
					ctx.drawImage(img, 0, 0);
					hasDrawnSignature = true;
				};
				img.src = value;
			}
		}
	});

	function getCanvasContext(): CanvasRenderingContext2D | null {
		if (!canvas) return null;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 2;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
		}
		return ctx;
	}

	function getCoordinates(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();

		if (e instanceof MouseEvent) {
			return {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			};
		} else if (e.touches?.[0]) {
			return {
				x: e.touches[0].clientX - rect.left,
				y: e.touches[0].clientY - rect.top,
			};
		}
		return null;
	}

	function startDrawing(e: MouseEvent | TouchEvent): void {
		if (disabled) return;
		isDrawing = true;
		const ctx = getCanvasContext();
		const coords = getCoordinates(e);
		if (ctx && coords) {
			ctx.beginPath();
			ctx.moveTo(coords.x, coords.y);
		}
	}

	function draw(e: MouseEvent | TouchEvent): void {
		if (!isDrawing || disabled) return;
		const ctx = getCanvasContext();
		const coords = getCoordinates(e);
		if (ctx && coords) {
			ctx.lineTo(coords.x, coords.y);
			ctx.stroke();
			hasDrawnSignature = true;
		}
	}

	function stopDrawing(): void {
		if (isDrawing && canvas) {
			isDrawing = false;
			// Save signature as base64
			const dataUrl = canvas.toDataURL("image/png");
			onchange(dataUrl);
		}
	}

	function clearSignature(): void {
		if (!canvas || disabled) return;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			hasDrawnSignature = false;
			onchange(null);
		}
	}
</script>

<div class="form-control w-full">
	<label class="label" for={id}>
		<span class="label-text">
			{label}
			{#if required}
				<span class="text-error ml-1">*</span>
			{/if}
		</span>
	</label>

	{#if description}
		<p class="text-xs text-base-content/60 mb-1">{description}</p>
	{/if}

	<div
		class="relative border rounded-lg bg-base-100 overflow-hidden"
		class:border-base-300={!error}
		class:border-error={!!error}
		class:opacity-50={disabled}
	>
		<canvas
			bind:this={canvas}
			{id}
			width={400}
			height={150}
			class="w-full touch-none cursor-crosshair"
			class:cursor-not-allowed={disabled}
			onmousedown={startDrawing}
			onmousemove={draw}
			onmouseup={stopDrawing}
			onmouseleave={stopDrawing}
			ontouchstart={startDrawing}
			ontouchmove={draw}
			ontouchend={stopDrawing}
		></canvas>

		{#if !hasSignature && !disabled}
			<div
				class="absolute inset-0 flex items-center justify-center pointer-events-none"
			>
				<div class="text-center text-base-content/40">
					<PenTool class="h-6 w-6 mx-auto mb-1" />
					<p class="text-sm">Sign here</p>
				</div>
			</div>
		{/if}

		{#if hasSignature && !disabled}
			<button
				type="button"
				class="absolute top-2 right-2 btn btn-ghost btn-xs btn-square"
				onclick={clearSignature}
				title="Clear signature"
			>
				<Eraser class="h-4 w-4" />
			</button>
		{/if}
	</div>

	<input type="hidden" {name} value={value || ""} />

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
