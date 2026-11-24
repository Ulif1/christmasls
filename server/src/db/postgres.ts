import { Pool } from 'pg';
import {
  Cond,
  Driver,
  DriverError,
  DriverErrorCode,
  Row,
  Scalar,
  SelectSpec,
  Store,
  Where,
} from './types';

const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(n: string): string {
  if (!IDENT.test(n)) {
    throw new DriverError('invalid_identifier', `Invalid identifier: ${n}`);
  }
  return `"${n}"`;
}

interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
}

function param(v: unknown, params: unknown[]): string {
  if (v === undefined) {
    throw new DriverError('invalid_identifier', 'undefined parameter');
  }
  params.push(v);
  return '$' + params.length;
}

function compileCond(col: string, cond: Cond, params: unknown[]): string {
  if (typeof cond !== 'object' || cond === null || Array.isArray(cond)) {
    throw new DriverError('invalid_identifier', `Invalid condition on column ${col}`);
  }
  const c = cond as Record<string, unknown>;
  const keys = Object.keys(c);
  if (keys.length !== 1) {
    throw new DriverError('invalid_identifier', `Condition on column ${col} must have exactly one operator`);
  }
  switch (keys[0]) {
    case 'eq': {
      const v = c.eq as Scalar;
      if (v === null) {
        throw new DriverError('invalid_identifier', `Use isNull for column ${col}`);
      }
      return `${col} = ${param(v, params)}`;
    }
    case 'ne': {
      const v = c.ne as Scalar;
      if (v === null) {
        throw new DriverError('invalid_identifier', `Use notNull for column ${col}`);
      }
      return `${col} <> ${param(v, params)}`;
    }
    case 'in': {
      const v = c.in;
      if (!Array.isArray(v)) {
        throw new DriverError('invalid_identifier', `Operator in on column ${col} requires an array`);
      }
      if (v.length === 0) {
        return 'FALSE';
      }
      const placeholders = v.map((item) => param(item, params));
      return `${col} IN (${placeholders.join(', ')})`;
    }
    case 'isNull':
      if (c.isNull !== true) {
        throw new DriverError('invalid_identifier', `isNull on column ${col} must be true`);
      }
      return `${col} IS NULL`;
    case 'notNull':
      if (c.notNull !== true) {
        throw new DriverError('invalid_identifier', `notNull on column ${col} must be true`);
      }
      return `${col} IS NOT NULL`;
    default:
      throw new DriverError('invalid_identifier', `Unknown operator ${keys[0]} on column ${col}`);
  }
}

export function compileWhere(where: Where, params: unknown[]): string {
  const clauses: string[] = [];
  for (const [column, cond] of Object.entries(where)) {
    clauses.push(compileCond(ident(column), cond, params));
  }
  return clauses.join(' AND ');
}

function compileSelect(table: string, spec: SelectSpec, params: unknown[]): string {
  let sql = `SELECT * FROM ${ident(table)}`;
  if (spec.where && Object.keys(spec.where).length > 0) {
    sql += ` WHERE ${compileWhere(spec.where, params)}`;
  }
  if (spec.orderBy && spec.orderBy.length > 0) {
    const clauses = spec.orderBy.map((o) => {
      if (o.direction !== 'asc' && o.direction !== 'desc') {
        throw new DriverError('invalid_identifier', `Invalid order direction: ${String(o.direction)}`);
      }
      const direction = o.direction === 'asc' ? 'ASC' : 'DESC';
      return `${ident(o.column)} ${direction}`;
    });
    sql += ` ORDER BY ${clauses.join(', ')}`;
  }
  if (spec.limit !== undefined) {
    sql += ` LIMIT ${param(spec.limit, params)}`;
  }
  if (spec.offset !== undefined) {
    sql += ` OFFSET ${param(spec.offset, params)}`;
  }
  return sql;
}

function compileInsert(table: string, rows: Row[], params: unknown[]): string {
  const columns = Object.keys(rows[0]);
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length !== columns.length || columns.some((column) => !(column in row))) {
      throw new DriverError('invalid_identifier', 'ragged insert');
    }
  }
  const columnList = columns.map(ident).join(', ');
  const valuesList = rows
    .map((row) => `(${columns.map((column) => param(row[column], params)).join(', ')})`)
    .join(', ');
  return `INSERT INTO ${ident(table)} (${columnList}) VALUES ${valuesList} RETURNING *`;
}

function compileUpdate(table: string, where: Where, patch: Row, params: unknown[]): string {
  const setList = Object.keys(patch)
    .map((column) => `${ident(column)} = ${param(patch[column], params)}`)
    .join(', ');
  const whereSql = compileWhere(where, params);
  return `UPDATE ${ident(table)} SET ${setList} WHERE ${whereSql} RETURNING *`;
}

const PG_CODES: Record<string, DriverErrorCode> = {
  '23505': 'unique_violation',
  '23503': 'foreign_key_violation',
  '23502': 'not_null_violation',
  '23514': 'check_violation',
};

function translateError(error: unknown): DriverError {
  if (error instanceof DriverError) {
    return error;
  }
  const pg = error as { code?: string; detail?: string; message?: string } | null;
  const mapped = pg && typeof pg.code === 'string' ? PG_CODES[pg.code] : undefined;
  const message = pg?.message ?? 'database error';
  const detail = pg?.detail ? ` (${pg.detail})` : '';
  return new DriverError(mapped ?? 'unknown', `${message}${detail}`, error);
}

class PgStore implements Store {
  constructor(private readonly db: Queryable) {}

  async select(table: string, spec: SelectSpec = {}): Promise<Row[]> {
    const params: unknown[] = [];
    const sql = compileSelect(table, spec, params);
    return this.run(sql, params);
  }

  async insertMany(table: string, rows: Row[]): Promise<Row[]> {
    if (rows.length === 0) {
      return [];
    }
    const params: unknown[] = [];
    const sql = compileInsert(table, rows, params);
    return this.run(sql, params);
  }

  async update(table: string, where: Where, patch: Row): Promise<Row[]> {
    if (Object.keys(where).length === 0) {
      throw new DriverError('unfiltered_write', `Refusing to update ${table} without a where clause`);
    }
    if (Object.keys(patch).length === 0) {
      return [];
    }
    const params: unknown[] = [];
    const sql = compileUpdate(table, where, patch, params);
    return this.run(sql, params);
  }

  async delete(table: string, where: Where): Promise<number> {
    if (Object.keys(where).length === 0) {
      throw new DriverError('unfiltered_write', `Refusing to delete from ${table} without a where clause`);
    }
    const params: unknown[] = [];
    const sql = `DELETE FROM ${ident(table)} WHERE ${compileWhere(where, params)}`;
    try {
      const result = await this.db.query(sql, params);
      return result.rowCount ?? 0;
    } catch (error) {
      throw translateError(error);
    }
  }

  private async run(sql: string, params: unknown[]): Promise<Row[]> {
    try {
      const result = await this.db.query(sql, params);
      return result.rows;
    } catch (error) {
      throw translateError(error);
    }
  }
}

export class PgDriver implements Driver {
  private pool: Pool | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }
    const pool = new Pool({ connectionString: this.url, max: 10 });
    try {
      await pool.query('select 1');
    } catch (error) {
      await pool.end();
      this.pool = null;
      throw error;
    }
    this.pool = pool;
  }

  async close(): Promise<void> {
    const pool = this.pool;
    this.pool = null;
    if (pool) {
      await pool.end();
    }
  }

  async select(table: string, spec?: SelectSpec): Promise<Row[]> {
    return new PgStore(this.requirePool()).select(table, spec);
  }

  async insertMany(table: string, rows: Row[]): Promise<Row[]> {
    return new PgStore(this.requirePool()).insertMany(table, rows);
  }

  async update(table: string, where: Where, patch: Row): Promise<Row[]> {
    return new PgStore(this.requirePool()).update(table, where, patch);
  }

  async delete(table: string, where: Where): Promise<number> {
    return new PgStore(this.requirePool()).delete(table, where);
  }

  async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    const client = await this.requirePool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(new PgStore(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // swallow rollback failures; surface the original error
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async exec(sql: string): Promise<void> {
    await this.requirePool().query(sql);
  }

  async query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.requirePool().query(sql, params);
    return result.rows as T[];
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new DriverError('unknown', 'Database driver is not connected');
    }
    return this.pool;
  }
}
