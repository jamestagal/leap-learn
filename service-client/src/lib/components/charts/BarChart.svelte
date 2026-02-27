<script lang="ts">
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	let {
		labels,
		datasets,
		height = 200,
	}: {
		labels: string[];
		datasets: { label: string; data: number[]; backgroundColor?: string | string[] }[];
		height?: number;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'bar',
			data: { labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: datasets.length > 1 },
				},
				scales: {
					y: { beginAtZero: true },
				},
			},
		});
		return () => chart?.destroy();
	});
</script>

<div style="height: {height}px">
	<canvas bind:this={canvas}></canvas>
</div>
