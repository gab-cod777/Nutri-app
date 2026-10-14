/**
 * Erro de dominio: a entrada violou uma regra de negocio ou um limite fisico.
 *
 * O dominio nao conhece HTTP. A camada de transporte (Express) traduz isso
 * para 422 no error handler global - ver `apps/api/src/http/error-handler.ts`.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** Valida que um numero e finito e esta dentro de [min, max]. */
export function assertInRange(
  value: number,
  range: { readonly min: number; readonly max: number },
  field: string,
): void {
  if (!Number.isFinite(value)) {
    throw new DomainError('invalid_number', `${field} deve ser um numero finito.`, { field, value });
  }
  if (value < range.min || value > range.max) {
    throw new DomainError(
      'out_of_range',
      `${field} deve estar entre ${range.min} e ${range.max}.`,
      { field, value, min: range.min, max: range.max },
    );
  }
}
