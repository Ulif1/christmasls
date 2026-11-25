import { ValidationError } from '../errors';

/** PostgreSQL `integer` upper bound; larger values make the driver raise 22003. */
const MAX_PG_INTEGER = 2147483647;
const CANONICAL_POSITIVE_INT = /^[1-9][0-9]*$/;

/**
 * Parses a canonical positive integer from a route param or a JSON body.
 *
 * Accepts a real integer number or a decimal string without a sign, leading
 * zeros, exponent, or fraction, and rejects values above PostgreSQL's `integer`
 * range. Returns `null` instead of throwing so callers can choose their own
 * error message.
 */
export function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || value > MAX_PG_INTEGER) {
      return null;
    }
    return value;
  }

  if (typeof value === 'string' && CANONICAL_POSITIVE_INT.test(value)) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed > MAX_PG_INTEGER) {
      return null;
    }
    return parsed;
  }

  return null;
}

/**
 * Parses a route id. Only a canonical positive integer is accepted, so
 * `abc`, `1.5`, `-1`, `1e3`, `01`, `0` and `" 2 "` are rejected as 400 rather
 * than reaching PostgreSQL and surfacing as a 500.
 *
 * Express 5 types `req.params[key]` as `string | string[]`, so repeated params
 * are rejected by the same string test rather than cast at every call site.
 */
export function parseId(raw: string | string[] | undefined): number {
  const id = parsePositiveInt(raw);
  if (id === null) {
    throw new ValidationError('Invalid id');
  }
  return id;
}
