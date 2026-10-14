import {
  isValidTimeZone,
  toLocalDate,
  type MeResponse,
  type OnboardingRequest,
  type UpdateUserProfileInput,
  type UserProfileResponse,
} from '@nutrisnap/core';
import type { Prisma, PrismaClient, UserProfile } from '@prisma/client';
import { fromDbDate, toDbDate } from '../../lib/db-dates.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import type { DietaRepository } from '../dieta/dieta.repository.js';
import { toTargetDto, type DietaService, type EnergyInputs } from '../dieta/dieta.service.js';
import type { PerfilRepository } from './perfil.repository.js';

/** Campos do perfil que mudam a meta calorica. Mudar qualquer um cria nova `NutritionTarget`. */
const ENERGY_FIELDS = [
  'sex',
  'birthDate',
  'heightCm',
  'weightKg',
  'bodyFatPercentage',
  'activityLevel',
  'goal',
  'pace',
] as const;

/** Dados fisicos, objetivos e preferencias do usuario (tabela "Usuarios" do guia). */
export class PerfilService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: PerfilRepository,
    private readonly dietaRepo: DietaRepository,
    private readonly dieta: DietaService,
    private readonly now: () => Date,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.repo.findUser(userId);
    if (!user) throw notFound('Usuario');
    const [profile, target] = await Promise.all([
      this.repo.findProfile(userId),
      this.dietaRepo.findCurrentTarget(userId),
    ]);
    const completedAt = profile?.onboardingCompletedAt ?? null;
    return {
      id: user.id,
      email: user.email,
      profile: profile ? toProfileDto(profile) : null,
      currentTarget: target ? toTargetDto(target) : null,
      onboarding: { completed: completedAt !== null, completedAt: completedAt?.toISOString() ?? null },
    };
  }

  /** Grava o perfil completo, calcula a primeira meta e registra o peso inicial. */
  async completeOnboarding(userId: string, input: OnboardingRequest): Promise<MeResponse> {
    assertTimezone(input.timezone);
    const now = this.now();
    const today = toLocalDate(now, input.timezone);
    const existing = await this.repo.findProfile(userId);

    await this.prisma.$transaction(async (tx) => {
      const profile = await this.repo.upsertProfile(tx, userId, {
        displayName: input.displayName,
        sex: input.sex,
        birthDate: toDbDate(input.birthDate),
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        bodyFatPercentage: input.bodyFatPercentage ?? null,
        targetWeightKg: input.targetWeightKg ?? null,
        goal: input.goal,
        pace: input.pace,
        activityLevel: input.activityLevel,
        trainingDaysPerWeek: input.trainingDaysPerWeek,
        sessionDurationMinutes: input.sessionDurationMinutes,
        experience: input.experience,
        trainingLocation: input.location,
        availableEquipment: input.availableEquipment,
        limitations: input.limitations,
        restrictions: input.restrictions,
        dislikedFoods: input.dislikedFoods,
        favoriteFoods: input.favoriteFoods,
        mealsPerDay: input.mealsPerDay,
        timezone: input.timezone,
        locale: input.locale,
        onboardingCompletedAt: existing?.onboardingCompletedAt ?? now,
        healthDataConsentAt: existing?.healthDataConsentAt ?? now,
      });
      await this.dieta.recalculateTarget(tx, userId, energyInputs(profile), today);
      await this.repo.upsertWeightLog(tx, userId, toDbDate(today), input.weightKg);
    });

    return this.getMe(userId);
  }

  /**
   * Atualizacao parcial. Se algum campo que entra no calculo mudar, a meta
   * vigente e encerrada e uma nova e criada - o historico de aderencia
   * continua comparando cada dia com a meta daquele dia.
   */
  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<MeResponse> {
    const current = await this.repo.findProfile(userId);
    if (!current || !current.onboardingCompletedAt) {
      throw conflict('onboarding_required', 'Conclua o onboarding antes de editar o perfil.');
    }
    if (input.timezone !== undefined) assertTimezone(input.timezone);

    const data: Prisma.UserProfileUncheckedUpdateInput = {
      displayName: input.displayName,
      sex: input.sex,
      birthDate: input.birthDate !== undefined ? toDbDate(input.birthDate) : undefined,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bodyFatPercentage: input.bodyFatPercentage,
      targetWeightKg: input.targetWeightKg,
      goal: input.goal,
      pace: input.pace,
      activityLevel: input.activityLevel,
      trainingDaysPerWeek: input.trainingDaysPerWeek,
      sessionDurationMinutes: input.sessionDurationMinutes,
      experience: input.experience,
      trainingLocation: input.location,
      availableEquipment: input.availableEquipment,
      limitations: input.limitations,
      restrictions: input.restrictions,
      dislikedFoods: input.dislikedFoods,
      favoriteFoods: input.favoriteFoods,
      mealsPerDay: input.mealsPerDay,
      timezone: input.timezone,
      locale: input.locale,
    };

    const before = energyInputs(current);
    const now = this.now();

    await this.prisma.$transaction(async (tx) => {
      const updated = await this.repo.updateProfile(tx, userId, data);
      const after = energyInputs(updated);
      const today = toLocalDate(now, updated.timezone);
      if (ENERGY_FIELDS.some((field) => before[field] !== after[field])) {
        await this.dieta.recalculateTarget(tx, userId, after, today);
      }
      if (input.weightKg !== undefined && input.weightKg !== current.weightKg) {
        await this.repo.upsertWeightLog(tx, userId, toDbDate(today), input.weightKg);
      }
    });

    return this.getMe(userId);
  }

  /**
   * Exclusao de conta (LGPD): DELETE real, em cascade - perfil, metas, diario,
   * analises, planos, treinos e medidas. Nenhuma foto e armazenada pela API.
   * Os tokens deixam de valer porque o usuario nao existe mais.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.repo.hardDelete(userId);
  }
}

function assertTimezone(timezone: string): void {
  if (!isValidTimeZone(timezone)) {
    throw unprocessable('invalid_timezone', `Fuso horario invalido: ${timezone}.`, { timezone });
  }
}

export function energyInputs(profile: UserProfile): EnergyInputs {
  return {
    sex: profile.sex,
    birthDate: fromDbDate(profile.birthDate),
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPercentage: profile.bodyFatPercentage,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    pace: profile.pace,
  };
}

export function toProfileDto(profile: UserProfile): UserProfileResponse {
  return {
    displayName: profile.displayName,
    sex: profile.sex,
    birthDate: fromDbDate(profile.birthDate),
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPercentage: profile.bodyFatPercentage,
    targetWeightKg: profile.targetWeightKg,
    goal: profile.goal,
    pace: profile.pace,
    activityLevel: profile.activityLevel,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    experience: profile.experience,
    location: profile.trainingLocation,
    availableEquipment: profile.availableEquipment,
    limitations: profile.limitations,
    restrictions: profile.restrictions,
    dislikedFoods: profile.dislikedFoods,
    favoriteFoods: profile.favoriteFoods,
    mealsPerDay: profile.mealsPerDay,
    timezone: profile.timezone,
    locale: profile.locale,
    onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
    healthDataConsentAt: profile.healthDataConsentAt?.toISOString() ?? null,
  };
}
