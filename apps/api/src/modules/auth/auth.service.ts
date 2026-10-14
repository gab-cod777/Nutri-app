import type { AuthResponse, LoginRequest, SignUpRequest } from '@nutrisnap/core';
import { Prisma, type PrismaClient } from '@prisma/client';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../auth/password.js';
import type { TokenService } from '../../auth/tokens.js';
import { conflict, unauthorized } from '../../lib/errors.js';

/**
 * Cadastro e login com credenciais proprias (tabela `users`).
 *
 * - Senha so como hash scrypt; nunca logada nem devolvida.
 * - Login com mensagem unica para e-mail inexistente e senha errada, e tempo
 *   de resposta igualado (`verifyAgainstDummy`) - nao revela quem tem conta.
 */
export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokens: TokenService,
    private readonly now: () => Date,
  ) {}

  async signUp(input: SignUpRequest): Promise<AuthResponse> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.prisma.user.create({ data: { email: input.email, passwordHash } });
      return this.session(user.id, user.email, user.tokenVersion, false);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('email_in_use', 'Ja existe uma conta com este e-mail.');
      }
      throw error;
    }
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { profile: { select: { onboardingCompletedAt: true } } },
    });
    const ok = user ? await verifyPassword(input.password, user.passwordHash) : await verifyAgainstDummy(input.password);
    if (!user || !ok) throw unauthorized('invalid_credentials', 'E-mail ou senha incorretos.');
    return this.session(user.id, user.email, user.tokenVersion, Boolean(user.profile?.onboardingCompletedAt));
  }

  /** Encerra TODAS as sessoes do usuario (invalida os tokens ja emitidos). */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }

  private async session(userId: string, email: string, tokenVersion: number, onboardingCompleted: boolean): Promise<AuthResponse> {
    const { token, expiresAt } = await this.tokens.issue({ userId, tokenVersion }, this.now());
    return { token, expiresAt: expiresAt.toISOString(), user: { id: userId, email, onboardingCompleted } };
  }
}
