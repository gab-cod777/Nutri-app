import { isDomainError } from '@nutrisnap/core';
import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

interface ErrorBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown> | undefined;
}

/** Erros do body-parser do Express trazem `type` e `status`. */
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

export function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof ZodError) {
    return {
      statusCode: 422,
      code: 'validation_failed',
      message: 'Dados invalidos.',
      details: { issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })) },
    };
  }
  if (isDomainError(error)) {
    return { statusCode: 422, code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return { statusCode: 413, code: 'photo_too_large', message: 'A foto excede o tamanho maximo.' };
    }
    return { statusCode: 422, code: 'invalid_upload', message: 'Envie a foto no campo "foto" (multipart/form-data).' };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return { statusCode: 404, code: 'not_found', message: 'Recurso nao encontrado.' };
    if (error.code === 'P2002') return { statusCode: 409, code: 'conflict', message: 'Conflito com um registro existente.' };
  }
  if (isBodyParserError(error)) {
    if (error.type === 'entity.too.large') {
      return { statusCode: 413, code: 'payload_too_large', message: 'Corpo da requisicao grande demais.' };
    }
    if (error.status >= 400 && error.status < 500) {
      return { statusCode: 400, code: 'malformed_request', message: 'Requisicao malformada (JSON invalido?).' };
    }
  }
  return { statusCode: 500, code: 'internal_error', message: 'Erro interno.' };
}

/**
 * Handler global. Em producao, 5xx nunca expoe detalhe ao cliente: a mensagem
 * e generica e o detalhe vai para o log, correlacionado pelo `requestId`.
 */
export function errorHandler(opts: { production: boolean }): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const body = toErrorBody(error);
    if (body.statusCode >= 500) req.log.error({ err: error }, 'request failed');
    else req.log.info({ code: body.code, statusCode: body.statusCode }, 'request rejected');

    const exposeDetails = body.statusCode < 500 || !opts.production;
    res.status(body.statusCode).json({
      error: {
        code: body.code,
        message: body.message,
        ...(exposeDetails && body.details ? { details: body.details } : {}),
        requestId: req.id,
      },
    });
  };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'route_not_found', message: 'Rota nao encontrada.', requestId: req.id } });
};
