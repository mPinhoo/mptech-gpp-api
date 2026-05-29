import { Request } from 'express';
import { UnauthorizedError } from './errors.js';

export function getUserId(req: Request): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('Usuário não autenticado');
  }
  return userId;
}

export function withUserId(userId: string) {
  return { userId };
}
