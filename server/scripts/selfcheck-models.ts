import assert from 'node:assert';
import { Table } from '../src/data/table';
import { PgDriver } from '../src/db/postgres';
import { DriverError } from '../src/db/types';
import { syncSchema } from '../src/db/schema';
import { ConflictError, ForbiddenError, ValidationError } from '../src/errors';
import { createModels, tableDefs } from '../src/models';
import type { ItemRow, ShareRow, UserRow } from '../src/models/types';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required to run the model selfcheck');
  process.exit(1);
}

const driver = new PgDriver(databaseUrl);
const models = createModels(driver);

const usersTable = new Table<UserRow>(driver, tableDefs.users);
const itemsTable = new Table<ItemRow>(driver, tableDefs.items);
const sharesTable = new Table<ShareRow>(driver, tableDefs.shares);

const suffix = `selfcheck_${Date.now().toString(36)}`;
const usernameA = `${suffix}_a`;
const usernameB = `${suffix}_b`;
const usernameC = `${suffix}_c`;

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

function isAppErrorWithStatus(
  type: new (...args: never[]) => Error,
  status: number,
): (error: unknown) => boolean {
  return (error: unknown): boolean =>
    error instanceof type && (error as Error & { status: number }).status === status;
}

async function main(): Promise<void> {
  try {
    await driver.connect();
    await syncSchema(driver);

    const a = await models.users.create(usernameA, 'hash-a');
    const b = await models.users.create(usernameB, 'hash-b');
    await models.users.create(usernameC, 'hash-c');

    await check(1, 'users.create hides the hash; findByUsername returns it', async () => {
      assert.deepStrictEqual(Object.keys(a).sort(), ['id', 'username']);
      assert.ok(!('passwordHash' in a), 'PublicUser must not expose passwordHash');
      const found = await models.users.findByUsername(usernameA);
      assert.ok(found, 'expected the user row');
      assert.strictEqual(found.passwordHash, 'hash-a');
    });

    await check(2, 'listForUser of a user with no lists is []', async () => {
      assert.deepStrictEqual(await models.lists.listForUser(a.id), []);
    });

    const list = await models.lists.create(a.id, 'Wishlist');

    await check(3, 'price round-trips as a number; missing price is null', async () => {
      const priced = await models.items.create(a.id, {
        name: 'Priced',
        price: 12.5,
        listId: list.id,
      });
      assert.strictEqual(typeof priced.price, 'number');
      assert.strictEqual(priced.price, 12.5);

      const unpriced = await models.items.create(a.id, { name: 'Unpriced', listId: list.id });
      assert.strictEqual(unpriced.price, null);
    });

    await check(4, 'a shared list carries its owner and never a password', async () => {
      await models.lists.share(a.id, list.id, usernameB);
      const bLists = await models.lists.listForUser(b.id);
      const shared = bLists.find((view) => view.id === list.id);
      assert.ok(shared, 'expected the shared list');
      assert.deepStrictEqual(shared.owner, { id: a.id, username: usernameA });

      const json = JSON.stringify(bLists);
      assert.ok(!json.includes('passwordHash'), 'passwordHash must not leak');
      assert.ok(!json.includes('password_hash'), 'password_hash must not leak');
    });

    await check(5, 're-sharing is idempotent (one list_shares row)', async () => {
      await models.lists.share(a.id, list.id, usernameB);
      const rows = await driver.select('list_shares', {
        where: { list_id: { eq: list.id }, user_id: { eq: b.id } },
      });
      assert.strictEqual(rows.length, 1);
    });

    await check(6, 'a seeded self-share yields the owned list exactly once, without owner', async () => {
      await sharesTable.insert({ listId: list.id, userId: a.id });
      const views = await models.lists.listForUser(a.id);
      const matches = views.filter((view) => view.id === list.id);
      assert.strictEqual(matches.length, 1, 'the list must not be duplicated');
      const view = matches[0];
      assert.ok(view, 'expected the owned list');
      assert.ok(!('owner' in view), "an owned list must not carry an 'owner' property");
    });

    await check(7, 'sharing with yourself is a ValidationError (400)', async () => {
      await assert.rejects(
        () => models.lists.share(a.id, list.id, usernameA),
        isAppErrorWithStatus(ValidationError, 400),
      );
    });

    await check(8, 'unshare is idempotent', async () => {
      await models.lists.share(a.id, list.id, usernameC);
      await models.lists.unshare(a.id, list.id, usernameC);
      await models.lists.unshare(a.id, list.id, usernameC);
    });

    await check(9, 'updateOwned/removeOwned reject non-owners and allow the owner', async () => {
      const editable = await models.items.create(a.id, { name: 'Editable', listId: list.id });

      await assert.rejects(
        () => models.items.updateOwned(b.id, editable.id, { name: 'Hijacked' }),
        isAppErrorWithStatus(ForbiddenError, 403),
      );
      await assert.rejects(
        () => models.items.removeOwned(b.id, editable.id),
        isAppErrorWithStatus(ForbiddenError, 403),
      );

      const updated = await models.items.updateOwned(a.id, editable.id, { name: 'Renamed' });
      assert.strictEqual(updated.name, 'Renamed');

      const doomed = await models.items.create(a.id, { name: 'Doomed', listId: list.id });
      await models.items.removeOwned(a.id, doomed.id);
      assert.strictEqual(await itemsTable.findById(doomed.id), null);
    });

    await check(10, 'setPurchased rejects the owner and allows a shared user', async () => {
      const purchaseList = await models.lists.create(a.id, 'Purchases');
      await models.lists.share(a.id, purchaseList.id, usernameB);
      const item = await models.items.create(a.id, { name: 'Gift', listId: purchaseList.id });

      await assert.rejects(
        () => models.items.setPurchased(a.id, item.id, true),
        isAppErrorWithStatus(ForbiddenError, 403),
      );

      const purchased = await models.items.setPurchased(b.id, item.id, true);
      assert.strictEqual(purchased.purchased, true);
    });

    await check(11, 'items.findMany({in: []}) returns [] on real PostgreSQL', async () => {
      assert.deepStrictEqual(await itemsTable.findMany({ where: { listId: { in: [] } } }), []);
    });

    await check(12, 'a throw after insert rolls the row back', async () => {
      const txnName = `${suffix}_txn`;
      await assert.rejects(
        () =>
          driver.transaction(async (tx) => {
            const users = new Table<UserRow>(tx, tableDefs.users);
            await users.insert({ username: txnName, passwordHash: 'txn-hash' });
            throw new Error('force rollback');
          }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === 'force rollback' &&
          !(error instanceof DriverError),
      );
      const survivors = await usersTable.findMany({ where: { username: { eq: txnName } } });
      assert.strictEqual(survivors.length, 0);
    });

    await check(13, 'an unfiltered delete is refused', async () => {
      await assert.rejects(
        () => driver.delete('users', {}),
        (error: unknown) => error instanceof DriverError && error.code === 'unfiltered_write',
      );
    });

    await check(14, 'creating a duplicate username is a ConflictError (409)', async () => {
      const duplicate = `${suffix}_dup`;
      await models.users.create(duplicate, 'hash-1');
      await assert.rejects(
        () => models.users.create(duplicate, 'hash-2'),
        isAppErrorWithStatus(ConflictError, 409),
      );
    });

    await check(15, 'numeric decodes back to a number', async () => {
      const created = await itemsTable.insert({
        name: 'Seven',
        price: 7,
        purchased: false,
        listId: list.id,
      });
      const reloaded = await itemsTable.findById(created.id);
      assert.ok(reloaded, 'expected the inserted item');
      assert.strictEqual(typeof reloaded.price, 'number');
      assert.strictEqual(reloaded.price, 7);
    });

    await check(16, 'ragged insertMany rows are rejected', async () => {
      await assert.rejects(
        () =>
          itemsTable.insertMany([
            { name: 'Ragged A', listId: list.id },
            { name: 'Ragged B', purchased: false, listId: list.id },
          ]),
        (error: unknown) => error instanceof DriverError,
      );
    });

    console.log(`model selfcheck: ${passed} passed`);
  } finally {
    await driver.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
