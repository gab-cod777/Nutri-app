import { readFileSync } from 'node:fs';
import {
  activityLevelSchema,
  detectedFoodSchema,
  dietaryRestrictionSchema,
  equipmentSchema,
  foodCategorySchema,
  goalPaceSchema,
  goalSchema,
  hiddenCalorieRiskSchema,
  imageQualitySchema,
  mealTypeSchema,
  measureUnitSchema,
  muscleGroupSchema,
  planStatusSchema,
  portionSourceSchema,
  foodSourceSchema,
  preparationMethodSchema,
  progressMetricSchema,
  sexSchema,
  trainingExperienceSchema,
  trainingLocationSchema,
  workoutStatusSchema,
} from '@nutrisnap/core';
import type { z } from 'zod';
import { sniffImageType } from '../../src/lib/image.js';
import { loadFoodTable } from '../../prisma/seed.js';
import { EXERCISES } from '../../prisma/seed-data/exercises.js';

/** Enums do Prisma lidos do schema.prisma. */
function prismaEnums(): Map<string, string[]> {
  const text = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  const enums = new Map<string, string[]>();
  for (const match of text.matchAll(/enum (\w+) \{([^}]*)\}/g)) {
    const values = match[2]!
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter(Boolean);
    enums.set(match[1]!, values);
  }
  return enums;
}

/**
 * Os valores dos enums do banco e do core trafegam como string: divergencia
 * quebra em runtime, nao em compile time. Este teste e a protecao.
 */
describe('paridade de enums Prisma <-> core', () => {
  const enums = prismaEnums();
  const pairs: [string, z.ZodEnum<[string, ...string[]]>][] = [
    ['Sex', sexSchema],
    ['ActivityLevel', activityLevelSchema],
    ['Goal', goalSchema],
    ['GoalPace', goalPaceSchema],
    ['TrainingExperience', trainingExperienceSchema],
    ['TrainingLocation', trainingLocationSchema],
    ['Equipment', equipmentSchema],
    ['DietaryRestriction', dietaryRestrictionSchema],
    ['MealType', mealTypeSchema],
    ['MeasureUnit', measureUnitSchema],
    ['FoodCategory', foodCategorySchema],
    ['FoodSource', foodSourceSchema],
    ['PortionSource', portionSourceSchema],
    ['PreparationMethod', preparationMethodSchema],
    ['ImageQuality', imageQualitySchema],
    ['HiddenCalorieRisk', hiddenCalorieRiskSchema],
    ['MuscleGroup', muscleGroupSchema],
    ['WorkoutStatus', workoutStatusSchema],
    ['PlanStatus', planStatusSchema],
    ['ProgressMetric', progressMetricSchema],
  ];
  it.each(pairs)('%s', (name, schema) => {
    expect(enums.get(name)).toEqual([...schema.options]);
  });
});

describe('tabela de alimentos compartilhada (apps/ia/app/dados/alimentos.json)', () => {
  const foods = loadFoodTable();
  const KNOWN_TAGS = new Set(['animal', 'meat', 'fish', 'pork', 'egg', 'dairy', 'lactose', 'gluten', 'nuts', 'soy', 'legume', 'sugary']);

  it('cada linha e um alimento valido para o contrato da IA', () => {
    expect(foods.length).toBeGreaterThan(40);
    for (const f of foods) {
      const asDetected = {
        name: f.name,
        canonicalName: f.canonicalName,
        category: f.category,
        preparationMethod: f.preparationMethod,
        estimatedGrams: f.portion.defaultGrams,
        minGrams: f.portion.defaultGrams,
        maxGrams: f.portion.defaultGrams,
        per100g: f.per100g,
        confidence: 0.5,
      };
      expect(detectedFoodSchema.safeParse(asDetected).success, f.canonicalName).toBe(true);
      for (const tag of f.tags) expect(KNOWN_TAGS.has(tag), `${f.canonicalName}: ${tag}`).toBe(true);
    }
    expect(new Set(foods.map((f) => f.canonicalName)).size).toBe(foods.length);
  });

  it('catalogo de exercicios usa equipamentos e musculos validos', () => {
    for (const e of EXERCISES) {
      expect(e.requiredEquipment.length).toBeGreaterThan(0);
      for (const eq of e.requiredEquipment) expect(equipmentSchema.options).toContain(eq);
      expect(muscleGroupSchema.options).toContain(e.primaryMuscle);
    }
  });
});

describe('sniffImageType', () => {
  it('reconhece JPEG, PNG e WebP pelos magic bytes', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImageType(Buffer.from('RIFF0000WEBPVP8 ', 'ascii'))).toBe('image/webp');
  });

  it('rejeita o resto, mesmo com "extensao" de imagem', () => {
    expect(sniffImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(sniffImageType(Buffer.from('<html>foto.jpg</html>'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});
