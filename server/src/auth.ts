import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from './config';

export interface AuthUser {
  id: number;
  username: string;
}

export const authenticate: RequestHandler = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ message: 'No token' });
    return;
  }

  let payload: unknown;
  try {
    payload = jwt.verify(token, loadConfig().jwtSecret);
  } catch {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  if (typeof payload !== 'object' || payload === null) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  const claims = payload as Record<string, unknown>;
  const id = claims.id;
  const username = claims.username;
  if (typeof id !== 'number' || typeof username !== 'string') {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  req.user = { id, username };
  next();
};
