import type { Toast } from "../types";
import { getContext, setContext, hasContext } from "svelte";

class ToastState {
	toasts = $state<Toast[]>([]);
	timeoutMap = new Map<symbol, NodeJS.Timeout>();

	showToast(toast: Toast): void {
		setTimeout(() => {
			this.toasts = [...this.toasts, toast];

			const t = setTimeout(() => {
				this.toasts = this.toasts.filter((t) => t.id !== toast.id);
			}, toast.duration);
			this.timeoutMap.set(toast.id, t);
		}, 0);
	}
	removeToast(id: symbol): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
		const t = this.timeoutMap.get(id);
		if (t) {
			clearTimeout(t);
		}
		this.timeoutMap.delete(id);
	}
	success(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "success",
			duration: 5000,
		});
	}
	error(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "error",
			duration: 8000,
		});
	}
	warning(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "warning",
			duration: 5000,
		});
	}
	info(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "info",
			duration: 5000,
		});
	}
}

const toastCtx = Symbol("toastCtx");

// Module-level fallback for when context is unavailable during SSR edge cases
let fallbackToast: ToastState | null = null;

export function setToast(): ToastState {
	const toastState = new ToastState();
	try {
		setContext(toastCtx, toastState);
	} catch {
		// SSR context not available — store as module-level fallback
		fallbackToast = toastState;
	}
	return toastState;
}
export function getToast(): ToastState {
	try {
		if (hasContext(toastCtx)) {
			return getContext<ToastState>(toastCtx);
		}
	} catch {
		// Outside component context during SSR
	}
	// Return fallback or create a no-op instance so callers never get undefined
	return fallbackToast ?? new ToastState();
}
