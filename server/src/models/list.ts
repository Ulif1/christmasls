import { Table } from '../data/table';
import type { TableDef } from '../data/table';
import type { Driver } from '../db/types';
import { ConflictError, InternalError, NotFoundError, ValidationError } from '../errors';
import { run } from './errors';
import type { ItemRow, ItemView, ListRow, ListView, PublicUser, ShareRow } from './types';

export interface ListModelTables {
  lists: Table<ListRow>;
  items: Table<ItemRow>;
  shares: Table<ShareRow>;
  usersPublic: Table<PublicUser>;
}

export interface ListModelDefs {
  lists: TableDef<ListRow>;
  items: TableDef<ItemRow>;
  shares: TableDef<ShareRow>;
  usersPublic: TableDef<PublicUser>;
}

function toItemView(row: ItemRow): ItemView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    purchased: row.purchased,
  };
}

function toPublicUser(row: PublicUser): PublicUser {
  return { id: row.id, username: row.username };
}

export class ListModel {
  constructor(
    private readonly driver: Driver,
    private readonly tables: ListModelTables,
    private readonly defs: ListModelDefs,
  ) {}

  private async requireOwned(listId: number, actorId: number): Promise<ListRow> {
    const list = await this.tables.lists.findOne({
      id: { eq: listId },
      userId: { eq: actorId },
    });
    if (!list) {
      throw new NotFoundError('List not found');
    }
    return list;
  }

  listForUser(actorId: number): Promise<ListView[]> {
    return run(async () => {
      // 1. Lists the actor owns.
      const ownedRows = await this.tables.lists.findMany({
        where: { userId: { eq: actorId } },
        orderBy: [{ property: 'id', direction: 'asc' }],
      });

      // 2. Share records that point at the actor.
      const myShares = await this.tables.shares.findMany({
        where: { userId: { eq: actorId } },
      });

      // 3. Owned wins: a self-share or overlapping share must not duplicate.
      const ownedIds = new Set(ownedRows.map((row) => row.id));
      const sharedIds = myShares.map((share) => share.listId).filter((id) => !ownedIds.has(id));

      // 4. Deliberately no `if (sharedIds.length)` guard: `{in: []}` is a no-op.
      const sharedRows = await this.tables.lists.findMany({
        where: { id: { in: sharedIds } },
        orderBy: [{ property: 'id', direction: 'asc' }],
      });

      // 5/6. One item query for every list the actor can see.
      const allIds = [...ownedRows, ...sharedRows].map((row) => row.id);
      const itemRows = await this.tables.items.findMany({
        where: { listId: { in: allIds } },
        orderBy: [{ property: 'id', direction: 'asc' }],
      });

      // 7. One share query for the same set of lists.
      const allShareRows = await this.tables.shares.findMany({
        where: { listId: { in: allIds } },
        orderBy: [{ property: 'id', direction: 'asc' }],
      });

      // 8/9. One user query covers sharedWith members and shared-list owners.
      const userIds = [
        ...new Set([
          ...allShareRows.map((share) => share.userId),
          ...sharedRows.map((row) => row.userId),
        ]),
      ];
      const userRows = await this.tables.usersPublic.findMany({
        where: { id: { in: userIds } },
        orderBy: [{ property: 'id', direction: 'asc' }],
      });

      const usersById = new Map(userRows.map((user) => [user.id, user]));

      const itemsByList = new Map<number, ItemRow[]>();
      for (const item of itemRows) {
        const bucket = itemsByList.get(item.listId) ?? [];
        bucket.push(item);
        itemsByList.set(item.listId, bucket);
      }

      const sharesByList = new Map<number, ShareRow[]>();
      for (const share of allShareRows) {
        const bucket = sharesByList.get(share.listId) ?? [];
        bucket.push(share);
        sharesByList.set(share.listId, bucket);
      }

      // The owner of each visible list, so a legacy self-share row can be
      // filtered out of `sharedWith` instead of showing the owner back to
      // themselves.
      const ownersByList = new Map<number, number>(
        [...ownedRows, ...sharedRows].map((row) => [row.id, row.userId]),
      );

      const sharedWith = (listId: number): PublicUser[] => {
        const ownerId = ownersByList.get(listId);
        return (sharesByList.get(listId) ?? [])
          .filter((share) => share.userId !== ownerId)
          .map((share) => usersById.get(share.userId))
          .filter((user): user is PublicUser => user !== undefined)
          .map(toPublicUser)
          .sort((a, b) => a.id - b.id);
      };

      const items = (listId: number): ItemView[] =>
        (itemsByList.get(listId) ?? []).map(toItemView);

      const ownedViews: ListView[] = ownedRows.map((row) => ({
        id: row.id,
        name: row.name,
        items: items(row.id),
        sharedWith: sharedWith(row.id),
      }));

      const sharedViews: ListView[] = sharedRows.map((row) => {
        const owner = usersById.get(row.userId);
        if (!owner) {
          // userIds includes every shared row's owner, so this is unreachable
          // unless the database has lost referential integrity.
          throw new InternalError('Server error');
        }
        return {
          id: row.id,
          name: row.name,
          items: items(row.id),
          sharedWith: sharedWith(row.id),
          owner: toPublicUser(owner),
        };
      });

      return [...ownedViews, ...sharedViews];
    });
  }

  create(actorId: number, name: string): Promise<{ id: number; name: string }> {
    return run(async () => {
      const actor = await this.tables.usersPublic.findById(actorId);
      if (!actor) {
        throw new NotFoundError('User not found');
      }
      const created = await this.tables.lists.insert({ name, userId: actorId });
      return { id: created.id, name: created.name };
    });
  }

  rename(actorId: number, listId: number, name: string): Promise<{ id: number; name: string }> {
    return run(async () => {
      const updated = await this.tables.lists.update(
        { id: { eq: listId }, userId: { eq: actorId } },
        { name },
      );
      const list = updated[0];
      if (!list) {
        throw new NotFoundError('List not found');
      }
      return { id: list.id, name: list.name };
    });
  }

  remove(actorId: number, listId: number): Promise<void> {
    return run(async () => {
      const removed = await this.tables.lists.delete({
        id: { eq: listId },
        userId: { eq: actorId },
      });
      if (removed === 0) {
        throw new NotFoundError('List not found');
      }
    });
  }

  share(actorId: number, listId: number, username: string): Promise<void> {
    return run(async () => {
      await this.requireOwned(listId, actorId);

      const actor = await this.tables.usersPublic.findById(actorId);
      if (!actor) {
        throw new NotFoundError('User not found');
      }

      if (username === actor.username) {
        throw new ValidationError('Cannot share with yourself');
      }

      const target = await this.tables.usersPublic.findOne({ username: { eq: username } });
      if (!target) {
        throw new NotFoundError('User not found');
      }

      if (
        await this.tables.shares.exists({
          listId: { eq: listId },
          userId: { eq: target.id },
        })
      ) {
        return;
      }

      try {
        await run(() => this.tables.shares.insert({ listId, userId: target.id }));
      } catch (error) {
        // Lost a race on UNIQUE(list_id, user_id): another request already
        // created exactly the row we wanted, so the outcome is success.
        if (error instanceof ConflictError) {
          return;
        }
        throw error;
      }
    });
  }

  async shareWithAll(actorId: number, listId: number): Promise<number> {
    const maxAttempts = 3;
    let lastConflict: ConflictError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await run(() =>
          this.driver.transaction(async (tx) => {
            // Inside a transaction we build tables over the provided store;
            // calling `createModels(tx)` would hand out the wrong driver.
            const lists = new Table<ListRow>(tx, this.defs.lists);
            const shares = new Table<ShareRow>(tx, this.defs.shares);
            const users = new Table<PublicUser>(tx, this.defs.usersPublic);

            // A list can be deleted while we are retrying.
            const owned = await lists.findOne({ id: { eq: listId }, userId: { eq: actorId } });
            if (!owned) {
              throw new NotFoundError('List not found');
            }

            const others = await users.findMany({ where: { id: { ne: actorId } } });
            const existing = await shares.findMany({ where: { listId: { eq: listId } } });
            const have = new Set(existing.map((share) => share.userId));
            const missing = others.filter((user) => !have.has(user.id));

            if (missing.length === 0) {
              return existing.length;
            }

            await shares.insertMany(missing.map((user) => ({ listId, userId: user.id })));

            return existing.length + missing.length;
          }),
        );
      } catch (error) {
        // The single multi-row INSERT is atomic: one conflicting row aborts the
        // whole statement, so the other users were not written. Never report
        // success here; a concurrent writer changed `existing`, and the next
        // attempt recomputes the missing set from the committed state.
        if (!(error instanceof ConflictError)) {
          throw error;
        }
        lastConflict = error;
      }
    }

    // Attempts are exhausted. Only claim success if a fresh read proves every
    // non-actor user now has a share; otherwise surface the real failure.
    return run(async () => {
      const shares = await this.tables.shares.findMany({
        where: { listId: { eq: listId } },
      });
      const others = await this.tables.usersPublic.findMany({
        where: { id: { ne: actorId } },
      });
      const have = new Set(shares.map((share) => share.userId));
      if (!others.every((user) => have.has(user.id))) {
        throw lastConflict ?? new ConflictError('Already exists');
      }
      return shares.length;
    });
  }

  unshare(actorId: number, listId: number, username: string): Promise<void> {
    return run(async () => {
      await this.requireOwned(listId, actorId);

      const target = await this.tables.usersPublic.findOne({ username: { eq: username } });
      if (!target) {
        throw new NotFoundError('User not found');
      }

      // Idempotent: removing a share that is not there is not an error.
      await this.tables.shares.delete({ listId: { eq: listId }, userId: { eq: target.id } });
    });
  }

  isSharedWith(listId: number, userId: number): Promise<boolean> {
    return run(() =>
      this.tables.shares.exists({ listId: { eq: listId }, userId: { eq: userId } }),
    );
  }
}
