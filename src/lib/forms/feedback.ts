import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { toasts } from '$lib/stores/toasts.svelte';

/**
 * What every enhanced form on this site does with an action's answer: take the
 * fresh data if there is any, and say something if there is not.
 *
 * The three routes here are not interchangeable.
 *
 * A **failure** is the server declining on purpose — the list is full, the
 * session expired. It comes back over a working connection, so the page data is
 * refreshed: whatever else changed while we were asking is worth having.
 *
 * An **error** is no answer at all: the connection dropped, or the response was
 * not something SvelteKit could read. `update()` here would hand the result to
 * `applyAction`, which renders the error boundary — the whole page replaced,
 * taking the visitor's search, their scroll position and any open sheet with
 * it, because a request they made in the background failed. A toast says the
 * same thing and costs them nothing.
 *
 * Returns the action's own payload when it succeeded and `null` when it did
 * not — the data rather than a flag, because a caller wording its message from
 * the response would otherwise have to re-narrow `result` itself. An action
 * that returns nothing still succeeded, and answers `{}`.
 */
export async function absorb(
	result: ActionResult,
	update: () => Promise<void>
): Promise<Record<string, unknown> | null> {
	if (result.type === 'error') {
		toasts.add('Something went wrong', 'error');
		return null;
	}

	await update();

	if (result.type === 'success') return result.data ?? {};
	// A redirect is already taking the visitor somewhere; it needs no commentary.
	if (result.type !== 'redirect') toasts.add('Something went wrong', 'error');
	return null;
}

/**
 * The common case: one fixed message when the action worked.
 *
 * The message is captured when the control is built rather than read after the
 * await, because the data it was derived from may be gone by then — completing
 * a season makes the detail sheet refetch, and the title it named goes with it.
 */
export function withToast(message: string, type: 'success' | 'info' = 'success'): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			if (await absorb(result, update)) toasts.add(message, type);
		};
}
