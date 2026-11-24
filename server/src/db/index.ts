import { loadConfig } from '../config';
import { PgDriver } from './postgres';
import type { Driver, SqlExecutor } from './types';

const pg = new PgDriver(loadConfig().databaseUrl);

/** App-facing singleton. Raw `exec`/`query` are intentionally not exposed. */
export const driver: Driver = pg;

/**
 * Schema-tooling accessor for the same connection pool. Kept separate from
 * `driver` so ordinary application code cannot reach unparameterised SQL.
 */
export const schemaExecutor: SqlExecutor = pg;
