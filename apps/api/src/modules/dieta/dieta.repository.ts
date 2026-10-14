import type { NutritionTarget, Prisma, PrismaClient } from '@prisma/client';
import { toDbDate } from '../../lib/db-dates.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** Unico ponto que toca `nutrition_targets` e as refeicoes do resumo diario. */
export class DietaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findCurrentTarget(userId: string): Promise<NutritionTarget | null> {
    return this.prisma.nutritionTarget.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Meta que valia em `date`. Intervalo [effectiveFrom, effectiveTo).
   * Datas anteriores a primeira meta usam a primeira meta: e a melhor
   * referencia disponivel e evita um diario sem meta.
   */
  async findTargetForDate(userId: string, date: string): Promise<NutritionTarget | null> {
    const day = toDbDate(date);
    const inRange = await this.prisma.nutritionTarget.findFirst({
      where: {
        userId,
        effectiveFrom: { lte: day },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: day } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    if (inRange) return inRange;
    return this.prisma.nutritionTarget.findFirst({
      where: { userId },
      orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Todas as metas que tocam o intervalo, para series de varios dias. */
  findTargetsOverlapping(userId: string, from: string, to: string): Promise<NutritionTarget[]> {
    return this.prisma.nutritionTarget.findMany({
      where: {
        userId,
        effectiveFrom: { lte: toDbDate(to) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: toDbDate(from) } }],
      },
      orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findFirstTarget(userId: string): Promise<NutritionTarget | null> {
    return this.prisma.nutritionTarget.findFirst({
      where: { userId },
      orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Encerra a meta vigente em `today` (exclusivo) e cria a nova a partir de
   * `today`. Duas mudancas no mesmo dia deixam a anterior com intervalo vazio,
   * e a busca por data escolhe a mais recente.
   */
  async replaceCurrentTarget(
    db: Db,
    userId: string,
    today: string,
    data: Omit<Prisma.NutritionTargetUncheckedCreateInput, 'userId' | 'effectiveFrom' | 'effectiveTo'>,
  ): Promise<NutritionTarget> {
    await db.nutritionTarget.updateMany({
      where: { userId, effectiveTo: null },
      data: { effectiveTo: toDbDate(today) },
    });
    return db.nutritionTarget.create({
      data: { ...data, userId, effectiveFrom: toDbDate(today), effectiveTo: null },
    });
  }

  findMealTotalsForDate(userId: string, date: string) {
    return this.prisma.meal.findMany({
      where: { userId, localDate: toDbDate(date) },
      select: {
        mealType: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
        totalFiber: true,
      },
    });
  }
}
