import { PrismaClient } from '@prisma/client';
import { pino } from 'pino';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { PythonVisionClient } from './services/ia/vision-client.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({ level: env.LOG_LEVEL });
  const prisma = new PrismaClient();

  const { app } = createApp({
    env,
    prisma,
    logger,
    vision: new PythonVisionClient(env.IA_SERVICE_URL, env.IA_INTERNAL_TOKEN, env.IA_TIMEOUT_MS),
  });

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ port: env.PORT }, 'NutriSnap API no ar');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'encerrando');
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
