import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	setSessionCookie,
	validateSession
} from '$lib/server/auth';

/**
 * Resolve the session cookie once per request and expose the result on
 * `event.locals`, so every load function and action can trust `locals.user`
 * without repeating the lookup.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		try {
			const result = await validateSession(token);
			if (result) {
				event.locals.user = result.user;
				// Re-issue the cookie when the session was extended, so the browser's
				// copy expires at the same time as the database row.
				if (result.renewed) setSessionCookie(event.cookies, token, result.expiresAt);
			} else {
				deleteSessionCookie(event.cookies);
			}
		} catch (err) {
			// A database hiccup must not take the whole site down — the visitor is
			// simply treated as signed out for this request.
			console.error('Session validation failed:', err);
		}
	}

	return resolve(event);
};
