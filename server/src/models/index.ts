import { Table } from '../data/table';
import type { TableDef } from '../data/table';
import type { Driver } from '../db/types';
import { ItemModel } from './item';
import { ListModel } from './list';
import { UserModel } from './user';
import type { ItemRow, ListRow, PublicUser, ShareRow, UserRow } from './types';

const userTable: TableDef<UserRow> = {
  name: 'users',
  columns: {
    id: { column: 'id', type: 'int' },
    username: { column: 'username', type: 'text' },
    passwordHash: { column: 'password_hash', type: 'text' },
  },
};

/**
 * Deliberately narrow projection of `users`: because the column map has no
 * `passwordHash` entry, `fromRow` cannot decode one and a hash can never reach
 * a list payload.
 */
const usersPublicTable: TableDef<PublicUser> = {
  name: 'users',
  columns: {
    id: { column: 'id', type: 'int' },
    username: { column: 'username', type: 'text' },
  },
};

const listTable: TableDef<ListRow> = {
  name: 'christmas_lists',
  columns: {
    id: { column: 'id', type: 'int' },
    name: { column: 'name', type: 'text' },
    userId: { column: 'user_id', type: 'int' },
  },
};

const itemTable: TableDef<ItemRow> = {
  name: 'items',
  columns: {
    id: { column: 'id', type: 'int' },
    name: { column: 'name', type: 'text' },
    description: { column: 'description', type: 'text', nullable: true },
    price: { column: 'price', type: 'numeric', nullable: true },
    purchased: { column: 'purchased', type: 'bool' },
    listId: { column: 'list_id', type: 'int' },
  },
};

const shareTable: TableDef<ShareRow> = {
  name: 'list_shares',
  columns: {
    id: { column: 'id', type: 'int' },
    listId: { column: 'list_id', type: 'int' },
    userId: { column: 'user_id', type: 'int' },
  },
};

export interface TableDefinitions {
  users: TableDef<UserRow>;
  usersPublic: TableDef<PublicUser>;
  lists: TableDef<ListRow>;
  items: TableDef<ItemRow>;
  shares: TableDef<ShareRow>;
}

export const tableDefs: TableDefinitions = {
  users: userTable,
  usersPublic: usersPublicTable,
  lists: listTable,
  items: itemTable,
  shares: shareTable,
};

export interface Models {
  users: UserModel;
  lists: ListModel;
  items: ItemModel;
}

export function createModels(driver: Driver): Models {
  const tables = {
    users: new Table(driver, tableDefs.users),
    usersPublic: new Table(driver, tableDefs.usersPublic),
    lists: new Table(driver, tableDefs.lists),
    items: new Table(driver, tableDefs.items),
    shares: new Table(driver, tableDefs.shares),
  };

  return {
    users: new UserModel(tables.users, tables.usersPublic),
    lists: new ListModel(driver, tables, tableDefs),
    items: new ItemModel(tables.items, tables.lists, tables.shares),
  };
}
