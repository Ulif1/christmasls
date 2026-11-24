import type { ErrorRequestHandler } from 'express';
import { AppError } from './errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  const status = (err as { status?: unknown } | null | undefined)?.status;
  if (typeof status === 'number' && status >= 400 && status <= 499) {
    const message = (err as { message?: unknown } | null | undefined)?.message;
    res.status(status).json({ message: String(message) });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error' });
};
