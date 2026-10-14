import type { EnergyPlanRequest, OnboardingRequest } from '@nutrisnap/core';

import { deviceTimezone } from '@/services/api/queries';
import type { OnboardingDraft } from '@/store/profile-store';

/** Dados para POST /calculo-fisico. null enquanto faltar algum campo. */
export function energyPlanRequestFrom(draft: OnboardingDraft): EnergyPlanRequest | null {
  if (!draft.sex || !draft.birthDate || !draft.heightCm || !draft.weightKg || !draft.goal || !draft.activityLevel) {
    return null;
  }
  return {
    sex: draft.sex,
    birthDate: draft.birthDate,
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    bodyFatPercentage: draft.bodyFatPercentage ?? null,
    goal: draft.goal,
    pace: draft.pace ?? 'moderate',
    activityLevel: draft.activityLevel,
  };
}

/** Corpo de POST /perfil (contrato `onboardingRequestSchema` do core). */
export function onboardingRequestFrom(draft: OnboardingDraft): OnboardingRequest | null {
  const energy = energyPlanRequestFrom(draft);
  if (
    !energy ||
    !draft.displayName ||
    draft.trainingDaysPerWeek === undefined ||
    !draft.experience ||
    !draft.location ||
    !draft.availableEquipment?.length
  ) {
    return null;
  }
  return {
    ...energy,
    pace: energy.pace ?? 'moderate',
    displayName: draft.displayName,
    targetWeightKg: draft.targetWeightKg ?? null,
    trainingDaysPerWeek: draft.trainingDaysPerWeek,
    // O questionario nao pergunta estes: usamos os padroes do contrato.
    sessionDurationMinutes: 60,
    mealsPerDay: 4,
    dislikedFoods: [],
    favoriteFoods: [],
    limitations: [],
    experience: draft.experience,
    location: draft.location,
    availableEquipment: draft.availableEquipment,
    restrictions: draft.restrictions ?? [],
    timezone: deviceTimezone(),
    locale: 'pt-BR',
    healthDataConsent: true,
  };
}
