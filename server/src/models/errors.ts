import { TableError } from '../data/table';
import { DriverError } from '../db/types';
import { AppError, ConflictError, InternalError, ValidationError } from '../errors';

/**
 * The single place where infrastructure errors become application errors.
 *
 * `AppError`s are intentional and pass through untouched. `PgDriver.transaction`
 * rethrows the callback's error unchanged, so an intentional `AppError` raised
 * inside a transaction is preserved; `PgStore` translates its own `DriverError`s.
 */
export async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof DriverError) {
      switch (error.code) {
        case 'unique_violation':
          throw new ConflictError('Already exists');
        case 'foreign_key_violation':
          throw new ValidationError('Referenced record does not exist');
        case 'not_null_violation':
          throw new ValidationError('Missing required field');
        case 'check_violation':
          throw new ValidationError('Invalid value');
        default:
          throw new InternalError('Server error');
      }
    }

    // `TableError` and any other unexpected failure: never leak internals.
    if (error instanceof TableError) {
      throw new InternalError('Server error');
    }
    throw new InternalError('Server error');
  }
}
