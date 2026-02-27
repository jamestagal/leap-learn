import puppeteer from "@cloudflare/puppeteer";

interface Env {
	BROWSER: Fetcher;
}

const NAVIGATION_TIMEOUT = 30000;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (request.method === "GET" && path === "/health") {
			return Response.json({ status: "ok" });
		}

		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		try {
			const body = await request.json<Record<string, unknown>>();

			switch (path) {
				case "/markdown":
					return await handleMarkdown(env, body);
				case "/links":
					return await handleLinks(env, body);
				case "/scrape":
					return await handleScrape(env, body);
				default:
					return Response.json({ error: "Not found" }, { status: 404 });
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Internal server error";
			return Response.json({ error: message }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;

async function withBrowser<T>(env: Env, targetUrl: string, fn: (page: puppeteer.Page) => Promise<T>): Promise<T> {
	const parsed = new URL(targetUrl);
	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error("URL must use http or https protocol");
	}

	const browser = await puppeteer.launch(env.BROWSER);
	const page = await browser.newPage();
	try {
		await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: NAVIGATION_TIMEOUT });
		return await fn(page);
	} finally {
		await page.close();
		await browser.close();
	}
}

async function handleMarkdown(env: Env, body: Record<string, unknown>): Promise<Response> {
	const targetUrl = body.url as string;
	if (!targetUrl) {
		return Response.json({ error: "url is required" }, { status: 400 });
	}

	const result = await withBrowser(env, targetUrl, async (page) => {
		const title = await page.title();

		const content = await page.evaluate(() => {
			const selectors = [
				"nav", "header", "footer", "script", "style", "noscript", "iframe",
				'[role="navigation"]', ".sidebar", "#sidebar", ".menu", ".nav",
				".cookie-banner", ".advertisement", ".ads",
			];
			selectors.forEach((sel) => {
				document.querySelectorAll(sel).forEach((el) => el.remove());
			});

			const main =
				document.querySelector("main, article, [role=\"main\"], .content, #content") ||
				document.body;

			const lines: string[] = [];

			function walk(node: Node) {
				if (node.nodeType === Node.TEXT_NODE) {
					const text = node.textContent?.trim();
					if (text) lines.push(text);
					return;
				}

				if (node.nodeType !== Node.ELEMENT_NODE) return;
				const el = node as Element;
				const tag = el.tagName.toLowerCase();

				if (["script", "style", "noscript"].includes(tag)) return;

				const headingLevel = ["h1", "h2", "h3", "h4", "h5", "h6"].indexOf(tag);
				if (headingLevel !== -1) {
					const text = el.textContent?.trim();
					if (text) {
						lines.push("");
						lines.push("#".repeat(headingLevel + 1) + " " + text);
						lines.push("");
					}
					return;
				}

				if (tag === "li") {
					const text = el.textContent?.trim();
					if (text) lines.push("- " + text);
					return;
				}

				if (tag === "br") {
					lines.push("");
					return;
				}

				for (const child of Array.from(node.childNodes)) {
					walk(child);
				}

				if (["p", "div", "section", "blockquote"].includes(tag)) {
					lines.push("");
				}
			}

			walk(main);

			return lines
				.join("\n")
				.replace(/\n{3,}/g, "\n\n")
				.trim();
		});

		return { title, content };
	});

	return Response.json({
		content: result.title ? `# ${result.title}\n\n${result.content}` : result.content,
		title: result.title,
		url: targetUrl,
	});
}

async function handleLinks(env: Env, body: Record<string, unknown>): Promise<Response> {
	const targetUrl = body.url as string;
	if (!targetUrl) {
		return Response.json({ error: "url is required" }, { status: 400 });
	}

	const links = await withBrowser(env, targetUrl, async (page) => {
		return await page.evaluate((baseUrl: string) => {
			const anchors = Array.from(document.querySelectorAll("a[href]"));
			const seen = new Set<string>();
			const results: { url: string; text: string }[] = [];

			for (const a of anchors) {
				const href = a.getAttribute("href");
				if (!href) continue;

				let absolute: string;
				try {
					absolute = new URL(href, baseUrl).toString();
				} catch {
					continue;
				}

				if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

				// Remove fragment
				const noFragment = absolute.split("#")[0];
				if (seen.has(noFragment)) continue;
				seen.add(noFragment);

				const text = (a.textContent || "").trim();
				results.push({ url: noFragment, text });
			}

			return results;
		}, targetUrl);
	});

	return Response.json({ links, url: targetUrl });
}

async function handleScrape(env: Env, body: Record<string, unknown>): Promise<Response> {
	const targetUrl = body.url as string;
	const selectors = body.selectors as Record<string, string> | undefined;
	if (!targetUrl) {
		return Response.json({ error: "url is required" }, { status: 400 });
	}
	if (!selectors || typeof selectors !== "object") {
		return Response.json({ error: "selectors object is required" }, { status: 400 });
	}

	const data = await withBrowser(env, targetUrl, async (page) => {
		return await page.evaluate((sels: Record<string, string>) => {
			const result: Record<string, string | null> = {};
			for (const [key, selector] of Object.entries(sels)) {
				const el = document.querySelector(selector);
				result[key] = el ? (el.textContent || "").trim() : null;
			}
			return result;
		}, selectors);
	});

	return Response.json({ data, url: targetUrl });
}
