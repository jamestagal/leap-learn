import tailwindcss from "@tailwindcss/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), sentrySvelteKit({ autoUploadSourceMaps: false }), sveltekit()],
	server: {
		port: 3000,
		strictPort: true,
		host: "0.0.0.0",
		fs: {
			strict: false,
		},
		hmr: {
			// HMR over WebSocket on the same port as the dev server
			clientPort: 3000,
		},
		watch: {
			// Use polling for Docker volume mounts (more reliable)
			usePolling: true,
			interval: 1000,
		},
	},
	test: {
		workspace: [
			{
				extends: "./vite.config.ts",
				plugins: [svelteTesting()],
				test: {
					name: "client",
					environment: "jsdom",
					clearMocks: true,
					include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
					exclude: ["src/lib/server/**"],
					setupFiles: ["./vitest-setup-client.ts"],
				},
			},
			{
				extends: "./vite.config.ts",
				test: {
					name: "server",
					environment: "node",
					include: ["src/**/*.{test,spec}.{js,ts}"],
					exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
					setupFiles: ["./src/lib/tests/setup.ts"],
				},
			},
		],
	},
});
