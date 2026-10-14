import type { MealAnalysis, Prisma, PrismaClient } from '@prisma/client';

export const mealInclude = { foods: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.MealInclude;
export type MealWithFoods = Prisma.MealGetPayload<{ include: typeof mealInclude }>;

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Unico ponto que toca `meals`, `meal_foods` e `meal_analyses`.
 * Toda leitura/escrita recebe `userId` e filtra por ele.
 */
export class DiarioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(userId: string, id: string): Promise<MealWithFoods | null> {
    return this.prisma.meal.findFirst({ where: { id, userId }, include: mealInclude });
  }

  list(params: {
    userId: string;
    where: Prisma.MealWhereInput;
    cursor: { t: Date; id: string } | null;
    take: number;
  }): Promise<MealWithFoods[]> {
    const keyset: Prisma.MealWhereInput = params.cursor
      ? {
          OR: [
            { consumedAt: { lt: params.cursor.t } },
            { consumedAt: params.cursor.t, id: { lt: params.cursor.id } },
          ],
        }
      : {};
    return this.prisma.meal.findMany({
      where: { AND: [{ userId: params.userId }, params.where, keyset] },
      orderBy: [{ consumedAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: mealInclude,
    });
  }

  create(db: Db, data: Prisma.MealUncheckedCreateInput): Promise<MealWithFoods> {
    return db.meal.create({ data, include: mealInclude });
  }

  /** Substitui os itens e grava os totais recalculados, na mesma transacao. */
  async update(
    db: Prisma.TransactionClient,
    mealId: string,
    data: Prisma.MealUncheckedUpdateInput,
    foods: Prisma.MealFoodCreateManyMealInput[] | null,
  ): Promise<MealWithFoods> {
    if (foods) {
      await db.mealFood.deleteMany({ where: { mealId } });
      await db.mealFood.createMany({ data: foods.map((f) => ({ ...f, mealId })) });
    }
    return db.meal.update({ where: { id: mealId }, data, include: mealInclude });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.meal.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  findAnalysis(userId: string, id: string): Promise<(MealAnalysis & { meal: { id: string } | null }) | null> {
    return this.prisma.mealAnalysis.findFirst({
      where: { id, userId },
      include: { meal: { select: { id: true } } },
    });
  }

  /** Analise anterior da mesma foto (mesmo hash): evita processar a imagem de novo. */
  findLatestAnalysisForImage(userId: string, imageSha256: string): Promise<MealAnalysis | null> {
    return this.prisma.mealAnalysis.findFirst({
      where: { userId, imageSha256 },
      orderBy: { createdAt: 'desc' },
    });
  }

  createAnalysis(data: Prisma.MealAnalysisUncheckedCreateInput): Promise<MealAnalysis> {
    return this.prisma.mealAnalysis.create({ data });
  }

  markAnalysisAccepted(db: Db, analysisId: string): Promise<unknown> {
    return db.mealAnalysis.update({ where: { id: analysisId }, data: { wasAccepted: true } });
  }
}
