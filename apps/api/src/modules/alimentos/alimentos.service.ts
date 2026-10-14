import type { CreateFoodInput, Food, FoodSearchResponse, SearchFoodQuery } from '@nutrisnap/core';
import { Prisma } from '@prisma/client';
import { decodeCursor, encodeCursor, offsetCursorSchema } from '../../lib/cursor.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { AlimentosRepository, FoodWithServings } from './alimentos.repository.js';

export class AlimentosService {
  constructor(private readonly repo: AlimentosRepository) {}

  async search(userId: string, query: SearchFoodQuery): Promise<FoodSearchResponse> {
    const offset = decodeCursor(query.cursor, offsetCursorSchema)?.o ?? 0;
    const rows = await this.repo.search({
      userId,
      q: query.q,
      category: query.category,
      limit: query.limit + 1,
      offset,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items: items.map(toFoodDto),
      nextCursor: hasMore ? encodeCursor({ o: offset + items.length }) : null,
    };
  }

  async get(userId: string, id: string): Promise<Food> {
    const food = await this.repo.findVisible(userId, id);
    if (!food) throw notFound('Alimento');
    return toFoodDto(food);
  }

  async create(userId: string, input: CreateFoodInput): Promise<Food> {
    try {
      return toFoodDto(await this.repo.create(userId, input));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('food_already_exists', 'Voce ja cadastrou um alimento com este canonicalName.');
      }
      throw error;
    }
  }
}

export function toFoodDto(food: FoodWithServings): Food {
  return {
    id: food.id,
    name: food.name,
    canonicalName: food.canonicalName,
    brand: food.brand,
    category: food.category,
    source: food.source,
    barcode: food.barcode,
    baseUnit: food.baseUnit === 'ml' ? 'ml' : 'g',
    per100g: {
      calories: food.caloriesPer100,
      protein: food.proteinPer100,
      carbs: food.carbsPer100,
      fat: food.fatPer100,
      fiber: food.fiberPer100,
    },
    servings: food.servings.map((s) => ({
      id: s.id,
      label: s.label,
      unit: s.unit,
      quantity: s.quantity,
      gramsEquivalent: s.gramsEquivalent,
      isDefault: s.isDefault,
    })),
    ownerId: food.ownerId,
    isVerified: food.isVerified,
  };
}
