import { readFileSync } from 'node:fs';
import { PrismaClient, type FoodCategory, type MeasureUnit, type PreparationMethod } from '@prisma/client';
import { EXERCISES } from './seed-data/exercises.js';

/**
 * Seed idempotente: catalogo de exercicios (base do gerador de treino) e
 * alimentos publicos.
 *
 * Os alimentos vem de `apps/ia/app/dados/alimentos.json` - a MESMA tabela que o
 * servico de IA usa para devolver macros. Uma fonte so: o numero que a IA
 * mostra e o que esta no banco nunca divergem.
 */

interface FoodRow {
  canonicalName: string;
  name: string;
  category: FoodCategory;
  preparationMethod: PreparationMethod;
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  baseUnit: 'g' | 'ml';
  portion: { defaultGrams: number };
  tags: string[];
  servings: { label: string; unit: MeasureUnit; quantity: number; gramsEquivalent: number; isDefault: boolean }[];
}

export const FOODS_PATH = new URL('../../ia/app/dados/alimentos.json', import.meta.url);

export function loadFoodTable(): FoodRow[] {
  return (JSON.parse(readFileSync(FOODS_PATH, 'utf8')) as { foods: FoodRow[] }).foods;
}

export async function seed(prisma: PrismaClient): Promise<{ exercises: number; foods: number }> {
  for (const ex of EXERCISES) {
    await prisma.exercise.upsert({ where: { canonicalName: ex.canonicalName }, create: ex, update: ex });
  }

  const foods = loadFoodTable();
  for (const food of foods) {
    const data = {
      name: food.name,
      category: food.category,
      source: 'internal' as const,
      baseUnit: food.baseUnit,
      caloriesPer100: food.per100g.calories,
      proteinPer100: food.per100g.protein,
      carbsPer100: food.per100g.carbs,
      fatPer100: food.per100g.fat,
      fiberPer100: food.per100g.fiber,
      preparationMethod: food.preparationMethod,
      typicalPortionGrams: food.portion.defaultGrams,
      tags: food.tags,
      isVerified: false,
      sourceReference: 'TACO 4a ed./USDA - valores aproximados, revisar',
    };
    // O unique parcial (canonical_name WHERE owner_id IS NULL) nao e exposto ao Prisma: busca + update/create.
    const existing = await prisma.food.findFirst({ where: { canonicalName: food.canonicalName, ownerId: null } });
    if (existing) {
      await prisma.food.update({ where: { id: existing.id }, data });
      continue;
    }
    await prisma.food.create({
      data: { ...data, canonicalName: food.canonicalName, servings: { create: food.servings } },
    });
  }
  return { exercises: EXERCISES.length, foods: foods.length };
}

const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then((r) => console.log(`seed ok: ${r.exercises} exercicios, ${r.foods} alimentos`))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
