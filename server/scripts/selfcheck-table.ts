import assert from 'node:assert';
import { compileWhere } from '../src/db/postgres';
import { DriverError } from '../src/db/types';
import type { Cond, Row, SelectSpec, Store } from '../src/db/types';
import { Table, TableError } from '../src/data/table';
import type { TableDef } from '../src/data/table';

interface User {
  id: number;
  email: string;
  isAdmin: boolean;
  balance: number | null;
  createdAt: Date;
}

const USER_DEF: TableDef<User> = {
  name: 'users',
  columns: {
    id: { column: 'id', type: 'int' },
    email: { column: 'email', type: 'text' },
    isAdmin: { column: 'is_admin', type: 'bool' },
    balance: { column: 'balance', type: 'numeric', nullable: true },
    createdAt: { column: 'created_at', type: 'timestamp' },
  },
};

const DECLARED = ['id', 'email', 'isAdmin', 'balance', 'createdAt'];

class FakeStore implements Store {
  selects: { table: string; spec?: SelectSpec }[] = [];
  selectRows: Row[] = [];
  insertRows: Row[] = [];
  updateRows: Row[] = [];
  deleted = 0;

  async select(table: string, spec?: SelectSpec): Promise<Row[]> {
    this.selects.push({ table, spec });
    return this.selectRows;
  }

  async insertMany(_table: string, rows: Row[]): Promise<Row[]> {
    return this.insertRows.length > 0 ? this.insertRows : rows;
  }

  async update(_table: string, _where: Row, _patch: Row): Promise<Row[]> {
    return this.updateRows;
  }

  async delete(): Promise<number> {
    return this.deleted;
  }

  lastSelect(): { table: string; spec?: SelectSpec } {
    const last = this.selects[this.selects.length - 1];
    assert.ok(last, 'expected a recorded select');
    return last;
  }
}

/** `toRow`/`fromRow` are private implementation details; the selfcheck pokes them directly. */
interface TableInternals {
  toRow(obj: unknown): Row;
  fromRow(row: Row): User;
}

function internals(table: Table<User>): TableInternals {
  return table as unknown as TableInternals;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: '1',
    email: 'ada@example.com',
    is_admin: true,
    balance: '12.30',
    created_at: '2024-01-02T03:04:05.000Z',
    ...overrides,
  };
}

const store = new FakeStore();
const users = new Table<User>(store, USER_DEF);

let passed = 0;

async function check(n: number, label: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`ok ${n} - ${label}`);
  } catch (error) {
    console.error(`not ok ${n} - ${label}`);
    console.error(error);
    process.exit(1);
  }
}

function isTableError(code: 'invalid_table' | 'invalid_query') {
  return (error: unknown): boolean => error instanceof TableError && error.code === code;
}

async function main(): Promise<void> {
  await check(1, 'toRow drops keys not declared in columns', () => {
    const mapped = internals(users).toRow({ id: 1, email: 'a@b.c', password_hash: 'secret' });
    assert.deepStrictEqual(mapped, { id: 1, email: 'a@b.c' });
  });

  await check(2, 'toRow drops undefined values', () => {
    const mapped = internals(users).toRow({ id: 1, email: undefined });
    assert.deepStrictEqual(mapped, { id: 1 });
  });

  await check(3, 'fromRow returns only declared keys', () => {
    const decoded = internals(users).fromRow(row({ password_hash: 'secret', junk: 'nope' }));
    assert.deepStrictEqual(Object.keys(decoded).sort(), [...DECLARED].sort());
    assert.ok(!('password_hash' in decoded), 'password_hash must not leak');
    assert.ok(!('junk' in decoded), 'junk must not leak');
  });

  await check(4, "numeric decodes '12.30' to 12.3", () => {
    const decoded = internals(users).fromRow(row({ balance: '12.30' }));
    assert.strictEqual(decoded.balance, 12.3);
  });

  await check(5, 'numeric decodes null to null (not 0)', () => {
    const decoded = internals(users).fromRow(row({ balance: null }));
    assert.strictEqual(decoded.balance, null);
  });

  await check(6, 'bool decodes and int decodes', () => {
    const decoded = internals(users).fromRow(row({ id: '7', is_admin: true }));
    assert.strictEqual(decoded.id, 7);
    assert.strictEqual(decoded.isAdmin, true);
    const falsy = internals(users).fromRow(row({ is_admin: false }));
    assert.strictEqual(falsy.isAdmin, false);
  });

  await check(7, 'a bare scalar condition is rejected', async () => {
    await assert.rejects(
      () => users.findMany({ where: { id: 1 as unknown as Cond } }),
      isTableError('invalid_query'),
    );
  });

  await check(8, 'a condition with two operators is rejected', async () => {
    await assert.rejects(
      () => users.findMany({ where: { id: { eq: 1, ne: 2 } as unknown as Cond } }),
      isTableError('invalid_query'),
    );
  });

  await check(9, 'unknown property in where is rejected', async () => {
    await assert.rejects(
      () => users.findMany({ where: { password_hash: { eq: 'x' } } as unknown as Partial<Record<keyof User, Cond>> }),
      isTableError('invalid_query'),
    );
  });

  await check(10, '{in: []} reaches the store unchanged', async () => {
    const emptyList: Cond = { in: [] };
    store.selectRows = [];
    await users.findMany({ where: { id: emptyList } });
    const recorded = store.lastSelect().spec;
    assert.ok(recorded?.where, 'expected a where clause');
    assert.strictEqual(recorded.where.id, emptyList);
    assert.deepStrictEqual(recorded.where.id, { in: [] });
  });

  await check(11, 'compileWhere compiles an empty in-list to FALSE', () => {
    const sql = compileWhere({ id: { in: [] } }, []);
    assert.strictEqual(sql, 'FALSE');
    assert.strictEqual(` WHERE ${sql}`, ' WHERE FALSE');
  });

  await check(12, 'compileWhere parameterises values instead of inlining them', () => {
    const params: unknown[] = [];
    const value = "x'; drop table users; --";
    const sql = compileWhere({ name: { eq: value } }, params);
    assert.strictEqual(sql, '"name" = $1');
    assert.deepStrictEqual(params, [value]);
    assert.ok(!sql.includes('drop table'), 'value must never be inlined');
  });

  await check(13, 'compileWhere rejects invalid identifiers', () => {
    assert.throws(
      () => compileWhere({ 'a;drop': { eq: 1 } }, []),
      (error: unknown) => error instanceof DriverError && error.code === 'invalid_identifier',
    );
  });

  await check(14, 'constructor rejects missing id and duplicate column mappings', () => {
    const noId = { name: 'things', columns: { name: { column: 'name', type: 'text' } } };
    assert.throws(
      () => new Table(store, noId as unknown as TableDef<{ id: number }>),
      isTableError('invalid_table'),
    );

    const duplicate = {
      name: 'things',
      columns: {
        id: { column: 'id', type: 'int' },
        other: { column: 'id', type: 'int' },
      },
    };
    assert.throws(
      () => new Table(store, duplicate as unknown as TableDef<{ id: number; other: number }>),
      isTableError('invalid_table'),
    );
  });

  await check(15, 'findById composes where id eq with limit 1', async () => {
    store.selectRows = [];
    store.selects = [];
    const found = await users.findById(5);
    assert.strictEqual(found, null);
    const recorded = store.lastSelect();
    assert.strictEqual(recorded.table, 'users');
    assert.deepStrictEqual(recorded.spec, { where: { id: { eq: 5 } }, limit: 1 });
  });

  console.log(`table selfcheck: ${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
