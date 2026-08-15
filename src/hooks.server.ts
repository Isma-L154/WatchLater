import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
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
const authenticate: Handle = async ({ event, resolve }) => {
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

/**
 * Baseline response headers.
 *
 * `frame-ancestors` is the one that matters most here: without it, a hostile
 * page could load the app in an invisible iframe over its own UI and harvest a
 * signed-in visitor's clicks onto the remove and progress buttons. The rest
 * close off MIME sniffing, referrer leakage and unused device APIs.
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// The full policy is generated per response by SvelteKit, which knows the
	// hashes of its own inline scripts — see `csp` in vite.config.ts. This one
	// remains for the responses that never pass through it, such as the API
	// proxies, where a bare frame-ancestors is still worth having.
	if (!response.headers.has('content-security-policy')) {
		response.headers.set('content-security-policy', "frame-ancestors 'none'");
	}
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

	/**
	 * Refuse to be spoken to over plain HTTP again.
	 *
	 * Deliberately without `includeSubDomains` and without `preload`. This host
	 * sits under a shared public suffix, so those would reach hostnames belonging
	 * to other people's projects — a commitment that is not ours to make.
	 */
	response.headers.set('strict-transport-security', 'max-age=31536000');

	/**
	 * Keep other origins from holding a handle on this window or reading its
	 * resources. The trailer opens in an iframe we control; nothing needs a
	 * cross-origin reference back to us.
	 */
	response.headers.set('cross-origin-opener-policy', 'same-origin');
	response.headers.set('cross-origin-resource-policy', 'same-origin');

	/**
	 * Default every response to uncacheable.
	 *
	 * Rendered pages embed the signed-in user's watchlist, and without an explicit
	 * directive a CDN or corporate proxy is free to apply its own heuristics — the
	 * failure mode being one person's private list served to the next visitor.
	 * Routes that *are* safe to share (the TMDB proxies) opt in by setting their
	 * own `cache-control`, so this only fills in the blanks.
	 */
	if (!response.headers.has('cache-control')) {
		response.headers.set('cache-control', 'private, no-store');
	}

	return response;
};

export const handle = sequence(securityHeaders, authenticate);
