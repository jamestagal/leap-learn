/**
 * HTML Sanitization Utility
 *
 * Uses DOMPurify to sanitize HTML before rendering with {@html}.
 * Prevents XSS attacks from user-generated or template-generated HTML content.
 */
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML string, allowing safe formatting tags.
 * Use this before any {@html} rendering of user/template content.
 */
export function sanitizeHtml(html: string): string {
	if (!html) return "";
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			"h1", "h2", "h3", "h4", "h5", "h6",
			"p", "br", "hr",
			"ul", "ol", "li",
			"strong", "em", "b", "i", "u", "s",
			"a", "img",
			"table", "thead", "tbody", "tr", "th", "td",
			"div", "span",
			"blockquote", "pre", "code",
			"sub", "sup",
		],
		ALLOWED_ATTR: [
			"href", "target", "rel",
			"src", "alt", "width", "height",
			"class", "style",
			"colspan", "rowspan",
		],
		ALLOW_DATA_ATTR: false,
	});
}
