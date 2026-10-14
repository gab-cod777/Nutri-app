import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { unauthorized } from '../lib/errors.js';

const ISSUER = 'nutrix-api';
const AUDIENCE = 'nutrix-app';

export interface TokenClaims {
  readonly userId: string;
  /** Versao do token do usuario no momento da emissao. Ver `users.token_version`. */
  readonly tokenVersion: number;
}

const claimsSchema = z.object({ sub: z.string().uuid(), tv: z.number().int().nonnegative() });

/**
 * Tokens de acesso (JWT HS256) emitidos pela propria API.
 *
 * Sem refresh token no MVP: o token vale `expiresInDays` e e invalidado antes
 * disso incrementando `token_version` (logout, troca de senha, exclusao).
 */
export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly expiresInDays: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(claims: TokenClaims, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(now.getTime() + this.expiresInDays * 24 * 60 * 60 * 1000);
    const token = await new SignJWT({ tv: claims.tokenVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt };
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      const claims = claimsSchema.parse(payload);
      return { userId: claims.sub, tokenVersion: claims.tv };
    } catch {
      throw unauthorized('invalid_token', 'Token invalido ou expirado.');
    }
  }
}
