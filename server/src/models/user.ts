import { Table } from '../data/table';
import { run } from './errors';
import type { PublicUser, UserRow } from './types';

export class UserModel {
  constructor(
    private readonly users: Table<UserRow>,
    private readonly usersPublic: Table<PublicUser>,
  ) {}

  create(username: string, passwordHash: string): Promise<PublicUser> {
    return run(async () => {
      const created = await this.users.insert({ username, passwordHash });
      return { id: created.id, username: created.username };
    });
  }

  findById(id: number): Promise<UserRow | null> {
    return run(() => this.users.findById(id));
  }

  findByUsername(username: string): Promise<UserRow | null> {
    return run(() => this.users.findOne({ username: { eq: username } }));
  }

  listUsernames(): Promise<string[]> {
    return run(async () => {
      const rows = await this.usersPublic.findMany({
        orderBy: [{ property: 'id', direction: 'asc' }],
      });
      return rows.map((row) => row.username);
    });
  }

  listOthers(actorId: number): Promise<PublicUser[]> {
    return run(async () => {
      const rows = await this.usersPublic.findMany({
        where: { id: { ne: actorId } },
        orderBy: [{ property: 'id', direction: 'asc' }],
      });
      return rows.map((row) => ({ id: row.id, username: row.username }));
    });
  }
}
