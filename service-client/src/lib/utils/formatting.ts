/**
 * Shared formatting utilities for currency, dates, and relative time.
 * Replaces scattered Intl.NumberFormat and toLocaleDateString calls.
 */

/**
 * Format a number as currency.
 * @param amount - The amount to format (number or string from decimal columns)
 * @param currency - ISO currency code (default: 'AUD')
 */
export function formatCurrency(amount: number | string | null | undefined, currency = 'AUD'): string {
	if (amount == null) return '$0.00';
	const num = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (isNaN(num)) return '$0.00';
	return new Intl.NumberFormat('en-AU', {
		style: 'currency',
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(num);
}

/**
 * Format a date for display.
 * @param date - Date object, ISO string, or null/undefined
 * @param style - 'short' (1/2/25), 'medium' (1 Feb 2025), 'long' (1 February 2025)
 */
export function formatDate(
	date: Date | string | null | undefined,
	style: 'short' | 'medium' | 'long' = 'medium'
): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '';

	const options: Intl.DateTimeFormatOptions = {
		short: { day: 'numeric', month: 'numeric', year: '2-digit' } as const,
		medium: { day: 'numeric', month: 'short', year: 'numeric' } as const,
		long: { day: 'numeric', month: 'long', year: 'numeric' } as const,
	}[style];

	return d.toLocaleDateString('en-AU', options);
}

/**
 * Format a date with time for display.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

/**
 * Format a relative time string (e.g., "2 hours ago", "3 days ago").
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '';

	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) return 'just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
	return formatDate(d, 'medium');
}
