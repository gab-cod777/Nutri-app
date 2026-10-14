import type { DietaryRestriction, FoodCategory, MealType, MeasureUnit } from '../../schemas/enums.js';
import type { PreparationMethod } from '../../schemas/ai.js';
import { DomainError } from '../../utils/errors.js';
import { clamp, round } from '../../utils/math.js';
import { roundNutrition, scaleNutritionByGrams, sumNutrition, type NutritionPer100, type NutritionTotals } from './portions.js';

/**
 * Gerador de plano alimentar por regras.
 *
 * Monta cada refeicao a partir de moldes brasileiros (cafe: carboidrato +
 * proteina + fruta; almoco/jantar: carboidrato + leguminosa + proteina +
 * salada + azeite; lanches: proteina + fruta), filtra os alimentos pelas
 * restricoes do usuario e AJUSTA AS GRAMAS para bater a meta: primeiro a
 * proteina, depois o carboidrato fecha as calorias. Deterministico.
 */
export const MEAL_PLAN_GENERATOR_VERSION = 'cardapio-regras@1';

export interface PlanFood {
  readonly canonicalName: string;
  readonly name: string;
  readonly category: FoodCategory;
  readonly preparationMethod: PreparationMethod;
  readonly per100g: NutritionPer100 & { readonly fiber: number };
  readonly baseUnit: 'g' | 'ml';
  /** Porcao tipica, em gramas. */
  readonly typicalPortionGrams: number;
  /** animal, meat, fish, pork, egg, dairy, lactose, gluten, nuts, soy, legume, sugary. */
  readonly tags: readonly string[];
}

export interface PlanTargets {
  readonly calories: number;
  readonly protein: number;
}

export interface PlanItem {
  readonly canonicalName: string;
  readonly name: string;
  readonly grams: number;
  readonly quantity: number;
  readonly unit: MeasureUnit;
  readonly per100g: NutritionPer100 & { readonly fiber: number };
  readonly preparationMethod: PreparationMethod;
  readonly substitutes: { name: string; grams: number; per100g: NutritionPer100 & { fiber: number } }[];
}

export interface PlanMeal {
  readonly mealType: MealType;
  readonly name: string;
  readonly suggestedTime: string;
  readonly preparationTip: string | null;
  readonly items: PlanItem[];
}

export interface GeneratedMealPlan {
  readonly name: string;
  readonly rationale: string;
  readonly days: { dayIndex: number; meals: PlanMeal[] }[];
}

type Role = 'carb' | 'legume' | 'protein' | 'vegetable' | 'fruit' | 'fat';

interface Slot {
  readonly role: Role;
  readonly candidates: readonly string[];
}

const CARBS_MAIN = ['white_rice_cooked', 'brown_rice_cooked', 'sweet_potato_boiled', 'pasta_cooked', 'potato_boiled', 'cassava_boiled', 'couscous_cooked'];
const PROTEINS_MAIN = ['chicken_breast_grilled', 'beef_steak_grilled', 'tilapia_fillet_grilled', 'ground_beef_cooked', 'chicken_thigh_roasted', 'pork_loin_grilled', 'tofu_grilled', 'egg_boiled'];
const FRUITS = ['banana_raw', 'papaya_raw', 'apple_raw', 'orange_raw'];
// Pasta de amendoim fica de fora: e 50% gordura, nao fonte de proteina.
const SNACK_PROTEINS = ['plain_yogurt', 'whey_protein', 'egg_boiled', 'minas_cheese', 'tofu_grilled'];

const MAIN_MEAL: readonly Slot[] = [
  { role: 'carb', candidates: CARBS_MAIN },
  { role: 'legume', candidates: ['pinto_beans_cooked', 'black_beans_cooked', 'lentils_cooked'] },
  { role: 'protein', candidates: PROTEINS_MAIN },
  { role: 'vegetable', candidates: ['lettuce_raw', 'broccoli_boiled', 'tomato_raw', 'carrot_raw'] },
  { role: 'fat', candidates: ['olive_oil'] },
];

const TEMPLATES: Record<MealType, readonly Slot[]> = {
  breakfast: [
    { role: 'carb', candidates: ['french_bread', 'whole_wheat_bread', 'tapioca_crepe', 'couscous_cooked', 'rolled_oats'] },
    { role: 'protein', candidates: ['scrambled_eggs', 'egg_boiled', 'minas_cheese', 'plain_yogurt', 'tofu_grilled'] },
    { role: 'fruit', candidates: FRUITS },
  ],
  morning_snack: [
    { role: 'protein', candidates: SNACK_PROTEINS },
    { role: 'fruit', candidates: FRUITS },
  ],
  lunch: MAIN_MEAL,
  afternoon_snack: [
    { role: 'protein', candidates: SNACK_PROTEINS },
    { role: 'fruit', candidates: FRUITS },
    { role: 'carb', candidates: ['rolled_oats', 'whole_wheat_bread', 'tapioca_crepe'] },
  ],
  dinner: MAIN_MEAL,
  supper: [
    { role: 'protein', candidates: ['plain_yogurt', 'minas_cheese', 'egg_boiled', 'tofu_grilled'] },
    { role: 'fruit', candidates: FRUITS },
  ],
};

/** Divisao das calorias do dia por numero de refeicoes (2 a 6). */
const DISTRIBUTION: Record<number, readonly (readonly [MealType, number])[]> = {
  2: [['lunch', 0.5], ['dinner', 0.5]],
  3: [['breakfast', 0.25], ['lunch', 0.4], ['dinner', 0.35]],
  4: [['breakfast', 0.25], ['lunch', 0.35], ['afternoon_snack', 0.15], ['dinner', 0.25]],
  5: [['breakfast', 0.2], ['morning_snack', 0.1], ['lunch', 0.3], ['afternoon_snack', 0.15], ['dinner', 0.25]],
  6: [['breakfast', 0.2], ['morning_snack', 0.1], ['lunch', 0.3], ['afternoon_snack', 0.1], ['dinner', 0.2], ['supper', 0.1]],
};

const TIMES: Record<MealType, string> = {
  breakfast: '07:30',
  morning_snack: '10:00',
  lunch: '12:30',
  afternoon_snack: '16:00',
  dinner: '19:30',
  supper: '21:30',
};

const LABELS: Record<MealType, string> = {
  breakfast: 'Cafe da manha',
  morning_snack: 'Lanche da manha',
  lunch: 'Almoco',
  afternoon_snack: 'Lanche da tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
};

const TIPS: Partial<Record<MealType, string>> = {
  lunch: 'Comece pela salada e use o azeite para temperar.',
  dinner: 'Prefira preparo grelhado ou assado, com pouco oleo.',
};

/** Tags proibidas por restricao alimentar. */
const FORBIDDEN_TAGS: Record<DietaryRestriction, readonly string[]> = {
  vegetarian: ['meat', 'fish'],
  vegan: ['animal'],
  lactose_free: ['lactose'],
  gluten_free: ['gluten'],
  nut_allergy: ['nuts'],
  seafood_allergy: ['fish'],
  egg_allergy: ['egg'],
  halal: ['pork'],
  kosher: ['pork'],
  low_sodium: ['sugary'],
  diabetic: ['sugary'],
};

/** Gramas fixas de papeis que nao sao ajustados pelo solver. */
const FIXED_GRAMS: Partial<Record<Role, number>> = { vegetable: 80, fat: 8 };

export interface MealContext {
  readonly foods: ReadonlyMap<string, PlanFood>;
  readonly restrictions: readonly DietaryRestriction[];
  readonly dislikedFoods: readonly string[];
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function isAllowed(food: PlanFood, ctx: Pick<MealContext, 'restrictions' | 'dislikedFoods'>): boolean {
  const forbidden = new Set(ctx.restrictions.flatMap((r) => FORBIDDEN_TAGS[r] ?? []));
  if (food.tags.some((t) => forbidden.has(t))) return false;
  const name = normalize(food.name);
  const canonical = food.canonicalName.replace(/_/g, ' ');
  return !ctx.dislikedFoods.some((d) => {
    const dislike = normalize(d);
    return dislike.length >= 3 && (name.includes(dislike) || canonical.includes(dislike));
  });
}

function candidatesFor(slot: Slot, ctx: MealContext): PlanFood[] {
  const list = slot.candidates
    .map((c) => ctx.foods.get(c))
    .filter((f): f is PlanFood => f !== undefined && isAllowed(f, ctx));
  if (list.length > 0 || slot.role !== 'protein') return list;
  // Sem proteina permitida no molde (ex.: vegano): cai para leguminosas e soja.
  return [...ctx.foods.values()].filter((f) => (f.tags.includes('legume') || f.tags.includes('soy')) && isAllowed(f, ctx));
}

function toItem(food: PlanFood, grams: number, substitutes: PlanFood[]): PlanItem {
  const g = Math.max(5, Math.round(grams / 5) * 5);
  const kcal = (food.per100g.calories * g) / 100;
  return {
    canonicalName: food.canonicalName,
    name: food.name.toLowerCase(),
    grams: g,
    quantity: g,
    unit: food.baseUnit === 'ml' ? 'ml' : 'g',
    per100g: food.per100g,
    preparationMethod: food.preparationMethod,
    substitutes: substitutes
      .filter((s) => s.canonicalName !== food.canonicalName && s.per100g.calories > 0)
      .slice(0, 3)
      .map((s) => ({
        name: s.name.toLowerCase(),
        grams: Math.max(5, Math.round((kcal / s.per100g.calories) * 100 / 5) * 5),
        per100g: s.per100g,
      })),
  };
}

function totalsOf(items: readonly { per100g: NutritionPer100; grams: number }[]): NutritionTotals {
  return sumNutrition(items.map((i) => scaleNutritionByGrams(i.per100g, i.grams)));
}

type Picked = { role: Role; food: PlanFood; grams: number; alternatives: PlanFood[] };

/** Erro relativo aceitavel para manter a escolha preferida da rotacao. */
const ACCEPTABLE_MEAL_ERROR = 0.05;

function pickedTotals(picked: readonly Picked[], keep: readonly PlanItem[]): NutritionTotals {
  return totalsOf([...keep, ...picked.map((p) => ({ per100g: p.food.per100g, grams: p.grams }))]);
}

/** Erro da refeicao: desvio de calorias + falta de proteina (excesso de proteina nao penaliza). */
function mealError(picked: readonly Picked[], keep: readonly PlanItem[], targets: PlanTargets): number {
  const t = pickedTotals(picked, keep);
  const kcal = targets.calories > 0 ? Math.abs(t.calories - targets.calories) / targets.calories : 0;
  const protein = targets.protein > 0 ? Math.max(0, targets.protein - t.protein) / targets.protein : 0;
  return kcal + 0.5 * protein;
}

/**
 * Ajusta as gramas: 1) proteina ate a meta de proteina; 2) carboidrato (ou
 * fruta, nos lanches) fecha as calorias; 3) se ainda sobrar caloria com o
 * carboidrato no minimo, reduz leguminosa e azeite.
 */
function solvePortions(picked: Picked[], keep: readonly PlanItem[], targets: PlanTargets): void {
  const protein = picked.find((p) => p.role === 'protein');
  if (protein && protein.food.per100g.protein > 0) {
    const others = pickedTotals(picked, keep).protein - (protein.food.per100g.protein * protein.grams) / 100;
    const needed = ((targets.protein - others) / protein.food.per100g.protein) * 100;
    protein.grams = clamp(needed, protein.food.typicalPortionGrams * 0.5, protein.food.typicalPortionGrams * 2.5);
  }

  const filler = picked.find((p) => p.role === 'carb') ?? picked.find((p) => p.role === 'fruit');
  if (filler && filler.food.per100g.calories > 0) {
    const others = pickedTotals(picked, keep).calories - (filler.food.per100g.calories * filler.grams) / 100;
    const needed = ((targets.calories - others) / filler.food.per100g.calories) * 100;
    filler.grams = clamp(needed, filler.food.typicalPortionGrams * 0.25, filler.food.typicalPortionGrams * 3);
  }

  let excess = pickedTotals(picked, keep).calories - targets.calories;
  for (const p of picked.filter((x) => x.role === 'legume' || x.role === 'fat')) {
    if (excess <= 0) break;
    const kcalPerGram = p.food.per100g.calories / 100;
    const minGrams = p.role === 'fat' ? 4 : p.food.typicalPortionGrams * 0.5;
    const cut = Math.min(p.grams - minGrams, excess / kcalPerGram);
    if (cut > 0) {
      p.grams -= cut;
      excess -= cut * kcalPerGram;
    }
  }
}

/**
 * Monta UMA refeicao com alvo de calorias e proteina. `variant` gira as
 * escolhas (dias diferentes, trocas). `keep` sao itens travados pelo usuario.
 */
export function buildPlanMeal(params: {
  readonly mealType: MealType;
  readonly targets: PlanTargets;
  readonly ctx: MealContext;
  readonly variant: number;
  readonly keep?: readonly PlanItem[];
}): PlanMeal {
  const { mealType, targets, ctx, variant } = params;
  const keep = params.keep ?? [];
  const keptNames = new Set(keep.map((k) => k.canonicalName));

  const slots: { role: Role; options: PlanFood[]; preferred: number }[] = [];
  TEMPLATES[mealType].forEach((slot, slotIndex) => {
    const options = candidatesFor(slot, ctx);
    if (options.length === 0) return;
    if (options.some((o) => keptNames.has(o.canonicalName))) return; // papel ja coberto por item travado
    slots.push({ role: slot.role, options, preferred: (variant + slotIndex * 2) % options.length });
  });
  if (slots.length === 0 && keep.length === 0) {
    throw new DomainError('no_allowed_foods', 'Nenhum alimento permitido para montar a refeicao.', { mealType });
  }

  // A proteina da rotacao e a preferida; se ela nao fecha a meta (ex.: ovo em
  // dieta de baixa caloria e muita proteina), testamos as outras opcoes.
  const proteinSlot = slots.find((sl) => sl.role === 'protein');
  const proteinOrder = proteinSlot
    ? proteinSlot.options.map((_, i) => (proteinSlot.preferred + i) % proteinSlot.options.length)
    : [-1];
  let best: { picked: Picked[]; error: number } | null = null;
  for (const proteinIndex of proteinOrder) {
    const picked = slots.map((sl) => {
      const food = sl.options[sl.role === 'protein' ? proteinIndex : sl.preferred]!;
      return { role: sl.role, food, grams: FIXED_GRAMS[sl.role] ?? food.typicalPortionGrams, alternatives: sl.options };
    });
    solvePortions(picked, keep, targets);
    const error = mealError(picked, keep, targets);
    if (!best || error < best.error - 1e-9) best = { picked, error };
    if (error <= ACCEPTABLE_MEAL_ERROR) break;
  }
  const picked = best!.picked;

  const items = [...keep, ...picked.map((p) => toItem(p.food, p.grams, p.alternatives))];
  const main = picked.filter((p) => p.role === 'protein' || p.role === 'carb').map((p) => p.food.name.toLowerCase());
  const name = main.length > 0 ? `${LABELS[mealType]}: ${main.join(' e ')}` : LABELS[mealType];
  return {
    mealType,
    name: name.slice(0, 80),
    suggestedTime: TIMES[mealType],
    preparationTip: TIPS[mealType] ?? null,
    items,
  };
}

export function mealTotals(meal: PlanMeal): NutritionTotals {
  return roundNutrition(totalsOf(meal.items));
}

/** Gera os dias pedidos. `dayIndexes` usa 0 = segunda-feira. */
export function generateMealPlan(params: {
  readonly targets: PlanTargets;
  readonly mealsPerDay: number;
  readonly dayIndexes: readonly number[];
  readonly ctx: MealContext;
}): GeneratedMealPlan {
  const count = clamp(Math.round(params.mealsPerDay), 2, 6);
  const distribution = DISTRIBUTION[count]!;

  const days = params.dayIndexes.map((dayIndex) => ({
    dayIndex,
    meals: distribution.map(([mealType, share], mealIndex) =>
      buildPlanMeal({
        mealType,
        targets: { calories: params.targets.calories * share, protein: params.targets.protein * share },
        ctx: params.ctx,
        // Varia por dia e evita a mesma proteina no almoco e no jantar.
        variant: dayIndex + mealIndex * 3,
      }),
    ),
  }));

  return {
    name: `Plano alimentar - ${round(params.targets.calories)} kcal`,
    rationale: `Cardapio montado por regras para a meta de ${round(params.targets.calories)} kcal e ${round(
      params.targets.protein,
    )} g de proteina por dia, respeitando suas restricoes e preferencias.`,
    days,
  };
}
