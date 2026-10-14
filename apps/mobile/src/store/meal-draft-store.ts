import type {
  Food,
  Meal,
  MealAnalysisResult,
  MealType,
  MeasureUnit,
  NutritionPer100,
  PortionSource,
  PreparationMethod,
} from '@nutrisnap/core';
import { create } from 'zustand';

import type { PhotoFile } from '@/services/api/endpoints';

/**
 * Estado transiente de UMA refeicao em registro: foto -> analise -> confirmacao.
 * Some se o usuario fechar o fluxo sem salvar. Nada aqui e "o dado oficial":
 * a refeicao so existe depois do POST /diario (ou PUT, na edicao).
 */
export interface MealDraftItem {
  clientId: string;
  foodId: string | null;
  nameSnapshot: string;
  per100gSnapshot: NutritionPer100 & { fiber: number };
  preparationMethod: PreparationMethod;
  unit: MeasureUnit;
  grams: number;
  minGrams?: number;
  maxGrams?: number;
  aiEstimatedGrams?: number | null;
  aiConfidence?: number | null;
  portionSource: PortionSource;
}

export type ConfirmationReason = MealAnalysisResult['confirmationReasons'][number];

interface MealDraftState {
  mealType: MealType;
  photo: PhotoFile | null;
  /** Id da analise (POST /scan-prato). Vincula a refeicao salva a ela. */
  analysisId: string | null;
  needsConfirmation: boolean;
  confirmationReasons: ConfirmationReason[];
  description: string | null;
  disclaimer: string | null;
  /** Edicao de refeicao ja salva (PUT /diario/:id). */
  editingMealId: string | null;
  setMealType: (mealType: MealType) => void;
  setPhoto: (photo: PhotoFile | null) => void;
  setFromAnalysis: (result: MealAnalysisResult) => void;
  loadMeal: (meal: Meal) => void;
  updateGrams: (clientId: string, grams: number) => void;
  removeItem: (clientId: string) => void;
  addManualFood: (food: Food, grams: number) => void;
  items: MealDraftItem[];
  reset: () => void;
}

const EMPTY = {
  mealType: 'lunch' as MealType,
  photo: null,
  analysisId: null,
  needsConfirmation: false,
  confirmationReasons: [],
  description: null,
  disclaimer: null,
  editingMealId: null,
  items: [],
};

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(counter += 1)}`;

export const useMealDraftStore = create<MealDraftState>()((set) => ({
  ...EMPTY,

  setMealType: (mealType) => set({ mealType }),
  setPhoto: (photo) => set({ photo }),

  setFromAnalysis: (result) =>
    set({
      analysisId: result.analysisId,
      mealType: result.mealType,
      needsConfirmation: result.needsUserConfirmation,
      confirmationReasons: result.confirmationReasons,
      description: result.description ?? null,
      disclaimer: result.disclaimer,
      items: result.foods.map((food) => ({
        clientId: food.clientId,
        foodId: food.foodId ?? null,
        nameSnapshot: food.name,
        per100gSnapshot: food.per100g,
        preparationMethod: food.preparationMethod,
        unit: 'g',
        grams: food.estimatedGrams,
        minGrams: food.minGrams,
        maxGrams: food.maxGrams,
        aiEstimatedGrams: food.estimatedGrams,
        aiConfidence: food.confidence,
        portionSource: 'ai_estimate',
      })),
    }),

  loadMeal: (meal) =>
    set({
      ...EMPTY,
      editingMealId: meal.id,
      mealType: meal.mealType,
      analysisId: meal.analysisId,
      description: meal.title,
      items: meal.foods.map((food) => ({
        clientId: food.id,
        foodId: food.foodId,
        nameSnapshot: food.nameSnapshot,
        per100gSnapshot: food.per100gSnapshot,
        preparationMethod: food.preparationMethod,
        unit: food.unit,
        grams: food.grams,
        aiEstimatedGrams: food.aiEstimatedGrams,
        aiConfidence: food.aiConfidence,
        portionSource: food.portionSource,
      })),
    }),

  updateGrams: (clientId, grams) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.clientId === clientId
          ? {
              ...item,
              grams,
              portionSource:
                item.portionSource === 'ai_estimate' && grams !== item.aiEstimatedGrams
                  ? 'user_adjusted'
                  : item.portionSource,
            }
          : item,
      ),
    })),

  removeItem: (clientId) => set((state) => ({ items: state.items.filter((item) => item.clientId !== clientId) })),

  addManualFood: (food, grams) =>
    set((state) => ({
      items: [
        ...state.items,
        {
          clientId: nextId('manual'),
          foodId: food.id,
          nameSnapshot: food.name,
          per100gSnapshot: food.per100g,
          preparationMethod: 'unknown',
          unit: 'g',
          grams,
          portionSource: 'manual_entry',
        },
      ],
    })),

  reset: () => set({ ...EMPTY }),
}));
