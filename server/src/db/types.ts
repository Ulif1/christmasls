export type Scalar = string | number | boolean | Date | null;
export type Cond = { eq: Scalar } | { ne: Scalar } | { in: Scalar[] } | { isNull: true } | { notNull: true };
export type Where = Record<string, Cond>;
export interface OrderBy { column: string; direction: 'asc' | 'desc' }
export interface SelectSpec { where?: Where; orderBy?: OrderBy[]; limit?: number; offset?: number }
export type Row = Record<string, unknown>;
export interface Store {
  select(table: string, spec?: SelectSpec): Promise<Row[]>;
  insertMany(table: string, rows: Row[]): Promise<Row[]>;
  update(table: string, where: Where, patch: Row): Promise<Row[]>;
  delete(table: string, where: Where): Promise<number>;
}
export interface Driver extends Store {
  connect(): Promise<void>;
  close(): Promise<void>;
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
}
export type DriverErrorCode = 'unfiltered_write' | 'invalid_identifier' | 'unique_violation'
  | 'foreign_key_violation' | 'not_null_violation' | 'check_violation' | 'unknown';
export class DriverError extends Error {
  constructor(readonly code: DriverErrorCode, message: string, readonly cause?: unknown) {
    super(message); this.name = 'DriverError';
  }
}
