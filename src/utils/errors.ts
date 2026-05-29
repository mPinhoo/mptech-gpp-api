export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} não encontrado(a)`, 404, 'NOT_FOUND');
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos') {
    super(message, 422, 'VALIDATION_ERROR');
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED');
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados') {
    super(message, 409, 'CONFLICT');
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}
