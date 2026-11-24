import { ValidationError } from '../errors';

/**
 * Parses a route id. Only a canonical positive safe integer is accepted, so
 * `abc`, `1.5`, `-1`, `1e3` and `" 2 "` are rejected as 400 rather than
 * reaching PostgreSQL and surfacing as a 500.
 *
 * Express 5 types `req.params[key]` as `string | string[]`, so repeated params
 * are rejected by the same string test rather than cast at every call site.
 */
export function parseId(raw: string | string[] | undefined): number {
  if (raw === undefined || Array.isArray(raw) || !/^\d+$/.test(raw)) {
    throw new ValidationError('Invalid id');
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError('Invalid id');
  }
  return id;
}
