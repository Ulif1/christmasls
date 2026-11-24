import type { Cond, Row, SelectSpec, Store, Where } from '../db/types';

export type ColumnType = 'int' | 'text' | 'bool' | 'numeric' | 'timestamp';

export interface ColumnDef {
  column: string;
  type: ColumnType;
  nullable?: boolean;
}

export type ColumnMap<T> = { [K in keyof T]?: ColumnDef };

export interface TableDef<T> {
  name: string;
  columns: ColumnMap<T>;
}

export interface RowSpec<T> {
  where?: Partial<Record<keyof T, Cond>>;
  orderBy?: { property: keyof T; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export class TableError extends Error {
  constructor(readonly code: 'invalid_table' | 'invalid_query', message: string) {
    super(message);
    this.name = 'TableError';
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const OPS = new Set(['eq', 'ne', 'in', 'isNull', 'notNull']);

/**
 * A condition must be a plain object with exactly one own operator key.
 * Null, arrays, class instances, and bare scalars are all rejected.
 * `Object.create(null)` is accepted because it is still a plain data bag.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function columnsOf<T>(def: TableDef<T>): Record<string, ColumnDef> {
  return def.columns as Record<string, ColumnDef>;
}

export class Table<T extends { id: number }> {
  private readonly columns: Record<string, ColumnDef>;

  constructor(private readonly store: Store, private readonly def: TableDef<T>) {
    if (!IDENT.test(def.name)) {
      throw new TableError('invalid_table', `Invalid table name: ${def.name}`);
    }

    const columns = columnsOf(def);
    const seen = new Set<string>();
    for (const property of Object.keys(columns)) {
      const column = columns[property];
      if (!column) {
        continue;
      }
      if (!IDENT.test(column.column)) {
        throw new TableError('invalid_table', `Invalid column name for ${property}: ${column.column}`);
      }
      if (seen.has(column.column)) {
        throw new TableError('invalid_table', `Duplicate column mapping: ${column.column}`);
      }
      seen.add(column.column);
    }

    const id = columns.id;
    if (!id) {
      throw new TableError('invalid_table', 'Table requires an id column');
    }

    this.columns = columns;
  }

  async findById(id: number): Promise<T | null> {
    const where = { id: { eq: id } } as unknown as Partial<Record<keyof T, Cond>>;
    const rows = await this.findMany({ where, limit: 1 });
    return rows[0] ?? null;
  }

  async findOne(where: Partial<Record<keyof T, Cond>>): Promise<T | null> {
    const rows = await this.findMany({ where, limit: 1 });
    return rows[0] ?? null;
  }

  async findMany(spec: RowSpec<T> = {}): Promise<T[]> {
    const rows = await this.store.select(this.def.name, this.toSelectSpec(spec));
    return rows.map((row) => this.fromRow(row));
  }

  async exists(where: Partial<Record<keyof T, Cond>>): Promise<boolean> {
    const rows = await this.store.select(this.def.name, {
      where: this.translateWhere(where),
      limit: 1,
    });
    return rows.length > 0;
  }

  async insert(row: Partial<T>): Promise<T> {
    const rows = await this.insertMany([row]);
    const created = rows[0];
    if (rows.length !== 1 || !created) {
      throw new TableError('invalid_query', 'Insert did not return exactly one row');
    }
    return created;
  }

  async insertMany(rows: Partial<T>[]): Promise<T[]> {
    if (rows.length === 0) {
      return [];
    }
    const inserted = await this.store.insertMany(this.def.name, rows.map((row) => this.toRow(row)));
    return inserted.map((row) => this.fromRow(row));
  }

  async update(where: Partial<Record<keyof T, Cond>>, patch: Partial<T>): Promise<T[]> {
    const rows = await this.store.update(this.def.name, this.translateWhere(where), this.toRow(patch));
    return rows.map((row) => this.fromRow(row));
  }

  async delete(where: Partial<Record<keyof T, Cond>>): Promise<number> {
    return this.store.delete(this.def.name, this.translateWhere(where));
  }

  private toSelectSpec(spec: RowSpec<T>): SelectSpec {
    const translated: SelectSpec = {};
    if (spec.where !== undefined) {
      translated.where = this.translateWhere(spec.where);
    }
    if (spec.orderBy !== undefined) {
      translated.orderBy = spec.orderBy.map((entry) => ({
        column: this.columnFor(String(entry.property)).column,
        direction: entry.direction,
      }));
    }
    if (spec.limit !== undefined) {
      translated.limit = spec.limit;
    }
    if (spec.offset !== undefined) {
      translated.offset = spec.offset;
    }
    return translated;
  }

  private translateWhere(where: Partial<Record<keyof T, Cond>>): Where {
    const translated: Where = {};
    for (const [property, cond] of Object.entries(where as Record<string, unknown>)) {
      const column = this.columnFor(property);
      translated[column.column] = this.checkCond(property, cond);
    }
    return translated;
  }

  private columnFor(property: string): ColumnDef {
    if (!Object.prototype.hasOwnProperty.call(this.columns, property)) {
      throw new TableError('invalid_query', `Unknown property: ${property}`);
    }
    const column = this.columns[property];
    if (!column) {
      throw new TableError('invalid_query', `Unknown property: ${property}`);
    }
    return column;
  }

  private checkCond(property: string, cond: unknown): Cond {
    if (!isPlainObject(cond)) {
      throw new TableError('invalid_query', `Invalid condition for ${property}`);
    }
    const keys = Object.keys(cond);
    if (keys.length !== 1 || !OPS.has(keys[0])) {
      throw new TableError('invalid_query', `Condition for ${property} must use exactly one operator`);
    }
    return cond as Cond;
  }

  private toRow(obj: Partial<T>): Row {
    const source = obj as Record<string, unknown>;
    const row: Row = {};
    for (const property of Object.keys(source)) {
      if (!Object.prototype.hasOwnProperty.call(this.columns, property)) {
        continue;
      }
      const column = this.columns[property];
      if (!column) {
        continue;
      }
      const value = source[property];
      if (value === undefined) {
        continue;
      }
      row[column.column] = this.encode(column, value);
    }
    return row;
  }

  private encode(def: ColumnDef, value: unknown): unknown {
    if (value === null) {
      if (def.nullable !== true) {
        throw new TableError('invalid_query', 'unexpected null');
      }
      return null;
    }
    if (def.type === 'timestamp') {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string') {
        return value;
      }
      throw new TableError('invalid_query', `Invalid timestamp value for ${def.column}`);
    }
    return value;
  }

  private fromRow(row: Row): T {
    const decoded: Record<string, unknown> = {};
    for (const property of Object.keys(this.columns)) {
      const column = this.columns[property];
      if (!column) {
        continue;
      }
      decoded[property] = this.decode(column, row[column.column]);
    }
    return decoded as T;
  }

  private decode(def: ColumnDef, value: unknown): unknown {
    switch (def.type) {
      case 'int':
        return Number(value);
      case 'text':
        return value;
      case 'bool':
        if (value === null) {
          return def.nullable === true ? null : false;
        }
        return value === true;
      case 'numeric':
        return value === null ? null : Number(value);
      case 'timestamp':
        return value instanceof Date ? value : new Date(String(value));
    }
  }
}
