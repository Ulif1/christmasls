import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import { DataSource } from 'typeorm';
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
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret');
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
    const lists = await AppDataSource.manager.find(ChristmasList, {
      where: { user: { id: req.user.id } },
      relations: ['items'],
    });
    res.json(lists);
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});