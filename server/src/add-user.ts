import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { ChristmasList } from './entities/ChristmasList';
import { Item } from './entities/Item';
import bcrypt from 'bcryptjs';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, ChristmasList, Item],
  synchronize: true,
});

async function addUser() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('Usage: npm run add-user <username> <password>');
    process.exit(1);
  }

  await AppDataSource.initialize();
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const existingUser = await AppDataSource.manager.findOne(User, { where: { username } });
    if (!existingUser) {
      const user = await AppDataSource.manager.save(User, { username, password: hashedPassword });
      console.log('User created:', user.username);
    } else {
      console.log('User already exists');
    }
  } catch (error) {
    console.error('Error adding user:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

addUser();