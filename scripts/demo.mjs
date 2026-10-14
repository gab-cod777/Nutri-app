#!/usr/bin/env node
/**
 * Demonstracao do fluxo completo do NutriSnap pela API real (com a IA real).
 *
 *   npm run demo                         -> usa as fotos de demo/fotos/
 *   npm run demo -- minha-foto.jpg       -> usa as fotos informadas
 *   npm run demo -- --pausar             -> espera ENTER entre as etapas (bom para apresentar)
 *
 * Pre-requisito: banco, IA (npm run dev:ia) e API (npm run dev:api) no ar.
 * Variavel opcional: API_URL (padrao http://localhost:3333).
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.API_URL ?? 'http://localhost:3333').replace(/\/$/, '');
const args = process.argv.slice(2);
const PAUSE = args.includes('--pausar');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

let photos = args.filter((a) => !a.startsWith('--'));
if (photos.length === 0) {
  const dir = join(ROOT, 'demo', 'fotos');
  photos = existsSync(dir)
    ? readdirSync(dir).filter((f) => MIME[extname(f).toLowerCase()]).sort().map((f) => join(dir, f))
    : [];
}
if (photos.length === 0) {
  console.error('Nenhuma foto encontrada. Rode "npm run demo:fotos" ou passe o caminho: npm run demo -- foto.jpg');
  process.exit(1);
}

// Foto vazia ou inexistente: avisa antes de comecar, nao no meio da apresentacao.
for (const photo of photos) {
  if (!existsSync(photo)) {
    console.error(`Foto nao encontrada: ${photo}`);
    process.exit(1);
  }
  if (statSync(photo).size === 0) {
    console.error(`A foto ${photo} esta vazia (0 bytes). Rode "npm run demo:fotos" para baixar as fotos de novo.`);
    process.exit(1);
  }
}

const rl = PAUSE ? createInterface({ input: process.stdin, output: process.stdout }) : null;
let step = 0;
async function etapa(titulo) {
  step += 1;
  if (rl && step > 1) await rl.question('\n   [ENTER para continuar] ');
  console.log(`\n━━━ ${step}. ${titulo} ${'━'.repeat(Math.max(3, 60 - titulo.length))}`);
}
const info = (texto) => console.log(`   ${texto}`);

async function call(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (json) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: json ? JSON.stringify(json) : form });
  } catch {
    console.error(`\nNao consegui falar com a API em ${API}. Ela esta rodando? (npm run dev:api)`);
    process.exit(1);
  }
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function fail(what, res) {
  console.error(`\nFALHOU: ${what} (HTTP ${res.status})`);
  console.error(JSON.stringify(res.body, null, 2));
  process.exit(1);
}

// ---------------------------------------------------------------------------
await etapa('Conferindo os servicos');
const health = await call('GET', '/health');
info(`API: ${API}  ->  banco: ${health.body.banco ?? '?'}  |  IA: ${health.body.ia ?? '?'}`);
if (health.status !== 200) fail('algum servico nao esta pronto (veja acima)', health);

// ---------------------------------------------------------------------------
await etapa('Cadastro (POST /cadastro)');
const email = `demo.${Date.now()}@nutrisnap.dev`;
const signup = await call('POST', '/cadastro', { json: { email, password: 'senha-da-demo-123' } });
if (signup.status !== 201) fail('cadastro', signup);
const token = signup.body.token;
info(`Conta criada: ${email}`);
info('A senha fica salva so como hash (scrypt). A API devolve um token de acesso.');

// ---------------------------------------------------------------------------
await etapa('Calculo fisico (POST /calculo-fisico)');
const pessoa = {
  sex: 'female',
  birthDate: '1998-03-15',
  heightCm: 165,
  weightKg: 68,
  goal: 'lose_weight',
  pace: 'moderate',
  activityLevel: 'lightly_active',
};
const calc = await call('POST', '/calculo-fisico', { json: pessoa });
if (calc.status !== 200) fail('calculo fisico', calc);
info('Mulher, 165 cm, 68 kg, objetivo: perder peso, atividade leve');
info(`TMB (gasto em repouso): ${calc.body.bmr.bmr} kcal/dia  [formula ${calc.body.bmr.formula}]`);
info(`Gasto total (TDEE):     ${calc.body.tdee.tdee} kcal/dia`);
info(`Meta diaria:            ${calc.body.calories.targetCalories} kcal`);
info(
  `Macros: proteina ${calc.body.macros.protein.grams} g | carbo ${calc.body.macros.carbs.grams} g | gordura ${calc.body.macros.fat.grams} g`,
);

// ---------------------------------------------------------------------------
await etapa('Perfil + consentimento LGPD (POST /perfil)');
const perfil = await call('POST', '/perfil', {
  token,
  json: {
    ...pessoa,
    displayName: 'Pessoa da Demo',
    trainingDaysPerWeek: 3,
    sessionDurationMinutes: 60,
    experience: 'beginner',
    location: 'gym',
    availableEquipment: ['machines', 'dumbbells', 'cable_machine', 'bench'],
    restrictions: [],
    mealsPerDay: 4,
    timezone: 'America/Sao_Paulo',
    healthDataConsent: true,
  },
});
if (perfil.status !== 200) fail('onboarding', perfil);
const meta = perfil.body.currentTarget;
info(`Perfil salvo. Meta gravada no banco: ${meta.calories} kcal | proteina ${meta.protein} g`);

// ---------------------------------------------------------------------------
let primeiraComida = null;
for (const photo of photos) {
  await etapa(`Foto do prato: ${basename(photo)} (POST /scan-prato)`);
  const form = new FormData();
  form.append('foto', new Blob([readFileSync(photo)], { type: MIME[extname(photo).toLowerCase()] ?? 'image/jpeg' }), basename(photo));
  form.append('mealType', 'lunch');
  const t0 = Date.now();
  const scan = await call('POST', '/scan-prato', { token, form });
  const ms = Date.now() - t0;
  if (scan.status !== 200) fail('analise da foto', scan);
  const r = scan.body;
  info(`App -> API -> IA (Python/CLIP) -> API -> App em ${(ms / 1000).toFixed(1)} s`);
  if (!r.isFood) {
    info(`Rejeitada: ${r.rejectionReason}`);
    continue;
  }
  for (const f of r.foods) {
    info(
      `- ${f.name.padEnd(26)} ~${String(f.estimatedGrams).padStart(4)} g  ${String(f.totals.calories).padStart(4)} kcal  ` +
        `(P ${f.totals.protein} | C ${f.totals.carbs} | G ${f.totals.fat})  confianca ${Math.round(f.confidence * 100)}%`,
    );
  }
  info(`Total estimado: ${r.totals.calories} kcal (faixa ${r.totals.caloriesMin}-${r.totals.caloriesMax} kcal)`);
  info(`Precisa confirmar porcao? ${r.needsUserConfirmation ? 'sim' : 'nao'}  [${r.confirmationReasons.join(', ')}]`);
  info(`Aviso: ${r.disclaimer}`);
  primeiraComida ??= r;
}

// ---------------------------------------------------------------------------
if (primeiraComida) {
  await etapa('Usuario confirma e ajusta a porcao (POST /diario)');
  const [primeiro, ...resto] = primeiraComida.foods;
  const ajustado = Math.round(primeiro.estimatedGrams * 1.2);
  const item = (f, grams, portionSource) => ({
    foodId: f.foodId,
    nameSnapshot: f.name,
    per100gSnapshot: f.per100g,
    quantity: grams,
    unit: 'g',
    grams,
    preparationMethod: f.preparationMethod,
    portionSource,
    aiConfidence: f.confidence,
    aiEstimatedGrams: f.estimatedGrams,
  });
  const meal = await call('POST', '/diario', {
    token,
    json: {
      mealType: 'lunch',
      consumedAt: new Date().toISOString(),
      analysisId: primeiraComida.analysisId,
      title: primeiraComida.description,
      foods: [item(primeiro, ajustado, 'user_adjusted'), ...resto.map((f) => item(f, f.estimatedGrams, 'ai_estimate'))],
    },
  });
  if (meal.status !== 201) fail('salvar refeicao', meal);
  info(`"${primeiro.name}": IA estimou ${primeiro.estimatedGrams} g, usuario corrigiu para ${ajustado} g`);
  info(`Refeicao salva no diario: ${meal.body.totals.calories} kcal (calculado pelo servidor, nao pelo app)`);

  await etapa('Resumo do dia (GET /dieta/resumo)');
  const resumo = await call('GET', `/dieta/resumo?date=${meal.body.localDate}`, { token });
  if (resumo.status !== 200) fail('resumo do dia', resumo);
  const s = resumo.body;
  info(`Consumido: ${s.consumed.calories} de ${s.targets.calories} kcal  ->  faltam ${s.calories.remaining} kcal (${s.calories.percent}%)`);
  info(`Proteina:  ${s.protein.consumed} de ${s.protein.target} g`);
}

// ---------------------------------------------------------------------------
await etapa('Treino (POST /treinos/gerar e GET /treino-dia)');
const plano = await call('POST', '/treinos/gerar', { token, json: {} });
if (plano.status !== 201) fail('gerar treino', plano);
info(`Plano: ${plano.body.split} | ${plano.body.workouts.map((w) => w.name).join(' / ')}`);
const hoje = await call('GET', '/treino-dia', { token });
if (hoje.status !== 200) fail('treino do dia', hoje);
if (hoje.body.isRestDay) {
  info(`Hoje (${hoje.body.date}) e dia de descanso. Proximo: ${hoje.body.nextWorkout?.name} em ${hoje.body.nextWorkout?.date}`);
} else {
  info(`Treino de hoje: ${hoje.body.workout.name}`);
  for (const e of hoje.body.workout.exercises) {
    info(`- ${e.exercise.name}: ${e.sets} x ${e.repsMin}-${e.repsMax}, descanso ${e.restSeconds}s`);
  }
}

console.log('\nDemonstracao concluida.');
rl?.close();
