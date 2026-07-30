import { isGoogleAuthConfigured } from '$lib/server/oauth';
import type { LayoutServerLoad } from './$types';

/**
 * Expose the signed-in user to every page. `authAvailable` lets the UI hide the
 * sign-in button on a deployment that has no Google credentials configured,
 * instead of offering a button that can only fail.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	return { user: locals.user, authAvailable: isGoogleAuthConfigured() };
};
