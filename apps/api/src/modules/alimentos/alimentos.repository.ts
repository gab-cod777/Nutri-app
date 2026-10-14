import { Prisma, type Food, type FoodServing, type PrismaClient } from '@prisma/client';
import type { CreateFoodInput, FoodCategory, PlanFood } from '@nutrisnap/core';

export type FoodWithServings = Food & { servings: FoodServing[] };

/** Visibilidade: alimentos publicos + os privados do proprio usuario. Nunca os de outro. */
export function visibleTo(userId: string): Prisma.FoodWhereInput {
  return { OR: [{ ownerId: null }, { ownerId: userId }] };
}

export class AlimentosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Busca por substring + similaridade de trigrama (pg_trgm, indice GIN).
   * Ordem: verificados, depois os do usuario, depois por similaridade.
   */
  async search(params: {
    userId: string;
    q: string;
    category?: FoodCategory | undefined;
    limit: number;
    offset: number;
  }): Promise<FoodWithServings[]> {
    const pattern = `%${params.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const categoryFilter = params.category
      ? Prisma.sql`AND f.category = ${params.category}::"FoodCategory"`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id
      FROM foods f
      WHERE (f.owner_id IS NULL OR f.owner_id = ${params.userId}::uuid)
        AND (f.name ILIKE ${pattern} OR f.canonical_name ILIKE ${pattern} OR f.name % ${params.q})
        ${categoryFilter}
      ORDER BY f.is_verified DESC,
               (f.owner_id IS NOT NULL) DESC,
               similarity(f.name, ${params.q}) DESC,
               f.name ASC,
               f.id ASC
      LIMIT ${params.limit} OFFSET ${params.offset}
    `;
    if (rows.length === 0) return [];

    const foods = await this.prisma.food.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { servings: true },
    });
    const byId = new Map(foods.map((f) => [f.id, f]));
    return rows.map((r) => byId.get(r.id)).filter((f): f is FoodWithServings => f !== undefined);
  }

  findVisible(userId: string, id: string): Promise<FoodWithServings | null> {
    return this.prisma.food.findFirst({ where: { id, ...visibleTo(userId) }, include: { servings: true } });
  }

  /** Ids (dentre `ids`) que o usuario pode referenciar. */
  async findVisibleIds(userId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.food.findMany({
      where: { id: { in: [...ids] }, ...visibleTo(userId) },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Resolve `canonicalName` -> id para casar o output da IA com a base.
   * Publico verificado tem prioridade; depois o do proprio usuario.
   */
  async matchCanonicalNames(userId: string, names: readonly string[]): Promise<Map<string, string>> {
    if (names.length === 0) return new Map();
    const rows = await this.prisma.food.findMany({
      where: { canonicalName: { in: [...new Set(names)] }, ...visibleTo(userId) },
      select: { id: true, canonicalName: true, ownerId: true, isVerified: true },
      orderBy: [{ isVerified: 'desc' }],
    });
    const result = new Map<string, string>();
    for (const row of rows) {
      const current = result.get(row.canonicalName);
      if (!current || row.ownerId === null) result.set(row.canonicalName, row.id);
    }
    return result;
  }

  /**
   * Alimentos publicos com porcao tipica: a base do gerador de cardapio.
   * Alimentos privados de usuarios nunca entram no plano de outro usuario.
   */
  async findPlanFoods(): Promise<Map<string, PlanFood>> {
    const rows = await this.prisma.food.findMany({
      where: { ownerId: null, typicalPortionGrams: { not: null } },
    });
    return new Map(
      rows.map((f) => [
        f.canonicalName,
        {
          canonicalName: f.canonicalName,
          name: f.name,
          category: f.category,
          preparationMethod: f.preparationMethod,
          per100g: {
            calories: f.caloriesPer100,
            protein: f.proteinPer100,
            carbs: f.carbsPer100,
            fat: f.fatPer100,
            fiber: f.fiberPer100,
          },
          baseUnit: f.baseUnit === 'ml' ? 'ml' : 'g',
          typicalPortionGrams: f.typicalPortionGrams!,
          tags: f.tags,
        },
      ]),
    );
  }

  /** canonicalName -> id dos alimentos publicos (vincula itens do plano a base). */
  async publicIdsByCanonicalName(names: readonly string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.food.findMany({
      where: { ownerId: null, canonicalName: { in: [...names] } },
      select: { id: true, canonicalName: true },
    });
    return new Map(rows.map((r) => [r.canonicalName, r.id]));
  }

  create(userId: string, input: CreateFoodInput): Promise<FoodWithServings> {
    return this.prisma.food.create({
      data: {
        name: input.name,
        canonicalName: input.canonicalName,
        brand: input.brand ?? null,
        category: input.category,
        source: 'user',
        barcode: input.barcode ?? null,
        baseUnit: input.baseUnit,
        caloriesPer100: input.per100g.calories,
        proteinPer100: input.per100g.protein,
        carbsPer100: input.per100g.carbs,
        fatPer100: input.per100g.fat,
        fiberPer100: input.per100g.fiber,
        ownerId: userId,
        isVerified: false,
        servings: { create: input.servings.map((s) => ({ ...s })) },
      },
      include: { servings: true },
    });
  }
}
