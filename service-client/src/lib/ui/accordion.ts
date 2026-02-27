import { writable, type Writable } from "svelte/store";

export function oneAtATimeAccordion(index: number, opened: Writable<number[]>): void {
	opened.update((val) => {
		const closing = val.includes(index);
		if (closing) {
			return val.filter((i) => i !== index);
		} else {
			return [index];
		}
	});
}

export function multipleAccordion(index: number, opened: Writable<number[]>): void {
	opened.update((val) => {
		const closing = val.includes(index);
		if (closing) {
			return val.filter((i) => i !== index);
		} else {
			return [...val, index];
		}
	});
}

export function alwaysOneAccordion(index: number, opened: Writable<number[]>): void {
	opened.update((val) => {
		const same = val.includes(index);
		if (same) {
			return [index];
		}
		const closing = val.includes(index);
		if (closing) {
			return val.filter((i) => i !== index);
		} else {
			return [index];
		}
	});
}

export function useAccordion(
	func: (index: number, opened: Writable<number[]>) => void = oneAtATimeAccordion,
	init: number[] = [],
): {
	opened: Writable<number[]>;
	toggle: (index: number) => void;
} {
	const opened: Writable<number[]> = writable(init);
	function toggle(index: number): void {
		func(index, opened);
	}

	return {
		opened: opened,
		toggle: toggle,
	};
}
