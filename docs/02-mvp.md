# MVP

## Princípio de corte

O app tem **um** fluxo que decide se ele vive ou morre:

> abrir → fotografar → confirmar → salvo

Se isso levar mais de 15 segundos e 3 toques, nada mais importa — o usuário abandona na primeira semana. Tudo o mais no MVP existe para dar contexto a esse fluxo.

## Escopo do MVP

| # | Entrega | Observação |
|---|---|---|
| 1 | Cadastro e login | Auth própria da API: e-mail + senha (`/cadastro`, `/login`). Apple/Google ficam para depois |
| 2 | Onboarding (6 passos) | Salva progresso a cada passo; retomável |
| 3 | TMB, TDEE, meta calórica, macros | Já implementado e testado em `packages/core` |
| 4 | Home | Anel de calorias, macros, próximo treino, últimas refeições |
| 5 | Foto → análise por IA | Câmera + galeria → `POST /scan-prato` → serviço Python (modelo próprio). Foto não é armazenada |
| 6 | Correção e confirmação | Chips P/M/G, edição de gramas, remover/adicionar item |
| 7 | Diário alimentar | Por refeição, com totais e restante |
| 8 | Busca manual de alimento | Fallback obrigatório para quando a IA erra ou não há foto |
| 9 | Plano alimentar | 7 dias, trocar refeição, regenerar. Gerado por regras do core (sem IA) |
| 10 | Plano de treino | Divisão por nível/frequência/equipamento. Gerado por regras do core; `GET /treino-dia` |
| 11 | Execução de treino | Marcar série, registrar carga e reps, timer de descanso |
| 12 | Progresso | Peso (com média móvel de 7 dias), calorias, aderência |
| 13 | Perfil e configurações | Editar dados, recalcular metas, excluir conta (LGPD) |

### Fora do MVP, mas obrigatório antes de publicar

- Disclaimers em toda tela com número estimado *(API já devolve o texto em cada resposta estimada)*
- Consentimento de dados de saúde (LGPD) no onboarding *(API: obrigatório em `POST /perfil`)*
- Exclusão de conta com expurgo real *(API: `DELETE /perfil` apaga tudo)*
- Tratamento de erro e offline no fluxo de foto *(API: 502 tratado + busca manual; offline é do app)*
- Rate limit nas rotas de IA *(API: 10/min + 30/dia por usuário)*

Não são features. São o custo de operar um app que fala sobre saúde.

## V2 — na ordem de prioridade

1. **Código de barras** (OpenFoodFacts). Para industrializados é mais rápido e mais exato que foto. Alto valor, baixo esforço — só ficou fora por foco.
2. **Progressão automática de carga** — o `SetLog` com RIR já está modelado para isso.
3. **Sugestão pelas calorias restantes**: "sobraram 480 kcal e 35 g de proteína — 3 opções".
4. **Substituição inteligente de alimento** com equivalência de macros.
5. **Streaks e notificações** nos horários das refeições.
6. Metas semanais em vez de diárias (tolera o churrasco de domingo).
7. Refeições favoritas / repetir refeição de ontem.
8. Integração com Apple Health / Health Connect.
9. Análise histórica com padrões ("suas quintas passam 400 kcal da meta").
10. Orçamento no plano alimentar.

## V3+

Comunidade, receitas com foto de execução, exportação para nutricionista, wearables, análise por vídeo.

## Métricas que definem sucesso

| Métrica | Alvo | Por quê |
|---|---|---|
| Tempo foto → refeição salva | < 15 s (p50) | O produto inteiro |
| Taxa de correção de porção | 30–50% | Acima disso a IA não serve; abaixo, o usuário não está conferindo |
| Dias com registro na semana 1 | ≥ 4 | Preditor de retenção em 30 dias |
| Retenção D30 | > 25% | Referência de apps de nutrição |
| Custo de IA por usuário ativo/mês | < US$ 0,40 | Viabilidade da assinatura. Modelo próprio: custo é CPU do serviço Python, não por chamada |
| Falha de validação do output | < 2% | Saúde do prompt |

A **taxa de correção** é a métrica mais importante e a menos óbvia: ela mede simultaneamente a qualidade do modelo e a honestidade da interface.
