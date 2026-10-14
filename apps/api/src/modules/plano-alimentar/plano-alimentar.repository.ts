import type { Prisma, PrismaClient } from '@prisma/client';

export const planInclude = {
  days: {
    orderBy: { dayIndex: 'asc' },
    include: {
      meals: {
        orderBy: { suggestedTime: 'asc' },
        include: { items: { orderBy: { id: 'asc' }, include: { food: { select: { canonicalName: true } } } } },
      },
    },
  },
} satisfies Prisma.MealPlanInclude;
export type MealPlanFull = Prisma.MealPlanGetPayload<{ include: typeof planInclude }>;

/** Unico ponto que toca `meal_plans` e filhos. Toda consulta filtra por `userId`. */
export class PlanoAlimentarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findActive(userId: string): Promise<MealPlanFull | null> {
    return this.prisma.mealPlan.findFirst({ where: { userId, status: 'active' }, include: planInclude });
  }

  findActiveById(userId: string, planId: string): Promise<MealPlanFull | null> {
    return this.prisma.mealPlan.findFirst({ where: { id: planId, userId, status: 'active' }, include: planInclude });
  }

  findMealInActivePlan(userId: string, mealId: string) {
    return this.prisma.mealPlanMeal.findFirst({
      where: { id: mealId, day: { plan: { userId, status: 'active' } } },
      include: { items: { include: { food: { select: { canonicalName: true } } } }, day: true },
    });
  }

  findItemInActivePlan(userId: string, itemId: string) {
    return this.prisma.mealPlanItem.findFirst({
      where: { id: itemId, meal: { day: { plan: { userId, status: 'active' } } } },
      include: { meal: { include: { day: true } } },
    });
  }
}
