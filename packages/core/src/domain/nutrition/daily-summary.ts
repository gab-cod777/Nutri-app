import { MEAL_TYPE_ORDER, type MealType } from '../../schemas/enums.js';
import { percentOf, round } from '../../utils/math.js';
import { EMPTY_NUTRITION, roundNutrition, sumNutrition, type NutritionTotals } from './portions.js';

/** Metas diarias em numeros simples - o que fica salvo no perfil do usuario. */
export interface DailyTargets {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber?: number | null;
}

/** Uma refeicao ja consolidada, como vem do banco. */
export interface DiaryEntry {
  readonly mealType: MealType;
  readonly totals: NutritionTotals;
}

export interface MacroProgress {
  readonly consumed: number;
  readonly target: number;
  /** Quanto falta. Zero quando a meta ja foi atingida ou ultrapassada. */
  readonly remaining: number;
  /** Percentual da meta consumido. Pode passar de 100. */
  readonly percent: number;
}

export interface MealBucket {
  readonly mealType: MealType;
  readonly totals: NutritionTotals;
  readonly entryCount: number;
}

export interface DailySummary {
  readonly date: string;
  readonly consumed: NutritionTotals;
  readonly targets: DailyTargets;
  readonly calories: MacroProgress;
  readonly protein: MacroProgress;
  readonly carbs: MacroProgress;
  readonly fat: MacroProgress;
  /** Refeicoes na ordem canonica do dia, incluindo as vazias (para o diario). */
  readonly byMealType: readonly MealBucket[];
  /** true quando o consumo passou da meta calorica. Dispara o estado visual de alerta. */
  readonly isOverCalorieTarget: boolean;
}

function toProgress(consumed: number, target: number, decimals = 0): MacroProgress {
  return {
    consumed: round(consumed, decimals),
    target: round(target, decimals),
    remaining: round(Math.max(0, target - consumed), decimals),
    percent: percentOf(consumed, target),
  };
}

/**
 * Consolida o dia: total consumido, restante por macro e agrupamento por refeicao.
 *
 * Funcao pura de propósito: o app recalcula o resumo localmente assim que o
 * usuario salva uma refeicao (atualizacao otimista), e o backend usa a MESMA
 * funcao no endpoint de resumo diario. Sem duas implementacoes, sem divergencia.
 */
export function buildDailySummary(params: {
  readonly date: string;
  readonly targets: DailyTargets;
  readonly entries: readonly DiaryEntry[];
}): DailySummary {
  const { date, targets, entries } = params;

  const consumed = roundNutrition(sumNutrition(entries.map((e) => e.totals)));

  const byMealType: MealBucket[] = MEAL_TYPE_ORDER.map((mealType) => {
    const mealEntries = entries.filter((e) => e.mealType === mealType);
    return {
      mealType,
      totals:
        mealEntries.length === 0
          ? EMPTY_NUTRITION
          : roundNutrition(sumNutrition(mealEntries.map((e) => e.totals))),
      entryCount: mealEntries.length,
    };
  });

  return {
    date,
    consumed,
    targets,
    calories: toProgress(consumed.calories, targets.calories),
    protein: toProgress(consumed.protein, targets.protein, 1),
    carbs: toProgress(consumed.carbs, targets.carbs, 1),
    fat: toProgress(consumed.fat, targets.fat, 1),
    byMealType,
    isOverCalorieTarget: consumed.calories > targets.calories,
  };
}
