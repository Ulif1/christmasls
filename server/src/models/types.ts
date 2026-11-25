export interface UserRow {
  id: number;
  username: string;
  passwordHash: string;
}

export interface PublicUser {
  id: number;
  username: string;
}

export interface ListRow {
  id: number;
  name: string;
  userId: number;
}

export interface ItemRow {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  purchased: boolean;
  listId: number;
}

export interface ShareRow {
  id: number;
  listId: number;
  userId: number;
}

export interface ItemView {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  purchased: boolean;
}

export interface ListView {
  id: number;
  name: string;
  items: ItemView[];
  sharedWith: PublicUser[];
  owner?: PublicUser;
}

export interface ItemInput {
  name: string;
  description?: string | null;
  price?: number | null;
  listId: number;
}

export interface ItemPatch {
  name?: string;
  description?: string | null;
  price?: number | null;
}
