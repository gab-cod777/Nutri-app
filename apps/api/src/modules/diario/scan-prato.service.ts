import { createHash } from 'node:crypto';
import {
  buildAnalysisResult,
  DISCLAIMERS,
  localHour,
  mealAnalysisModelOutputSchema,
  suggestMealTypeByHour,
  type MealAnalysisModelOutput,
  type MealAnalysisResult,
  type MealType,
  type ScanPratoFields,
} from '@nutrisnap/core';
import type { MealAnalysis, PrismaClient } from '@prisma/client';
import { unprocessable } from '../../lib/errors.js';
import { sniffImageType } from '../../lib/image.js';
import { getUserTimezone } from '../../lib/user-context.js';
import type { IaService } from '../../services/ia/ia.service.js';
import type { AlimentosRepository } from '../alimentos/alimentos.repository.js';
import type { DiarioRepository } from './diario.repository.js';

/**
 * POST /scan-prato - "a rota magica" do guia:
 *   app -> API (esta classe) -> servico de IA (Python) -> macros de volta.
 *
 * NAO salva refeicao: a analise e uma sugestao; a refeicao so existe depois
 * que o usuario confirma/edita e chama POST /diario. A foto nao e armazenada -
 * guardamos so o hash (para nao reprocessar a mesma imagem) e o resultado.
 *
 * Fluxo: cota diaria -> magic bytes -> hash -> (reuso) -> IaService (chamada +
 * validacao Zod + log) -> pos-processamento deterministico do core (totais,
 * faixa, confianca, necessidade de confirmacao) -> grava `meal_analyses`.
 */
export class ScanPratoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: DiarioRepository,
    private readonly foodsRepo: AlimentosRepository,
    private readonly ia: IaService,
    private readonly scansPerDay: number,
    private readonly now: () => Date,
  ) {}

  async scan(userId: string, photo: Buffer | undefined, fields: ScanPratoFields): Promise<MealAnalysisResult> {
    if (!photo) {
      throw unprocessable('photo_required', 'Envie a foto do prato no campo "foto" (multipart/form-data).');
    }
    if (photo.length === 0) {
      throw unprocessable('photo_empty', 'O arquivo da foto chegou vazio (0 bytes). Confira se a imagem abre no computador.');
    }
    const mediaType = sniffImageType(photo);
    if (!mediaType) {
      throw unprocessable('unsupported_image', 'O arquivo enviado nao e uma imagem JPEG, PNG ou WebP.');
    }

    const timezone = await getUserTimezone(this.prisma, userId);
    const fallbackMealType = fields.mealType ?? suggestMealTypeByHour(localHour(this.now(), timezone));
    const imageSha256 = createHash('sha256').update(photo).digest('hex');

    // Mesma foto, sem contexto novo: devolve a analise ja feita.
    if (!fields.userHint) {
      const previous = await this.repo.findLatestAnalysisForImage(userId, imageSha256);
      if (previous) return this.rebuild(userId, previous, fields.mealType ?? null, fallbackMealType);
    }

    await this.ia.assertDailyQuota(userId, this.scansPerDay);
    const call = await this.ia.analyzeMealImage({ image: photo, mediaType, userHint: fields.userHint }, userId);

    const output = withMealType(call.output, fields.mealType ?? null);
    const result = await this.postProcess(userId, output, fallbackMealType);

    const analysis = await this.repo.createAnalysis({
      userId,
      imageSha256,
      isFood: output.isFood,
      rejectionReason: output.rejectionReason ?? null,
      imageQuality: output.imageQuality,
      hiddenCalorieRisk: output.hiddenCalorieRisk,
      overallConfidence: result.overallConfidence,
      needsConfirmation: result.needsUserConfirmation,
      rawOutput: call.output,
      provider: call.provider,
      model: call.model,
      modelVersion: call.modelVersion,
      processingMs: Math.round(call.latencyMs),
    });

    return this.toResult(analysis.id, output, result, call.latencyMs);
  }

  private async postProcess(userId: string, output: MealAnalysisModelOutput, fallbackMealType: MealType) {
    const matches = await this.foodsRepo.matchCanonicalNames(userId, output.foods.map((f) => f.canonicalName));
    return buildAnalysisResult({
      output,
      fallbackMealType,
      resolveFoodId: (food) => matches.get(food.canonicalName) ?? null,
    });
  }

  private async rebuild(
    userId: string,
    analysis: MealAnalysis,
    mealTypeOverride: MealType | null,
    fallbackMealType: MealType,
  ): Promise<MealAnalysisResult> {
    const stored = mealAnalysisModelOutputSchema.parse(analysis.rawOutput);
    const output = withMealType(stored, mealTypeOverride);
    const result = await this.postProcess(userId, output, fallbackMealType);
    return this.toResult(analysis.id, output, result, analysis.processingMs);
  }

  private toResult(
    analysisId: string,
    output: MealAnalysisModelOutput,
    result: Awaited<ReturnType<ScanPratoService['postProcess']>>,
    processingMs: number,
  ): MealAnalysisResult {
    return {
      analysisId,
      isFood: output.isFood,
      rejectionReason: output.rejectionReason ?? null,
      mealType: result.mealType,
      description: output.description ?? null,
      imageQuality: output.imageQuality,
      hiddenCalorieRisk: output.hiddenCalorieRisk,
      foods: result.foods,
      totals: result.totals,
      overallConfidence: result.overallConfidence,
      needsUserConfirmation: result.needsUserConfirmation,
      confirmationReasons: result.confirmationReasons,
      disclaimer: DISCLAIMERS.photoAnalysis,
      processingMs: Math.max(0, Math.round(processingMs)),
    };
  }
}

/** O tipo informado pelo app (horario local) prevalece sobre o palpite do modelo. */
function withMealType(output: MealAnalysisModelOutput, mealType: MealType | null): MealAnalysisModelOutput {
  return mealType ? { ...output, mealType } : output;
}
