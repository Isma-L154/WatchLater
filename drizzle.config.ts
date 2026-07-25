import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

// drizzle-kit's "turso" driver validates that an auth token is present. A local
// SQLite file connection (file:local.db) ignores the token entirely, so we pass
// a harmless placeholder when none is configured — i.e. during local development.
const authToken = process.env.DATABASE_AUTH_TOKEN || 'local-dev-unused';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'turso',
	dbCredentials: { url, authToken },
	verbose: true,
	strict: true
});
