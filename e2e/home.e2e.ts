import { expect, test } from '@playwright/test';

/**
 * Smoke tests driving the real app. They run signed out, which is the only
 * state reachable without completing a live Google OAuth round-trip — so they
 * cover discovery and the auth gate, while the watchlist logic itself is
 * covered by the unit tests over `$lib`.
 */

test('shows the app and reveals a results section when searching', async ({ page }) => {
	await page.goto('/');

	// The app header renders.
	await expect(page.getByRole('heading', { name: /watchlater/i })).toBeVisible();

	// The search box is present and usable.
	const search = page.getByPlaceholder(/search for a movie or tv show/i);
	await expect(search).toBeVisible();

	// Typing a query switches the discover section to "Search results".
	await search.fill('Matrix');
	await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
});

test('has an empty or populated watchlist section', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Your Watchlist' })).toBeVisible();
});

test('gates the watchlist behind sign-in when signed out', async ({ page }) => {
	await page.goto('/');

	// The list is not shown to anonymous visitors — they get the sign-in prompt.
	await expect(page.getByText('Your list, and only yours')).toBeVisible();

	// Discover cards offer sign-in rather than a save button that cannot work.
	await expect(page.getByRole('link', { name: /sign in to save/i }).first()).toBeVisible();
});

test('starts the Google OAuth flow with state and PKCE', async ({ page }) => {
	await page.goto('/');

	const response = await page.request.get('/auth/google', { maxRedirects: 0 });
	const location = response.headers()['location'] ?? '';

	// Either we are redirected to Google with the expected protections, or the
	// deployment has no credentials configured and says so instead of erroring.
	if (location.includes('accounts.google.com')) {
		expect(location).toContain('code_challenge_method=S256');
		expect(location).toContain('state=');
		expect(location).toContain('redirect_uri=');
	} else {
		expect(location).toContain('auth=unavailable');
	}
});

test('serves baseline security headers', async ({ page }) => {
	const response = await page.goto('/');
	const headers = response?.headers() ?? {};

	expect(headers['x-frame-options']).toBe('DENY');
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
	// Personalised HTML must never be cacheable by a shared proxy.
	expect(headers['cache-control']).toContain('no-store');
});
