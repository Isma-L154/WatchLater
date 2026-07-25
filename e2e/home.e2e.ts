import { expect, test } from '@playwright/test';

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
