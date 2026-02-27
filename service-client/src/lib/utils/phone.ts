/**
 * Australian Phone Number Utilities
 *
 * Formats and validates Australian phone numbers.
 * Mobile: 0412 345 678
 * Landline: (02) 9876 5432
 */

/**
 * Format Australian phone numbers
 * Mobile: 0412 345 678
 * Landline: (02) 9876 5432
 */
export function formatAustralianPhone(value: string): string {
	// Strip non-digits
	const digits = value.replace(/\D/g, "");

	// Mobile: starts with 04
	if (digits.startsWith("04")) {
		if (digits.length <= 4) return digits;
		if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
		return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
	}

	// Landline: starts with 0X (02, 03, 07, 08)
	if (digits.startsWith("0") && digits.length > 1) {
		const areaCode = digits.slice(0, 2);
		const rest = digits.slice(2);
		if (rest.length <= 4) return `(${areaCode}) ${rest}`;
		return `(${areaCode}) ${rest.slice(0, 4)} ${rest.slice(4, 8)}`;
	}

	return digits;
}

/**
 * Validate Australian phone number
 */
export function isValidAustralianPhone(value: string): boolean {
	const digits = value.replace(/\D/g, "");

	// Mobile: 04XX XXX XXX (10 digits starting with 04)
	if (digits.startsWith("04") && digits.length === 10) return true;

	// Landline: 0X XXXX XXXX (10 digits starting with 02, 03, 07, 08)
	if (/^0[2378]\d{8}$/.test(digits)) return true;

	return false;
}

/**
 * Strip formatting from phone number (return digits only)
 */
export function stripPhoneFormatting(value: string): string {
	return value.replace(/\D/g, "");
}

/**
 * Detect phone type
 */
export function getPhoneType(value: string): "mobile" | "landline" | "unknown" {
	const digits = value.replace(/\D/g, "");

	if (digits.startsWith("04")) return "mobile";
	if (/^0[2378]/.test(digits)) return "landline";
	return "unknown";
}
