/**
 * Shared PDF Generation Utility
 *
 * Uses Gotenberg (Chromium-based) for HTML-to-PDF conversion.
 * Handles FormData assembly, fetch with timeout, and error handling.
 */

import { env } from "$env/dynamic/private";

const GOTENBERG_URL = env["GOTENBERG_URL"] || "http://localhost:3003";

/** Default timeout for Gotenberg requests (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

export interface PdfOptions {
	/** Paper width in inches (default: 8.27 for A4) */
	paperWidth?: string;
	/** Paper height in inches (default: 11.69 for A4) */
	paperHeight?: string;
	/** Top margin in inches (default: 0.4) */
	marginTop?: string;
	/** Bottom margin in inches (default: 0.4) */
	marginBottom?: string;
	/** Left margin in inches (default: 0.4) */
	marginLeft?: string;
	/** Right margin in inches (default: 0.4) */
	marginRight?: string;
	/** Print background graphics (default: true) */
	printBackground?: boolean;
	/** Prefer CSS @page size over paper dimensions (default: true) */
	preferCssPageSize?: boolean;
	/** Request timeout in milliseconds (default: 30000) */
	timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<PdfOptions> = {
	paperWidth: "8.27",
	paperHeight: "11.69",
	marginTop: "0.4",
	marginBottom: "0.4",
	marginLeft: "0.4",
	marginRight: "0.4",
	printBackground: true,
	preferCssPageSize: true,
	timeoutMs: DEFAULT_TIMEOUT_MS,
};

/**
 * Generate a PDF from HTML using Gotenberg.
 *
 * @param html - The HTML string to convert to PDF
 * @param options - Optional PDF generation options (A4 defaults)
 * @returns ArrayBuffer containing the PDF data
 * @throws Error with descriptive message on timeout or Gotenberg failure
 */
export async function generatePdf(
	html: string,
	options?: PdfOptions,
): Promise<ArrayBuffer> {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	const formData = new FormData();
	formData.append(
		"files",
		new Blob([html], { type: "text/html" }),
		"index.html",
	);
	formData.append("paperWidth", opts.paperWidth);
	formData.append("paperHeight", opts.paperHeight);
	formData.append("marginTop", opts.marginTop);
	formData.append("marginBottom", opts.marginBottom);
	formData.append("marginLeft", opts.marginLeft);
	formData.append("marginRight", opts.marginRight);
	formData.append("printBackground", String(opts.printBackground));
	formData.append("preferCssPageSize", String(opts.preferCssPageSize));

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

	try {
		const response = await fetch(
			`${GOTENBERG_URL}/forms/chromium/convert/html`,
			{
				method: "POST",
				body: formData,
				signal: controller.signal,
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Gotenberg error:", errorText);
			throw new Error("PDF generation failed");
		}

		return await response.arrayBuffer();
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") {
			throw new Error(
				"PDF generation timed out. Please try again later.",
			);
		}
		throw err;
	} finally {
		clearTimeout(timeout);
	}
}
