import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { TokenService } from './auth/tokens.js';
import type { Env } from './config/env.js';
import { requireAuth } from './http/auth.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { perIp } from './http/rate-limit.js';
import { AlimentosRepository } from './modules/alimentos/alimentos.repository.js';
import { registerAlimentosRoutes } from './modules/alimentos/alimentos.routes.js';
import { AlimentosService } from './modules/alimentos/alimentos.service.js';
import { registerAuthPrivateRoutes, registerAuthPublicRoutes } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { DiarioRepository } from './modules/diario/diario.repository.js';
import { registerDiarioRoutes } from './modules/diario/diario.routes.js';
import { DiarioService } from './modules/diario/diario.service.js';
import { ScanPratoService } from './modules/diario/scan-prato.service.js';
import { DietaRepository } from './modules/dieta/dieta.repository.js';
import { registerDietaPublicRoutes, registerDietaRoutes } from './modules/dieta/dieta.routes.js';
import { DietaService } from './modules/dieta/dieta.service.js';
import { PerfilRepository } from './modules/perfil/perfil.repository.js';
import { registerPerfilRoutes } from './modules/perfil/perfil.routes.js';
import { PerfilService } from './modules/perfil/perfil.service.js';
import { PlanoAlimentarRepository } from './modules/plano-alimentar/plano-alimentar.repository.js';
import { registerPlanoAlimentarRoutes } from './modules/plano-alimentar/plano-alimentar.routes.js';
import { PlanoAlimentarService } from './modules/plano-alimentar/plano-alimentar.service.js';
import { registerProgressoRoutes } from './modules/progresso/progresso.routes.js';
import { ProgressoService } from './modules/progresso/progresso.service.js';
import { TreinosRepository } from './modules/treinos/treinos.repository.js';
import { registerTreinosRoutes } from './modules/treinos/treinos.routes.js';
import { TreinosService } from './modules/treinos/treinos.service.js';
import { IaService } from './services/ia/ia.service.js';
import type { VisionClient } from './services/ia/vision-client.js';
import cors from 'cors';

/** Dependencias externas. Tudo que fala com rede entra por aqui - os testes trocam por fakes. */
export interface AppDeps {
  readonly env: Env;
  readonly prisma: PrismaClient;
  readonly vision: VisionClient;
  readonly logger: Logger;
  readonly now?: () => Date;
}

export interface AppServices {
  readonly env: Env;
  readonly prisma: PrismaClient;
  readonly now: () => Date;
  readonly tokens: TokenService;
  readonly auth: AuthService;
  readonly perfil: PerfilService;
  readonly dieta: DietaService;
  readonly alimentos: AlimentosService;
  readonly diario: DiarioService;
  readonly scanPrato: ScanPratoService;
  readonly planoAlimentar: PlanoAlimentarService;
  readonly treinos: TreinosService;
  readonly progresso: ProgressoService;
}

export function buildServices(deps: AppDeps): AppServices {
  const { env, prisma } = deps;
  const now = deps.now ?? (() => new Date());

  const tokens = new TokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN_DAYS);
  const dietaRepo = new DietaRepository(prisma);
  const alimentosRepo = new AlimentosRepository(prisma);
  const diarioRepo = new DiarioRepository(prisma);
  const dieta = new DietaService(dietaRepo);
  const ia = new IaService(deps.vision, prisma, deps.logger, () => now().getTime());

  return {
    env,
    prisma,
    now,
    tokens,
    auth: new AuthService(prisma, tokens, now),
    perfil: new PerfilService(prisma, new PerfilRepository(prisma), dietaRepo, dieta, now),
    dieta,
    alimentos: new AlimentosService(alimentosRepo),
    diario: new DiarioService(prisma, diarioRepo, alimentosRepo),
    scanPrato: new ScanPratoService(prisma, diarioRepo, alimentosRepo, ia, env.RATE_LIMIT_SCAN_PER_DAY, now),
    planoAlimentar: new PlanoAlimentarService(prisma, new PlanoAlimentarRepository(prisma), alimentosRepo, dieta, now),
    treinos: new TreinosService(prisma, new TreinosRepository(prisma), now),
    progresso: new ProgressoService(prisma, dietaRepo, now),
  };
}

export function createApp(deps: AppDeps): { app: Express; services: AppServices } {
  const services = buildServices(deps);
  const { env, prisma } = deps;

  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );
  // Limite global por IP, antes de qualquer outra coisa (inclusive de 401).
  app.use(perIp(env.RATE_LIMIT_GLOBAL_PER_MINUTE));
  // Fotos chegam por multipart em /scan-prato; JSON legitimo e pequeno.
  app.use(express.json({ limit: '256kb' }));

  // Um endereco para conferir tudo: banco e servico de IA.
  app.get('/health', async (_req, res) => {
    const banco = await prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const, () => 'erro' as const);
    const ia = (await deps.vision.isHealthy()) ? ('ok' as const) : ('indisponivel' as const);
    const ok = banco === 'ok' && ia === 'ok';
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'com_problema', banco, ia });
  });

  // --- rotas publicas (guia: /cadastro, /calculo-fisico) ----------------------
  const publicRouter = Router();
  registerAuthPublicRoutes(publicRouter, services);
  registerDietaPublicRoutes(publicRouter, services);
  app.use(publicRouter);

  // --- rotas autenticadas -----------------------------------------------------
  const privateRouter = Router();
  privateRouter.use(requireAuth({ tokens: services.tokens, prisma }));
  registerAuthPrivateRoutes(privateRouter, services);
  registerPerfilRoutes(privateRouter, services);
  registerDietaRoutes(privateRouter, services);
  registerDiarioRoutes(privateRouter, services);
  registerAlimentosRoutes(privateRouter, services);
  registerPlanoAlimentarRoutes(privateRouter, services);
  registerTreinosRoutes(privateRouter, services);
  registerProgressoRoutes(privateRouter, services);
  app.use(privateRouter);

  app.use(notFoundHandler);
  app.use(errorHandler({ production: env.NODE_ENV === 'production' }));
  return { app, services };
}
