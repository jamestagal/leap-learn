import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import adapterNode from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Use Cloudflare adapter for production/preview, Node for local dev
const isCloudflare = process.env.CF_PAGES === "1" || process.env.CLOUDFLARE === "1";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// Enable async in Svelte templates for remote functions
	compilerOptions: {
		experimental: {
			async: true,
		},
	},

	kit: {
		// Use Cloudflare adapter for deployments, Node adapter for local development
		adapter: isCloudflare ? adapterCloudflare() : adapterNode(),
		alias: {},
		experimental: {
			remoteFunctions: true,
			tracing: { server: true },
			instrumentation: { server: true },
		},
	},
};

export default config;
