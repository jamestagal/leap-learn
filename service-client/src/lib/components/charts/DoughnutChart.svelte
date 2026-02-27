<script lang="ts">
	import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	let {
		labels,
		data,
		backgroundColor,
		height = 200,
	}: {
		labels: string[];
		data: number[];
		backgroundColor: string[];
		height?: number;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{ data, backgroundColor }],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
				},
			},
		});
		return () => chart?.destroy();
	});
</script>

<div style="height: {height}px">
	<canvas bind:this={canvas}></canvas>
</div>
