import { mealAnalysisModelOutputSchema, type MealAnalysisModelOutput } from '@nutrisnap/core';
import type { AiCallStatus, PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { badGateway, tooManyRequests, unprocessable } from '../../lib/errors.js';
import type { PhotoMediaType } from '../../lib/image.js';
import { VisionError, type VisionClient } from './vision-client.js';

export const IA_PROVIDER = 'nutrix-ia';

export interface IaCallResult {
  readonly output: MealAnalysisModelOutput;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly latencyMs: number;
}

/**
 * Orquestra a chamada ao servico de IA (Python):
 *  1. chama o `VisionClient` (porta - trocavel por outro modelo/provedor);
 *  2. valida a resposta com o schema do core: o servico de IA e tratado como
 *     entrada NAO confiavel; fora do contrato vira 502 e nunca e gravado;
 *  3. registra TODA chamada em `ai_usage_logs` (status, modelo, latencia),
 *     inclusive falhas - base da cota diaria e das metricas de qualidade.
 */
export class IaService {
  constructor(
    private readonly vision: VisionClient,
    private readonly prisma: PrismaClient,
    private readonly log: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  async analyzeMealImage(
    input: { image: Buffer; mediaType: PhotoMediaType; userHint?: string | undefined },
    userId: string,
  ): Promise<IaCallResult> {
    const startedAt = this.now();
    let model = 'desconhecido';
    let modelVersion = 'desconhecida';

    try {
      const response = await this.vision.analyze(input);
      model = response.modelo;
      modelVersion = response.versao;

      const parsed = mealAnalysisModelOutputSchema.safeParse(response.resultado);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join(' | ');
        await this.record(userId, 'validation_failed', model, modelVersion, startedAt, issues);
        throw badGateway('ai_invalid_output', 'A analise nao gerou um resultado valido. Registre manualmente ou tente de novo.');
      }

      const latencyMs = this.now() - startedAt;
      await this.record(userId, parsed.data.isFood ? 'success' : 'rejected_not_food', model, modelVersion, startedAt, null);
      return { output: parsed.data, provider: IA_PROVIDER, model, modelVersion, latencyMs };
    } catch (error) {
      if (!(error instanceof VisionError)) throw error;
      await this.record(
        userId,
        error.kind === 'timeout' ? 'timeout' : error.kind === 'bad_response' ? 'validation_failed' : 'provider_error',
        model,
        modelVersion,
        startedAt,
        `${error.kind}: ${error.message}`,
      );
      if (error.kind === 'rejected_image') {
        throw unprocessable('unsupported_image', 'Nao foi possivel ler a imagem enviada.');
      }
      throw badGateway('ai_unavailable', 'Nao foi possivel analisar a foto agora. Registre manualmente ou tente de novo.', {
        reason: error.kind,
      });
    }
  }

  /**
   * Cota diaria por usuario (janela movel de 24 h), contada no banco: duravel
   * e compartilhada entre instancias. Chamadas que falharam tambem contam.
   */
  async assertDailyQuota(userId: string, limitPerDay: number): Promise<void> {
    const since = new Date(this.now() - 24 * 60 * 60 * 1000);
    const used = await this.prisma.aiUsageLog.count({
      where: { userId, operation: 'analyze_meal_image', createdAt: { gte: since } },
    });
    if (used >= limitPerDay) {
      throw tooManyRequests('daily_scan_limit_reached', 'Limite diario de analises de foto atingido. Tente amanha.', {
        limitPerDay,
      });
    }
  }

  private async record(
    userId: string,
    status: AiCallStatus,
    model: string,
    modelVersion: string,
    startedAt: number,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          operation: 'analyze_meal_image',
          status,
          provider: IA_PROVIDER,
          model: model.slice(0, 80),
          modelVersion: modelVersion.slice(0, 30),
          latencyMs: Math.round(this.now() - startedAt),
          errorMessage: errorMessage?.slice(0, 500) ?? null,
        },
      });
    } catch (error) {
      // Falha no log nao derruba a resposta ao usuario.
      this.log.error({ err: error }, 'failed to record AI usage');
    }
  }
}
