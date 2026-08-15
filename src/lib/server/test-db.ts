import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './db/schema';

/**
 * A real database for tests, in memory.
 *
 * The alternative — mocking Drizzle — would assert that the code calls the
 * query builder in a particular way, which is not the thing worth knowing. The
 * bugs these tests exist to catch were all about what ends up in a row, and only
 * a real engine answers that: the cascade deletes, the unique index, the
 * defaults, and the columns a write forgets to touch.
 *
 * `:memory:` keeps each test isolated and costs nothing to tear down. The
 * migrations are the same files production runs, so the schema under test is
 * the schema that ships rather than one restated here and free to drift.
 */
export interface TestDatabase {
	db: LibSQLDatabase<typeof schema>;
	client: Client;
}

export async function createTestDatabase(): Promise<TestDatabase> {
	const client = createClient({ url: ':memory:' });
	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder: './drizzle' });
	return { db, client };
}

/** The owner most tests need, inserted and returned. */
export async function seedUser(
	db: LibSQLDatabase<typeof schema>,
	over: Partial<typeof schema.user.$inferInsert> = {}
) {
	const [row] = await db
		.insert(schema.user)
		.values({
			id: 'user-1',
			googleId: 'google-1',
			email: 'test@example.com',
			name: 'Test User',
			...over
		})
		.returning();
	return row;
}
