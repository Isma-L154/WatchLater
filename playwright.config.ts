import { defineConfig } from '@playwright/test';

/**
 * E2E runs against the dev server so it picks up local `.env` (TMDB token +
 * database). Because it needs those secrets, e2e is a local/manual step and is
 * intentionally not part of the CI workflow.
 */
export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	use: { baseURL: 'http://localhost:5173' },
	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI
	}
});
