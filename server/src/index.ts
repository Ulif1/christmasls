import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { loadConfig } from './config';
import { driver } from './db';
import { verifyDatabaseSchema } from './db/tooling';
import { authenticate } from './auth';
import { errorHandler } from './error-middleware';
import { isAppError, toInternal, ValidationError } from './errors';
import { parseId, parsePositiveInt } from './http/parse-id';
import { createModels } from './models';
import type { ItemPatch } from './models/types';

const app = express();
const config = loadConfig();
const models = createModels(driver);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/api/register', async (req, res) => {
  const body = req.body ?? {};
  try {
    const username = body.username;
    const password = body.password;
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      throw new ValidationError('Username and password are required');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await models.users.create(username, passwordHash);
    res.json({ message: 'User registered' });
    return;
  } catch (error) {
    if (isAppError(error) && (error.status === 400 || error.status === 409)) {
      res.status(400).json({ message: 'User already exists or error' });
      return;
    }
    throw error;
  }
});

app.post('/api/login', async (req, res) => {
  const body = req.body ?? {};
  const username = body.username;
  const password = body.password;
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    throw new ValidationError('Username and password are required');
  }

  const user = await models.users.findByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret);
  res.json({ message: 'Login successful', token });
});

app.get('/api/lists', authenticate, async (req, res) => {
  const lists = await models.lists.listForUser(req.user!.id);
  res.json(
    lists.map(({ owner, ...rest }) => (owner ? { ...rest, user: owner } : rest)),
  );
});

app.post('/api/lists', authenticate, async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name !== 'string' || !body.name) {
    throw new ValidationError('Name is required');
  }
  const list = await models.lists.create(req.user!.id, body.name);
  res.json({ id: list.id, name: list.name });
});

app.put('/api/lists/:id', authenticate, async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name !== 'string' || !body.name) {
    throw new ValidationError('Name is required');
  }
  const list = await models.lists.rename(req.user!.id, parseId(req.params.id), body.name);
  res.json({ id: list.id, name: list.name });
});

app.delete('/api/lists/:id', authenticate, async (req, res) => {
  await models.lists.remove(req.user!.id, parseId(req.params.id));
  res.json({ message: 'List deleted' });
});

app.post('/api/lists/:id/share', authenticate, async (req, res) => {
  const body = req.body ?? {};
  const username = body.username;
  if (typeof username !== 'string' || !username) {
    throw new ValidationError('Username is required');
  }

  const listId = parseId(req.params.id);
  if (username === 'all') {
    await models.lists.shareWithAll(req.user!.id, listId);
    res.json({ message: 'List shared with all users' });
    return;
  }

  await models.lists.share(req.user!.id, listId, username);
  res.json({ message: 'List shared' });
});

app.post('/api/lists/:id/unshare', authenticate, async (req, res) => {
  const body = req.body ?? {};
  const username = body.username;
  if (typeof username !== 'string' || !username) {
    throw new ValidationError('Username is required');
  }

  await models.lists.unshare(req.user!.id, parseId(req.params.id), username);
  res.json({ message: 'Sharing removed' });
});

app.get('/api/users', authenticate, async (_req, res) => {
  res.json(await models.users.listUsernames());
});

app.post('/api/items', authenticate, async (req, res) => {
  const body = req.body ?? {};
  const name = body.name;
  const listId = parsePositiveInt(body.listId);
  if (typeof name !== 'string' || !name) {
    throw new ValidationError('Name is required');
  }
  if (listId === null) {
    throw new ValidationError('Invalid list id');
  }

  const item = await models.items.create(req.user!.id, {
    name,
    description: body.description,
    price: body.price,
    listId,
  });
  res.json(item);
});

app.put('/api/items/:id/purchase', authenticate, async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.purchased !== 'boolean') {
    throw new ValidationError('Invalid purchased value');
  }
  const item = await models.items.setPurchased(
    req.user!.id,
    parseId(req.params.id),
    body.purchased,
  );
  res.json(item);
});

app.put('/api/items/:id', authenticate, async (req, res, next) => {
  const body = req.body ?? {};
  const patch: ItemPatch = {
    name: body.name,
    description: body.description,
    price: body.price,
  };
  try {
    const item = await models.items.updateOwned(
      req.user!.id,
      parseId(req.params.id),
      patch,
    );
    res.json(item);
  } catch (error) {
    next(toInternal(error, 'Error Editing Item'));
  }
});

app.delete('/api/items/:id', authenticate, async (req, res, next) => {
  try {
    await models.items.removeOwned(req.user!.id, parseId(req.params.id));
    res.json({ message: 'Item deleted' });
  } catch (error) {
    next(toInternal(error, 'Error Deleting Item'));
  }
});

app.use(errorHandler);

async function main(): Promise<void> {
  await driver.connect();
  await verifyDatabaseSchema(config.databaseUrl);

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });

  const shutdown = (): void => {
    driver.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start server: ${message}`);
  if (!message.includes('npm run db:sync')) {
    console.error('Check the database connection and run: npm run db:sync');
  }
  process.exit(1);
});
