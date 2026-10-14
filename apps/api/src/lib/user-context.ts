import { toLocalDate } from '@nutrisnap/core';
import type { PrismaClient, UserProfile } from '@prisma/client';
import { conflict } from './errors.js';

/** Fuso usado antes do onboarding (mesmo default do schema). */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** Perfil obrigatorio: rotas que dependem de dados do onboarding respondem 409 sem ele. */
export async function requireProfile(prisma: PrismaClient, userId: string): Promise<UserProfile> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile || !profile.onboardingCompletedAt) {
    throw conflict('onboarding_required', 'Conclua o onboarding antes de usar esta funcao.');
  }
  return profile;
}

export async function getUserTimezone(prisma: PrismaClient, userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return profile?.timezone ?? DEFAULT_TIMEZONE;
}

/** "Hoje" no fuso do usuario. */
export async function userToday(prisma: PrismaClient, userId: string, now: Date): Promise<string> {
  return toLocalDate(now, await getUserTimezone(prisma, userId));
}
