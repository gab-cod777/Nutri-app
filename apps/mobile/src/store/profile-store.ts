import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActivityLevel,
  DietaryRestriction,
  Equipment,
  Goal,
  GoalPace,
  Sex,
  TrainingExperience,
  TrainingLocation,
  UserProfileResponse,
} from '@nutrisnap/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * RASCUNHO do onboarding, preenchido passo a passo (docs/02-mvp.md, item 2).
 * So isto fica no aparelho, para retomar o questionario se o app fechar no
 * meio. O perfil de verdade, a meta e o diario vem da API (GET /perfil),
 * nunca daqui. O rascunho e apagado quando o onboarding e salvo.
 */
export interface OnboardingDraft {
  displayName?: string;
  sex?: Sex;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercentage?: number | null;
  goal?: Goal;
  pace?: GoalPace;
  targetWeightKg?: number | null;
  activityLevel?: ActivityLevel;
  trainingDaysPerWeek?: number;
  restrictions?: DietaryRestriction[];
  experience?: TrainingExperience;
  location?: TrainingLocation;
  availableEquipment?: Equipment[];
}

interface ProfileDraftState {
  draft: OnboardingDraft;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  /** Refazer o questionario partindo do perfil salvo no servidor. */
  loadFromProfile: (profile: UserProfileResponse) => void;
  resetDraft: () => void;
}

export const useProfileStore = create<ProfileDraftState>()(
  persist(
    (set) => ({
      draft: {},
      updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
      loadFromProfile: (p) =>
        set({
          draft: {
            displayName: p.displayName,
            sex: p.sex,
            birthDate: p.birthDate,
            heightCm: p.heightCm,
            weightKg: p.weightKg,
            bodyFatPercentage: p.bodyFatPercentage ?? null,
            goal: p.goal,
            pace: p.pace,
            targetWeightKg: p.targetWeightKg ?? null,
            activityLevel: p.activityLevel,
            trainingDaysPerWeek: p.trainingDaysPerWeek,
            restrictions: p.restrictions,
            experience: p.experience,
            location: p.location,
            availableEquipment: p.availableEquipment,
          },
        }),
      resetDraft: () => set({ draft: {} }),
    }),
    {
      name: 'nutrix.onboarding-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
