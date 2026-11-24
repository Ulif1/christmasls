import type { SqlExecutor } from './types';

export const TABLES = ['users', 'christmas_lists', 'items', 'list_shares'] as const;
type Table = (typeof TABLES)[number];

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS christmas_lists (
  id serial PRIMARY KEY,
  name text NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE
);`,
  `CREATE TABLE IF NOT EXISTS items (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric(10,2),
  purchased boolean NOT NULL DEFAULT false,
  list_id integer NOT NULL REFERENCES christmas_lists(id) ON DELETE CASCADE
);`,
  `CREATE TABLE IF NOT EXISTS list_shares (
  id serial PRIMARY KEY,
  list_id integer NOT NULL REFERENCES christmas_lists(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (list_id, user_id)
);`,
  `CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);`,
  `CREATE INDEX IF NOT EXISTS idx_list_shares_user_id ON list_shares(user_id);`,
];

interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
}

const COLUMNS: Record<Table, readonly ColumnSpec[]> = {
  users: [
    { name: 'id', type: 'int4', nullable: false },
    { name: 'username', type: 'text', nullable: false },
    { name: 'password_hash', type: 'text', nullable: false },
  ],
  christmas_lists: [
    { name: 'id', type: 'int4', nullable: false },
    { name: 'name', type: 'text', nullable: false },
    { name: 'user_id', type: 'int4', nullable: false },
  ],
  items: [
    { name: 'id', type: 'int4', nullable: false },
    { name: 'name', type: 'text', nullable: false },
    { name: 'description', type: 'text', nullable: true },
    { name: 'price', type: 'numeric', nullable: true },
    { name: 'purchased', type: 'bool', nullable: false },
    { name: 'list_id', type: 'int4', nullable: false },
  ],
  list_shares: [
    { name: 'id', type: 'int4', nullable: false },
    { name: 'list_id', type: 'int4', nullable: false },
    { name: 'user_id', type: 'int4', nullable: false },
  ],
};

const PRIMARY_KEYS: Record<Table, readonly string[]> = {
  users: ['id'],
  christmas_lists: ['id'],
  items: ['id'],
  list_shares: ['id'],
};

const UNIQUE_CONSTRAINTS: ReadonlyArray<{ table: Table; columns: readonly string[] }> = [
  { table: 'list_shares', columns: ['list_id', 'user_id'] },
];

const FOREIGN_KEYS: ReadonlyArray<{
  table: Table;
  column: string;
  refTable: Table;
  refColumn: string;
}> = [
  { table: 'christmas_lists', column: 'user_id', refTable: 'users', refColumn: 'id' },
  { table: 'items', column: 'list_id', refTable: 'christmas_lists', refColumn: 'id' },
  { table: 'list_shares', column: 'list_id', refTable: 'christmas_lists', refColumn: 'id' },
  { table: 'list_shares', column: 'user_id', refTable: 'users', refColumn: 'id' },
];

const INDEXES = ['idx_items_list_id', 'idx_list_shares_user_id'] as const;

interface AtomicSqlExecutor extends SqlExecutor {
  execAll(statements: readonly string[]): Promise<void>;
}

function supportsAtomicBatch(db: SqlExecutor): db is AtomicSqlExecutor {
  return typeof (db as Partial<AtomicSqlExecutor>).execAll === 'function';
}

function sameColumns(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((column, i) => column === expected[i]);
}

type TableRow = { table_name: string };
type ColumnRow = {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: string;
};
type PrimaryKeyRow = { table_name: string; column_name: string };
type UniqueRow = { table_name: string; columns: string[] };
type ForeignKeyRow = {
  table_name: string;
  column_name: string;
  ref_table: string;
  ref_column: string;
  on_delete: string;
};
type IndexRow = { indexname: string };

const DELETE_ACTIONS: Record<string, string> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

export async function syncSchema(db: SqlExecutor): Promise<void> {
  if (supportsAtomicBatch(db)) {
    await db.execAll(DDL);
    return;
  }
  // A multi-statement simple query is executed by PostgreSQL as one implicit
  // transaction, so this fallback is atomic as well.
  await db.exec(DDL.join('\n'));
}

export async function assertSchema(db: SqlExecutor): Promise<void> {
  const [tableRows, columnRows, primaryKeyRows, uniqueRows, foreignKeyRows, indexRows] =
    await Promise.all([
      db.query<TableRow>(
        `select table_name from information_schema.tables
          where table_schema = 'public' and table_name = any($1::text[])`,
        [TABLES],
      ),
      db.query<ColumnRow>(
        `select table_name, column_name, udt_name, is_nullable
          from information_schema.columns
          where table_schema = 'public' and table_name = any($1::text[])`,
        [TABLES],
      ),
      db.query<PrimaryKeyRow>(
        `select src.relname as table_name, a.attname as column_name
          from pg_constraint con
          join pg_class src on src.oid = con.conrelid
          join pg_namespace ns on ns.oid = src.relnamespace
          join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
          join pg_attribute a on a.attrelid = src.oid and a.attnum = k.attnum
          where ns.nspname = 'public' and con.contype = 'p'
            and src.relname = any($1::text[])
          order by src.relname, k.ord`,
        [TABLES],
      ),
      db.query<UniqueRow>(
        `select src.relname as table_name,
                array_agg(a.attname::text order by k.ord) as columns
          from pg_constraint con
          join pg_class src on src.oid = con.conrelid
          join pg_namespace ns on ns.oid = src.relnamespace
          join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
          join pg_attribute a on a.attrelid = src.oid and a.attnum = k.attnum
          where ns.nspname = 'public' and con.contype = 'u'
            and src.relname = any($1::text[])
          group by src.relname, con.oid`,
        [TABLES],
      ),
      db.query<ForeignKeyRow>(
        `select src.relname as table_name,
                sa.attname as column_name,
                dst.relname as ref_table,
                da.attname as ref_column,
                con.confdeltype as on_delete
          from pg_constraint con
          join pg_class src on src.oid = con.conrelid
          join pg_namespace ns on ns.oid = src.relnamespace
          join pg_class dst on dst.oid = con.confrelid
          join pg_namespace dn on dn.oid = dst.relnamespace
          join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
          join pg_attribute sa on sa.attrelid = src.oid and sa.attnum = k.attnum
          join pg_attribute da on da.attrelid = dst.oid and da.attnum = con.confkey[k.ord::int]
          where ns.nspname = 'public' and dn.nspname = 'public'
            and con.contype = 'f' and src.relname = any($1::text[])`,
        [TABLES],
      ),
      db.query<IndexRow>(
        `select indexname from pg_indexes
          where schemaname = 'public' and indexname = any($1::text[])`,
        [INDEXES],
      ),
    ]);

  const defects: string[] = [];
  const presentTables = new Set(tableRows.map((row) => row.table_name));
  const presentColumns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
  const actualColumns = new Map(columnRows.map((row) => [`${row.table_name}.${row.column_name}`, row]));

  const primaryKeys = new Map<string, string[]>();
  for (const row of primaryKeyRows) {
    const columns = primaryKeys.get(row.table_name) ?? [];
    columns.push(row.column_name);
    primaryKeys.set(row.table_name, columns);
  }

  for (const table of TABLES) {
    if (!presentTables.has(table)) {
      defects.push(`missing table "${table}"`);
      continue;
    }

    for (const expected of COLUMNS[table]) {
      const key = `${table}.${expected.name}`;
      const actual = actualColumns.get(key);
      if (!actual) {
        defects.push(`missing column "${key}"`);
        continue;
      }
      if (actual.udt_name !== expected.type) {
        defects.push(`column "${key}" has type "${actual.udt_name}", expected "${expected.type}"`);
      }
      const nullable = actual.is_nullable === 'YES';
      if (nullable !== expected.nullable) {
        defects.push(
          `column "${key}" is ${nullable ? 'nullable' : 'NOT NULL'}, expected ${
            expected.nullable ? 'nullable' : 'NOT NULL'
          }`,
        );
      }
    }

    const expectedPk = PRIMARY_KEYS[table];
    const actualPk = primaryKeys.get(table) ?? [];
    if (!sameColumns(actualPk, expectedPk)) {
      defects.push(
        `primary key on "${table}" is (${actualPk.join(', ')}), expected (${expectedPk.join(', ')})`,
      );
    }
  }

  for (const unique of UNIQUE_CONSTRAINTS) {
    if (!presentTables.has(unique.table)) {
      continue;
    }
    const found = uniqueRows.some(
      (row) => row.table_name === unique.table && sameColumns(row.columns, unique.columns),
    );
    if (!found) {
      defects.push(
        `missing UNIQUE constraint on "${unique.table}"(${unique.columns.join(', ')})`,
      );
    }
  }

  for (const fk of FOREIGN_KEYS) {
    if (!presentTables.has(fk.table) || !presentTables.has(fk.refTable)) {
      continue;
    }
    const key = `${fk.table}.${fk.column}`;
    if (!presentColumns.has(key)) {
      // The missing column is already reported; a missing FK would be noise.
      continue;
    }
    const actual = foreignKeyRows.find(
      (row) =>
        row.table_name === fk.table &&
        row.column_name === fk.column &&
        row.ref_table === fk.refTable &&
        row.ref_column === fk.refColumn,
    );
    const reference = `"${key}" -> "${fk.refTable}"(${fk.refColumn})`;
    if (!actual) {
      defects.push(`missing foreign key ${reference}`);
    } else if (actual.on_delete !== 'c') {
      defects.push(
        `foreign key ${reference} is missing ON DELETE CASCADE (found ${
          DELETE_ACTIONS[actual.on_delete] ?? actual.on_delete
        })`,
      );
    }
  }

  const presentIndexes = new Set(indexRows.map((row) => row.indexname));
  for (const index of INDEXES) {
    if (!presentIndexes.has(index)) {
      defects.push(`missing index "${index}"`);
    }
  }

  if (defects.length > 0) {
    throw new Error(
      `Database schema verification failed:\n${defects
        .map((defect) => `  - ${defect}`)
        .join('\n')}\nRun: npm run db:sync`,
    );
  }
}
