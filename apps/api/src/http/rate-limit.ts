import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

/**
 * Limites por janela, em memoria.
 *
 * Em memoria: com varias instancias cada uma conta separado - ao escalar,
 * configure um store Redis. A cota DIARIA de analise de foto nao depende
 * disto: e contada no banco (`AiQuota`).
 */

function tooMany(req: Request, res: Response): void {
  res.status(429).json({
    error: { code: 'rate_limited', message: 'Muitas requisicoes. Tente novamente em instantes.', requestId: req.id },
  });
}

/** Por IP. Usado no limite global e em /cadastro e /login (forca bruta). */
export function perIp(limit: number, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
    handler: tooMany,
  });
}

/** Por usuario autenticado (rodar DEPOIS de `requireAuth`). */
export function perUser(limit: number, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.auth?.userId ?? ipKeyGenerator(req.ip ?? 'unknown')}`,
    handler: tooMany,
  });
}
