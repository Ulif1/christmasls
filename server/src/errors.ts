export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export class AppError extends Error {
  readonly status: ErrorStatus;

  constructor(status: ErrorStatus, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(m = 'Invalid request') { super(400, m); }
}

export class UnauthorizedError extends AppError {
  constructor(m = 'Unauthorized') { super(401, m); }
}

export class ForbiddenError extends AppError {
  constructor(m = 'Forbidden') { super(403, m); }
}

export class NotFoundError extends AppError {
  constructor(m = 'Not found') { super(404, m); }
}

export class ConflictError extends AppError {
  constructor(m = 'Conflict') { super(409, m); }
}

export class InternalError extends AppError {
  constructor(m = 'Server error') { super(500, m); }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function toInternal(e: unknown, message: string): AppError {
  return isAppError(e) ? e : new InternalError(message);
}
