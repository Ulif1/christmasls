import { loadConfig } from '../config';
import { PgDriver } from './postgres';
import { assertSchema } from './schema';

/**
 * Schema-tooling entry point. Never import this from application code: the
 * returned driver exposes raw SQL and is reserved for db sync/selfcheck work.
 */
export function createSchemaDriver(databaseUrl: string = loadConfig().databaseUrl): PgDriver {
  return new PgDriver(databaseUrl);
}

/**
 * One-shot boot guard: opens a schema-capable connection, verifies the live
 * schema, and always closes the connection before returning or rethrowing.
 */
export async function verifyDatabaseSchema(databaseUrl: string): Promise<void> {
  const db = createSchemaDriver(databaseUrl);
  try {
    await db.connect();
    await assertSchema(db);
  } finally {
    await db.close();
  }
}
