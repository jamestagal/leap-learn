/**
 * Action to trap focus within a given HTML element.
 *
 * @param {HTMLElement} node - The HTML element to trap focus within.
 * @returns {{ destroy?: () => void }} - An object with an optional destroy method for cleanup.
 */
export function trapFocus(node: HTMLElement): { destroy?: () => void } {
	const focusableSelectors = [
		"a[href]",
		"button:not([disabled])",
		'input:not([disabled]):not([type="hidden"])',
		"select:not([disabled])",
		"textarea:not([disabled])",
		'[tabindex]:not([tabindex="-1"])',
	];

	let firstFocusableElement: HTMLElement | null = null;
	let lastFocusableElement: HTMLElement | null = null;

	function getFocusableElements(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(focusableSelectors.join(", "))).filter(
			(el) => el.offsetParent !== null,
		);
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key !== "Tab") return;

		const focusableElements = getFocusableElements();
		if (focusableElements.length === 0) return;

		firstFocusableElement = focusableElements[0] || null;
		lastFocusableElement = focusableElements[focusableElements.length - 1] || null;

		if (event.shiftKey) {
			// Shift + Tab
			if (document.activeElement === firstFocusableElement) {
				lastFocusableElement?.focus();
				event.preventDefault();
			}
		} else {
			// Tab
			if (document.activeElement === lastFocusableElement) {
				firstFocusableElement?.focus();
				event.preventDefault();
			}
		}
	}

	function trap(): void {
		document.addEventListener("keydown", handleKeyDown);
	}

	function untrap(): void {
		document.removeEventListener("keydown", handleKeyDown);
	}

	const dialogElement = node.closest("dialog");

	if (!dialogElement) {
		console.warn(
			"trapFocus action used on an element not inside a <dialog>. Focus trapping might not work as expected with showModal().",
		);
		trap();
		return {
			destroy() {
				untrap();
			},
		};
	}

	const observer = new MutationObserver((mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === "attributes" && mutation.attributeName === "open") {
				if (dialogElement.hasAttribute("open")) {
					trap();
				} else {
					untrap();
				}
			}
		}
	});

	observer.observe(dialogElement, { attributes: true });

	// Initial check in case the dialog is already open when the action is applied
	if (dialogElement.hasAttribute("open")) {
		trap();
	}

	return {
		destroy() {
			untrap();
			observer.disconnect();
		},
	};
}
