import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async () => {
	const baseUrl = "https://app.leaplearn.au";
	const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

	const pages = [
		{ loc: "/", changefreq: "weekly", priority: "1.0" },
		{ loc: "/login", changefreq: "monthly", priority: "0.5" },
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(page) => `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
	)
	.join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "max-age=3600",
		},
	});
};
