import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// A remote libSQL/Turso database requires an auth token, while a local SQLite
// file (e.g. "file:local.db") used during development does not. We only enforce
// the token for remote connections so local dev works out of the box.
const isRemote = env.DATABASE_URL.startsWith('libsql://');
if (isRemote && !env.DATABASE_AUTH_TOKEN) {
	throw new Error('DATABASE_AUTH_TOKEN is required for remote libSQL databases');
}

const client = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN || undefined
});

export const db = drizzle(client, { schema });
