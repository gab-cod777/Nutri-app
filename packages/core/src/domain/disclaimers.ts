/**
 * Textos de isencao exibidos no app.
 *
 * Ficam no dominio (e nao soltos na UI) por dois motivos: o backend precisa
 * devolve-los junto das respostas de IA para que qualquer cliente - app, web,
 * futura integracao - mostre o aviso; e centralizar facilita revisao juridica.
 *
 * Regra de produto: toda tela que mostra numero estimado por IA ou por formula
 * precisa exibir o disclaimer correspondente de forma visivel (nao escondido
 * atras de um "saiba mais").
 */
export const DISCLAIMERS = {
  /** Telas de TMB/TDEE/meta calorica. */
  energyEstimate:
    'Os valores de TMB, gasto calorico e meta diaria sao estimativas baseadas em formulas populacionais e podem variar em ate 20% para cada pessoa. Nao substituem avaliacao de um profissional de saude.',

  /** Resultado da analise de foto. */
  photoAnalysis:
    'Estimativa baseada na foto. A imagem nao permite identificar com precisao peso, oleo, molhos ou modo de preparo. Ajuste as quantidades para melhorar a precisao do seu diario.',

  /** Plano alimentar gerado. */
  mealPlan:
    'Este plano e uma sugestao gerada automaticamente a partir dos dados que voce informou. Nao e prescricao dietetica. Consulte um nutricionista, especialmente se voce tem alguma condicao de saude.',

  /** Plano de treino gerado. */
  workoutPlan:
    'Este treino e uma sugestao gerada automaticamente. Nao e prescricao de exercicio fisico. Interrompa em caso de dor e procure um profissional de educacao fisica ou medico antes de iniciar, especialmente se voce tem alguma condicao de saude.',
} as const;

export type DisclaimerKey = keyof typeof DISCLAIMERS;
