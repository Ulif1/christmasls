import type { PgDriver } from './postgres';

export const TABLES = ['users', 'christmas_lists', 'items', 'list_shares'] as const;

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

type TableRow = { table_name: string };

export async function syncSchema(db: PgDriver): Promise<void> {
  for (const statement of DDL) {
    await db.exec(statement);
  }
}

export async function assertSchema(db: PgDriver): Promise<void> {
  const rows = await db.query<TableRow>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1::text[])`,
    [TABLES],
  );
  const present = new Set(rows.map((row) => String(row.table_name)));
  const missing = TABLES.filter((table) => !present.has(table));
  if (missing.length > 0) {
    throw new Error(
      `Database schema is missing tables: ${missing.join(', ')}. Run: npm run db:sync`,
    );
  }
}
