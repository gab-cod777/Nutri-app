/**
 * Erros de aplicacao com status HTTP.
 *
 * Services lancam estes erros; o error handler global os traduz para o corpo
 * padrao `{ error: { code, message, details, requestId } }`. Regras de dominio
 * puras continuam lancando `DomainError` do core (vira 422).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** 404 tambem para recurso de outro usuario: nao confirmamos existencia. */
export function notFound(resource: string): AppError {
  return new AppError(404, 'not_found', `${resource} nao encontrado.`);
}

export function conflict(code: string, message: string, details?: Record<string, unknown>): AppError {
  return new AppError(409, code, message, details);
}

export function unprocessable(code: string, message: string, details?: Record<string, unknown>): AppError {
  return new AppError(422, code, message, details);
}

export function unauthorized(code: string, message: string): AppError {
  return new AppError(401, code, message);
}

export function tooManyRequests(code: string, message: string, details?: Record<string, unknown>): AppError {
  return new AppError(429, code, message, details);
}

export function badGateway(code: string, message: string, details?: Record<string, unknown>): AppError {
  return new AppError(502, code, message, details);
}
