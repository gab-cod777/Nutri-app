import { SignJWT } from 'jose';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../src/auth/password.js';
import { TokenService } from '../../src/auth/tokens.js';
import { AppError } from '../../src/lib/errors.js';

describe('hash de senha (scrypt)', () => {
  it('nao guarda a senha e verifica corretamente', async () => {
    const hash = await hashPassword('minha-senha-123');
    expect(hash).not.toContain('minha-senha-123');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword('minha-senha-123', hash)).toBe(true);
    expect(await verifyPassword('minha-senha-124', hash)).toBe(false);
  });

  it('salt aleatorio: mesma senha gera hashes diferentes', async () => {
    expect(await hashPassword('igual')).not.toBe(await hashPassword('igual'));
  });

  it('hash malformado nunca valida', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
    expect(await verifyAgainstDummy('x')).toBe(false);
  });
});

describe('TokenService', () => {
  const secret = 'segredo-de-teste-com-pelo-menos-32-caracteres!!';
  const tokens = new TokenService(secret, 30);
  const userId = '3f1f5b5e-7a0e-4d4b-9a8e-1c2d3e4f5a6b';

  it('emite e verifica, com expiracao em N dias', async () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const { token, expiresAt } = await tokens.issue({ userId, tokenVersion: 2 }, now);
    expect(expiresAt.toISOString()).toBe('2026-10-31T12:00:00.000Z');
    expect(await tokens.verify(token)).toEqual({ userId, tokenVersion: 2 });
  });

  it('rejeita token expirado, de outro segredo ou de outro emissor', async () => {
    const expired = await tokens.issue({ userId, tokenVersion: 0 }, new Date('2020-01-01T00:00:00Z'));
    await expect(tokens.verify(expired.token)).rejects.toBeInstanceOf(AppError);

    const other = await new TokenService('outro-segredo-com-pelo-menos-32-caracteres!!', 30).issue({ userId, tokenVersion: 0 }, new Date());
    await expect(tokens.verify(other.token)).rejects.toMatchObject({ statusCode: 401, code: 'invalid_token' });

    const forged = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('atacante')
      .setAudience('nutrix-app')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
    await expect(tokens.verify(forged)).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('rejeita alg "none" e lixo', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: userId, tv: 0 })).toString('base64url');
    await expect(tokens.verify(`${header}.${payload}.`)).rejects.toMatchObject({ code: 'invalid_token' });
    await expect(tokens.verify('nao-e-um-jwt')).rejects.toMatchObject({ code: 'invalid_token' });
  });
});
