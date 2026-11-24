import { loadConfig } from '../config';
import { PgDriver } from './postgres';
export const driver = new PgDriver(loadConfig().databaseUrl);
