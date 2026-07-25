/**
 * Tiny toast notification store built on Svelte 5 runes. A single shared
 * instance is exported so any component can trigger a toast.
 */

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

class ToastStore {
	items = $state<Toast[]>([]);
	#counter = 0;

	/** Show a toast; it auto-dismisses after `duration` ms. */
	add(message: string, type: ToastType = 'success', duration = 2800) {
		const id = ++this.#counter;
		this.items.push({ id, message, type });
		setTimeout(() => this.remove(id), duration);
	}

	remove(id: number) {
		const index = this.items.findIndex((toast) => toast.id === id);
		if (index !== -1) this.items.splice(index, 1);
	}
}

export const toasts = new ToastStore();
