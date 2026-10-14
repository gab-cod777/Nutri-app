/**
 * @nutrisnap/core
 *
 * Dominio puro + contratos compartilhados entre `apps/api` e `apps/mobile`.
 *
 * Regras deste pacote:
 *  - Zero I/O. Nada de fetch, fs, Prisma, AsyncStorage ou SDK de provedor.
 *  - Zero dependencia de framework. Roda em Node e em Hermes sem adaptacao.
 *  - Toda funcao e pura e testavel. Se precisa de relogio ou rede, recebe por parametro.
 *
 * Consequencia pratica: o app calcula a meta calorica offline com exatamente
 * o mesmo codigo que o servidor usa, e a validacao de um payload e literalmente
 * o mesmo schema nos dois lados.
 */

// Dominio
export * from './domain/disclaimers.js';
export * from './domain/nutrition/bmr.js';
export * from './domain/nutrition/calorie-goal.js';
export * from './domain/nutrition/constants.js';
export * from './domain/nutrition/daily-summary.js';
export * from './domain/nutrition/energy-plan.js';
export * from './domain/nutrition/macros.js';
export * from './domain/nutrition/meal-analysis.js';
export * from './domain/nutrition/meal-plan-generator.js';
export * from './domain/nutrition/portions.js';
export * from './domain/nutrition/tdee.js';
export * from './domain/progress/trends.js';
export * from './domain/training/schedule.js';
export * from './domain/training/workout-metrics.js';
export * from './domain/training/workout-plan-generator.js';

// Contratos
export * from './schemas/ai.js';
export * from './schemas/common.js';
export * from './schemas/enums.js';
export * from './schemas/food.js';
export * from './schemas/meal-plan.js';
export * from './schemas/meal.js';
export * from './schemas/nutrition.js';
export * from './schemas/profile.js';
export * from './schemas/progress.js';
export * from './schemas/user.js';
export * from './schemas/workout.js';

// Utilitarios
export * from './utils/dates.js';
export * from './utils/errors.js';
export * from './utils/id.js';
export * from './utils/math.js';
