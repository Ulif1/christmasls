import bcrypt from 'bcryptjs';

import { loadConfig } from './config';
import { driver } from './db';
import { syncSchema } from './db/schema';
import { createSchemaDriver } from './db/tooling';
import { isAppError } from './errors';
import { createModels } from './models';

async function sync(databaseUrl: string): Promise<void> {
  const schema = createSchemaDriver(databaseUrl);
  try {
    await schema.connect();
    await syncSchema(schema);
  } finally {
    await schema.close();
  }
}

async function main(): Promise<void> {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('Usage: npm run add-user <username> <password>');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  await driver.connect();
  try {
    // Idempotent first-run convenience: make sure the tables exist.
    await sync(config.databaseUrl);

    const models = createModels(driver);
    try {
      const user = await models.users.create(username, await bcrypt.hash(password, 10));
      console.log('User created:', user.username);
    } catch (error) {
      if (isAppError(error) && error.status === 409) {
        console.error('User already exists');
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  } finally {
    await driver.close();
  }
}

main().catch((error: unknown) => {
  console.error('Error adding user:', error);
  process.exit(1);
});
