import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import bcrypt from 'bcryptjs';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  synchronize: true,
});

const app = express();
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
      res.json({ message: 'Login successful' });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});