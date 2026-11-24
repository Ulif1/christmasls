import { loadConfig } from '../config';
import { PgDriver } from './postgres';

/**
 * Schema-tooling entry point. Never import this from application code: the
 * returned driver exposes raw SQL and is reserved for db sync/selfcheck work.
 */
export function createSchemaDriver(databaseUrl: string = loadConfig().databaseUrl): PgDriver {
  return new PgDriver(databaseUrl);
}
