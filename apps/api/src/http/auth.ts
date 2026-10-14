import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
import type { TokenService } from '../auth/tokens.js';
import { unauthorized } from '../lib/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

/**
 * Exige `Authorization: Bearer <token>` valido e um usuario existente cuja
 * `token_version` bata com a do token (logout/exclusao invalidam tokens).
 *
 * O `userId` usado em TODA a API vem daqui - nunca do corpo ou da query.
 */
export function requireAuth(deps: { tokens: TokenService; prisma: PrismaClient }): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('missing_token', 'Envie Authorization: Bearer <token>.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token || token.length > 4096) throw unauthorized('missing_token', 'Token ausente.');

    const claims = await deps.tokens.verify(token);
    const user = await deps.prisma.user.findUnique({
      where: { id: claims.userId },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== claims.tokenVersion) {
      throw unauthorized('token_revoked', 'Sessao encerrada. Entre novamente.');
    }
    req.auth = { userId: claims.userId };
    next();
  };
}
