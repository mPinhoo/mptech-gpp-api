import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
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

  console.error('Unexpected error:', err.message);
  console.error('Stack:', err.stack);

  const isPrismaError = err.constructor?.name?.startsWith('Prisma');
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
