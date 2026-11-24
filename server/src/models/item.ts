import { Table } from '../data/table';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { run } from './errors';
import type { ItemInput, ItemPatch, ItemRow, ItemView, ListRow, ShareRow } from './types';

function toItemView(row: ItemRow): ItemView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    purchased: row.purchased,
  };
}

function toPrice(value: number | string | null | undefined): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError('Invalid price');
  }
  return parsed;
}

export class ItemModel {
  constructor(
    private readonly items: Table<ItemRow>,
    private readonly lists: Table<ListRow>,
    private readonly shares: Table<ShareRow>,
  ) {}

  create(actorId: number, input: ItemInput): Promise<ItemView> {
    return run(async () => {
      const owned = await this.lists.exists({
        id: { eq: input.listId },
        userId: { eq: actorId },
      });
      if (!owned) {
        throw new NotFoundError('List not found');
      }

      const created = await this.items.insert({
        name: input.name,
        description: input.description ?? null,
        price: toPrice(input.price) ?? null,
        purchased: false,
        listId: input.listId,
      });
      return toItemView(created);
    });
  }

  setPurchased(actorId: number, itemId: number, purchased: boolean): Promise<ItemView> {
    return run(async () => {
      const item = await this.items.findById(itemId);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      // Preserved today's behaviour: only explicit shares may tick an item off,
      // so the owner (who is not in `list_shares`) gets 403 here.
      const shared = await this.shares.exists({
        listId: { eq: item.listId },
        userId: { eq: actorId },
      });
      if (!shared) {
        throw new ForbiddenError('Not authorized');
      }

      const updated = await this.items.update(
        { id: { eq: itemId } },
        { purchased: Boolean(purchased) },
      );
      const row = updated[0];
      if (!row) {
        throw new NotFoundError('Item not found');
      }
      return toItemView(row);
    });
  }

  updateOwned(actorId: number, itemId: number, patch: ItemPatch): Promise<ItemView> {
    return run(async () => {
      const item = await this.items.findById(itemId);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const owned = await this.lists.exists({
        id: { eq: item.listId },
        userId: { eq: actorId },
      });
      if (!owned) {
        throw new ForbiddenError('Not authorized');
      }

      // Copy only keys the caller actually supplied. `description` and `price`
      // may legitimately be `null` (clear the value), which `undefined` cannot
      // express.
      const next: Partial<ItemRow> = {};
      if (patch.name !== undefined) {
        next.name = patch.name;
      }
      if (patch.description !== undefined) {
        next.description = patch.description;
      }
      if (patch.price !== undefined) {
        next.price = toPrice(patch.price) ?? null;
      }

      if (Object.keys(next).length === 0) {
        return toItemView(item);
      }

      const updated = await this.items.update({ id: { eq: itemId } }, next);
      const row = updated[0];
      if (!row) {
        throw new NotFoundError('Item not found');
      }
      return toItemView(row);
    });
  }

  removeOwned(actorId: number, itemId: number): Promise<void> {
    return run(async () => {
      const item = await this.items.findById(itemId);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const owned = await this.lists.exists({
        id: { eq: item.listId },
        userId: { eq: actorId },
      });
      if (!owned) {
        throw new ForbiddenError('Not authorized');
      }

      await this.items.delete({ id: { eq: itemId } });
    });
  }
}
