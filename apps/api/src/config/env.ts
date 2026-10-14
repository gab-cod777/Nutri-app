import { z } from 'zod';

/**
 * Variaveis de ambiente, validadas na subida. Config invalida derruba o
 * processo antes de abrir a porta.
 */

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** true atras de load balancer/proxy - necessario para o rate limit por IP ver o IP real. */
  TRUST_PROXY: bool.default('false'),

  DATABASE_URL: z.string().url(),

  /** Segredo HS256 dos tokens emitidos pela API. Gere com `openssl rand -base64 48`. */
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(90).default(30),

  /** Servico de IA (Python). Rede interna - nunca exposto ao app. */
  IA_SERVICE_URL: z.string().url(),
  /** Segredo compartilhado com o servico de IA (header x-internal-token). */
  IA_INTERNAL_TOKEN: z.string().min(24),
  IA_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(15_000),

  RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().positive().default(120),
  /** /cadastro e /login por IP: freia tentativa de senha por forca bruta. */
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_SCAN_PER_DAY: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_SCAN_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FOOD_SEARCH_PER_MINUTE: z.coerce.number().int().positive().default(60),

  /** Limite da foto do prato. */
  MAX_MEAL_PHOTO_BYTES: z.coerce.number().int().min(100_000).max(10 * 1024 * 1024).default(5 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuracao invalida:\n${issues}`);
  }
  return parsed.data;
}
