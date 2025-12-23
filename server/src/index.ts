import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import { DataSource, Not } from 'typeorm';
import { User } from './entities/User';
import { ChristmasList } from './entities/ChristmasList';
import { Item } from './entities/Item';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();


const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, ChristmasList, Item],
  synchronize: true,
});

const authenticate = (req: any, res: any, next: any) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

AppDataSource.initialize().then(() => {
  console.log('Database connected');
}).catch((error) => console.log(error));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await AppDataSource.manager.save(User, { username, password: hashedPassword });
    res.json({ message: 'User registered' });
  } catch (error) {
    res.status(400).json({ message: 'User already exists or error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await AppDataSource.manager.findOne(User, { where: { username } });
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret');
      res.json({ message: 'Login successful', token });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/lists', authenticate, async (req: any, res) => {
  try {
    const ownedLists = await AppDataSource.manager.find(ChristmasList, {
      where: { user: { id: req.user.id } },
      relations: ['items', 'sharedWith'],
    });
    const sharedLists = await AppDataSource.manager.find(ChristmasList, {
      where: { sharedWith: { id: req.user.id } },
      relations: ['items', 'user', 'sharedWith'],
    });
    const allLists = [...ownedLists, ...sharedLists];
    res.json(allLists);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/lists', authenticate, async (req: any, res) => {
  const { name } = req.body;
  try {
    const user = await AppDataSource.manager.findOne(User, { where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const list = await AppDataSource.manager.save(ChristmasList, { name, user });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/lists/:id', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const list = await AppDataSource.manager.findOne(ChristmasList, {
      where: { id: parseInt(id), user: { id: req.user.id } },
    });
    if (!list) return res.status(404).json({ message: 'List not found' });
    list.name = name;
    await AppDataSource.manager.save(list);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/lists/:id', authenticate, async (req: any, res) => {
  const { id } = req.params;
  console.log('Deleting list:', id, 'User:', req.user.id);
  try {
    const list = await AppDataSource.manager.findOne(ChristmasList, {
      where: { id: parseInt(id), user: { id: req.user.id } },
    });
    console.log('List found:', list);
    if (!list) return res.status(404).json({ message: 'List not found' });
    await AppDataSource.manager.remove(list);
    res.json({ message: 'List deleted' });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/lists/:id/share', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { username } = req.body;
  try {
    const list = await AppDataSource.manager.findOne(ChristmasList, {
      where: { id: parseInt(id), user: { id: req.user.id } },
      relations: ['sharedWith'],
    });
    if (!list) return res.status(404).json({ message: 'List not found' });
    if (username === 'all') {
      const allUsers = await AppDataSource.manager.find(User, { where: { id: Not(req.user.id) } });
      list.sharedWith = [...list.sharedWith, ...allUsers.filter(u => !list.sharedWith.some(s => s.id === u.id))];
      await AppDataSource.manager.save(list);
      res.json({ message: 'List shared with all users' });
    } else {
      const userToShare = await AppDataSource.manager.findOne(User, { where: { username } });
      if (!userToShare) return res.status(404).json({ message: 'User not found' });
      if (!list.sharedWith.some(u => u.id === userToShare.id)) {
        list.sharedWith.push(userToShare);
        await AppDataSource.manager.save(list);
      }
      res.json({ message: 'List shared' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/lists/:id/unshare', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { username } = req.body;
  try {
    const list = await AppDataSource.manager.findOne(ChristmasList, {
      where: { id: parseInt(id), user: { id: req.user.id } },
      relations: ['sharedWith'],
    });
    if (!list) return res.status(404).json({ message: 'List not found' });
    const userToUnshare = await AppDataSource.manager.findOne(User, { where: { username } });
    if (!userToUnshare) return res.status(404).json({ message: 'User not found' });
    list.sharedWith = list.sharedWith.filter(u => u.id !== userToUnshare.id);
    await AppDataSource.manager.save(list);
    res.json({ message: 'Sharing removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users', authenticate, async (req: any, res) => {
  try {
    const users = await AppDataSource.manager.find(User, { select: ['username'] });
    res.json(users.map(u => u.username));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/items', authenticate, async (req: any, res) => {
  const { name, description, price, listId } = req.body;
  try {
    const list = await AppDataSource.manager.findOne(ChristmasList, {
      where: { id: listId, user: { id: req.user.id } },
    });
    if (!list) return res.status(404).json({ message: 'List not found' });
    const item = await AppDataSource.manager.save(Item, { name, description, price, list });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/items/:id/purchase', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { purchased } = req.body;
  try {
    const item = await AppDataSource.manager.findOne(Item, {
      where: { id: parseInt(id) },
      relations: ['list', 'list.sharedWith'],
    });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    // Check if user is shared with the list
    const isShared = item.list.sharedWith.some(u => u.id === req.user.id);
    if (!isShared) return res.status(403).json({ message: 'Not authorized' });
    item.purchased = purchased;
    await AppDataSource.manager.save(item);
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/items/:id', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;
  try {
    const item = await AppDataSource.manager.findOne(Item, { where: { id: parseInt(id) } });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    // TODO: Add user authorization check
    item.name = name;
    item.description = description;
    item.price = parseFloat(price) || undefined;
    await AppDataSource.manager.save(item);
    res.json(item);
  } catch (error) {
    console.error('Error editing item:', error);
    res.status(500).json({ message: 'Error Editing Item' });
  }
});

app.delete('/api/items/:id', authenticate, async (req: any, res) => {
  const { id } = req.params;
  try {
    const item = await AppDataSource.manager.findOne(Item, { where: { id: parseInt(id) }, relations: ['list'] });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    const userLists = await AppDataSource.manager.find(ChristmasList, { where: { user: { id: req.user.id } } });
    const isOwner = userLists.some(list => list.id === item.list?.id);
    if (!isOwner) return res.status(403).json({ message: 'Not authorized' });
    await AppDataSource.manager.remove(item);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Error Deleting Item' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});