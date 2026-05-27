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

  console.error('Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: {
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
    },
  });
}
