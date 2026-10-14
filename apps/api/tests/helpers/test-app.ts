import { PrismaClient } from '@prisma/client';
import type { MealAnalysisModelOutput } from '@nutrisnap/core';
import type { Express } from 'express';
import { pino } from 'pino';
import request, { type Response } from 'supertest';
import { createApp, type AppServices } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import type { PhotoMediaType } from '../../src/lib/image.js';
import { VisionError, type VisionClient, type VisionResponse } from '../../src/services/ia/vision-client.js';
import { seed } from '../../prisma/seed.js';

export const HAS_DB = Boolean(process.env.TEST_DATABASE_URL);

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://unused@localhost/unused',
    JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres!!',
    IA_SERVICE_URL: 'http://ia.test:8000',
    IA_INTERNAL_TOKEN: 'token-interno-de-teste-1234567890',
    RATE_LIMIT_GLOBAL_PER_MINUTE: '100000',
    RATE_LIMIT_AUTH_PER_MINUTE: '100000',
    ...overrides,
  });
}

/** Prato feito: o que o servico de IA (Python) devolveria. */
export const PRATO_FEITO: MealAnalysisModelOutput = {
  isFood: true,
  rejectionReason: null,
  mealType: null,
  description: 'arroz branco cozido, feijao carioca cozido, peito de frango grelhado',
  imageQuality: 'good',
  hiddenCalorieRisk: 'low',
  foods: [
    {
      name: 'arroz branco cozido',
      canonicalName: 'white_rice_cooked',
      category: 'grain',
      preparationMethod: 'boiled',
      estimatedGrams: 150,
      minGrams: 80,
      maxGrams: 250,
      per100g: { calories: 128, protein: 2.5, carbs: 28.1, fat: 0.2, fiber: 1.6 },
      confidence: 0.6,
      notes: null,
    },
    {
      name: 'feijao carioca cozido',
      canonicalName: 'pinto_beans_cooked',
      category: 'legume',
      preparationMethod: 'boiled',
      estimatedGrams: 100,
      minGrams: 60,
      maxGrams: 180,
      per100g: { calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5 },
      confidence: 0.5,
      notes: null,
    },
    {
      name: 'peito de frango grelhado',
      canonicalName: 'chicken_breast_grilled',
      category: 'protein',
      preparationMethod: 'grilled',
      estimatedGrams: 120,
      minGrams: 80,
      maxGrams: 200,
      per100g: { calories: 159, protein: 32, carbs: 0, fat: 2.5, fiber: 0 },
      confidence: 0.55,
      notes: null,
    },
  ],
};

type Scripted = { resultado: unknown } | VisionError;

/** Servico de visao falso: respostas enfileiradas; sem fila, devolve o prato feito. */
export class FakeVision implements VisionClient {
  readonly calls: { mediaType: PhotoMediaType; bytes: number; userHint?: string | undefined }[] = [];
  private readonly queue: Scripted[] = [];

  healthy = true;

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }

  enqueue(...items: Scripted[]): void {
    this.queue.push(...items);
  }

  async analyze(input: { image: Buffer; mediaType: PhotoMediaType; userHint?: string | undefined }): Promise<VisionResponse> {
    this.calls.push({ mediaType: input.mediaType, bytes: input.image.length, userHint: input.userHint });
    const next = this.queue.shift() ?? { resultado: PRATO_FEITO };
    if (next instanceof VisionError) throw next;
    return { resultado: next.resultado, modelo: 'fake-clip', versao: 'visao-teste@1' };
  }
}

export interface TestContext {
  app: Express;
  services: AppServices;
  prisma: PrismaClient;
  vision: FakeVision;
  setNow(date: Date | null): void;
}

let sharedPrisma: PrismaClient | null = null;

export function createTestContext(envOverrides: Record<string, string> = {}): TestContext {
  sharedPrisma ??= new PrismaClient();
  const prisma = sharedPrisma;
  const vision = new FakeVision();
  let fixedNow: Date | null = null;
  const { app, services } = createApp({
    env: testEnv(envOverrides),
    prisma,
    vision,
    logger: pino({ level: 'silent' }),
    now: () => fixedNow ?? new Date(),
  });
  return { app, services, prisma, vision, setNow: (d) => (fixedNow = d) };
}

/** Apaga usuarios (cascade) e logs de IA; recarrega o catalogo publico. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.aiUsageLog.deleteMany();
  await prisma.user.deleteMany();
  await seed(prisma);
}

let counter = 0;

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export const ONBOARDING = {
  displayName: 'Ana Teste',
  sex: 'female',
  birthDate: '1995-04-10',
  heightCm: 165,
  weightKg: 68,
  goal: 'lose_weight',
  pace: 'moderate',
  activityLevel: 'lightly_active',
  trainingDaysPerWeek: 3,
  sessionDurationMinutes: 60,
  experience: 'beginner',
  location: 'gym',
  availableEquipment: ['machines', 'dumbbells', 'cable_machine', 'bench'],
  restrictions: ['lactose_free'],
  mealsPerDay: 4,
  timezone: 'America/Sao_Paulo',
  healthDataConsent: true,
};

/** Cadastra (e por padrao faz o onboarding de) um usuario novo. */
export async function createUser(ctx: TestContext, opts: { onboard?: boolean } = {}): Promise<TestUser> {
  counter += 1;
  const email = `usuario${counter}-${Date.now()}@example.com`;
  const res = await request(ctx.app).post('/cadastro').send({ email, password: 'senha-forte-123' });
  if (res.status !== 201) throw new Error(`cadastro falhou: ${res.status} ${JSON.stringify(res.body)}`);
  const user = { id: res.body.user.id as string, email, token: res.body.token as string };
  if (opts.onboard !== false) {
    const onboard = await api(ctx, user.token).post('/perfil').send(ONBOARDING);
    if (onboard.status !== 200) throw new Error(`onboarding falhou: ${JSON.stringify(onboard.body)}`);
  }
  return user;
}

/** Cliente autenticado. */
export function api(ctx: TestContext, token: string) {
  const auth = (r: request.Test) => r.set('authorization', `Bearer ${token}`);
  return {
    get: (url: string) => auth(request(ctx.app).get(url)),
    post: (url: string) => auth(request(ctx.app).post(url)),
    put: (url: string) => auth(request(ctx.app).put(url)),
    delete: (url: string) => auth(request(ctx.app).delete(url)),
  };
}

/** Menor JPEG reconhecivel pelos magic bytes (o servico de visao e falso nos testes). */
export const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x03]);

export function errorCode(res: Response): string | undefined {
  return (res.body as { error?: { code?: string } }).error?.code;
}
