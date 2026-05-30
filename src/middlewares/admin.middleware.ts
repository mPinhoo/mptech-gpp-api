import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors.js';
import { isAdminEmail } from '../utils/admin.js';

export function adminMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || !isAdminEmail(req.user.email)) {
    throw new ForbiddenError('Acesso restrito a administradores');
  }
  next();
}

export function requireRealAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new ForbiddenError('Não autorizado');
  }
  if (req.user.impersonatedBy) {
    throw new ForbiddenError('Encerre a impersonação para usar esta função');
  }
  if (!isAdminEmail(req.user.email)) {
    throw new ForbiddenError('Acesso restrito a administradores');
  }
  next();
}
