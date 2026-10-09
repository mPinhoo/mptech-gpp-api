import { ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(422).json({ success:false, error:{message:'Dados inválidos.',code:'VALIDATION_ERROR'} });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  // Error objects may contain database inputs, payment data or credentials.
  const isPrismaError = err.constructor?.name?.startsWith('Prisma');
  console.error('[API] Request failed', { type: isPrismaError ? 'database' : 'internal' });

  const message = isPrismaError
    ? 'Erro de conexão com o banco de dados'
    : 'Erro interno do servidor';

  res.status(500).json({
    success: false,
    error: {
      message,
      code: 'INTERNAL_ERROR',
    },
  });
}
