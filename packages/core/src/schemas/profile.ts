import { z } from 'zod';
import { INPUT_LIMITS } from '../domain/nutrition/constants.js';
import {
  activityLevelSchema,
  dietaryRestrictionSchema,
  equipmentSchema,
  goalPaceSchema,
  goalSchema,
  sexSchema,
  trainingExperienceSchema,
  trainingLocationSchema,
} from './enums.js';

const { ageYears, heightCm, weightKg, bodyFatPercentage } = INPUT_LIMITS;

/**
 * Dados fisicos. Alimentam diretamente o calculo de TMB, entao os limites aqui
 * sao os MESMOS de `INPUT_LIMITS` - validar em dois lugares com faixas
 * diferentes gera erro 500 no dominio depois de um 200 na validacao.
 */
export const physicalDataSchema = z.object({
  sex: sexSchema,
  birthDate: z
    .string()
    .date()
    .refine(
      (value) => {
        const age = yearsSince(new Date(value));
        return age >= ageYears.min && age <= ageYears.max;
      },
      { message: `Idade deve estar entre ${ageYears.min} e ${ageYears.max} anos.` },
    ),
  heightCm: z.number().min(heightCm.min).max(heightCm.max),
  weightKg: z.number().min(weightKg.min).max(weightKg.max),
  bodyFatPercentage: z.number().min(bodyFatPercentage.min).max(bodyFatPercentage.max).nullish(),
});

export const goalSelectionSchema = z.object({
  goal: goalSchema,
  pace: goalPaceSchema.default('moderate'),
  /** Peso alvo opcional. So exibimos projecao de prazo quando informado. */
  targetWeightKg: z.number().min(weightKg.min).max(weightKg.max).nullish(),
});

export const activitySelectionSchema = z.object({
  activityLevel: activityLevelSchema,
  trainingDaysPerWeek: z.number().int().min(0).max(7),
  /** Minutos disponiveis por sessao. Define o volume do treino gerado. */
  sessionDurationMinutes: z.number().int().min(15).max(180).default(60),
});

export const foodPreferencesSchema = z.object({
  restrictions: z.array(dietaryRestrictionSchema).max(11).default([]),
  /** Texto livre e proposital: "nao gosto de peixe", "adoro ovo". Vai no prompt da IA. */
  dislikedFoods: z.array(z.string().trim().min(2).max(60)).max(30).default([]),
  favoriteFoods: z.array(z.string().trim().min(2).max(60)).max(30).default([]),
  mealsPerDay: z.number().int().min(2).max(8).default(4),
});

export const trainingPreferencesSchema = z.object({
  experience: trainingExperienceSchema,
  location: trainingLocationSchema,
  availableEquipment: z.array(equipmentSchema).min(1).max(10),
  /** Limitacoes declaradas pelo usuario (ex.: "dor no ombro direito"). */
  limitations: z.array(z.string().trim().min(2).max(120)).max(10).default([]),
});

/** Perfil completo, montado ao fim do onboarding. */
export const userProfileSchema = physicalDataSchema
  .merge(goalSelectionSchema)
  .merge(activitySelectionSchema)
  .merge(foodPreferencesSchema)
  .merge(trainingPreferencesSchema)
  .extend({
    displayName: z.string().trim().min(2).max(60),
    /** IANA timezone. Define a virada do dia no diario alimentar. */
    timezone: z.string().min(3).max(64).default('America/Sao_Paulo'),
    locale: z.string().min(2).max(10).default('pt-BR'),
  });

/** Atualizacao parcial via PUT /perfil. */
export const updateUserProfileSchema = userProfileSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Envie ao menos um campo para atualizar.' },
);

export type PhysicalData = z.infer<typeof physicalDataSchema>;
export type GoalSelection = z.infer<typeof goalSelectionSchema>;
export type ActivitySelection = z.infer<typeof activitySelectionSchema>;
export type FoodPreferences = z.infer<typeof foodPreferencesSchema>;
export type TrainingPreferences = z.infer<typeof trainingPreferencesSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

/**
 * Idade em anos completos.
 *
 * Guardamos data de nascimento em vez de idade: idade envelhece sozinha e
 * silenciosamente desatualiza a TMB de quem cadastrou "28" ha tres anos.
 */
export function yearsSince(birthDate: Date, reference: Date = new Date()): number {
  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}
