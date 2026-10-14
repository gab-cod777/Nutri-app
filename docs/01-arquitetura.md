# Arquitetura

Segue o **Guia Prático do Back-end - Nutrix**: servidor principal em Node.js + TypeScript (Express), microsserviço de IA em Python usado **só** para a foto do prato, PostgreSQL com Prisma.

## Visão geral

```
┌─────────────────────────────┐
│  App (Expo / React Native)  │
│  UI · estado · cache        │
└──────────────┬──────────────┘
               │ HTTPS + JWT (emitido pela API)
               ▼
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  API - Node + Express (TS)  │ ─────► │  IA - Python + FastAPI       │
│  auth · regras · validação  │  HTTP  │  POST /analisar (foto)       │
│  apps/api                   │ ◄───── │  modelo de visão próprio     │
└──────────────┬──────────────┘ token  │  apps/ia (rede interna)      │
               │ Prisma        interno └──────────────────────────────┘
               ▼
┌─────────────────────────────┐
│  PostgreSQL                 │
└─────────────────────────────┘
```

- O app **só fala com a API**. O serviço de IA fica em rede interna, e toda chamada a ele exige `x-internal-token`.
- A foto vai do app para a API, que repassa para o Python, que devolve os alimentos e os macros. Esse é o fluxo da rota mágica `POST /scan-prato`. **A foto não é armazenada**: guardamos só o hash SHA-256 (para não reanalisar a mesma imagem) e o resultado.
- Nenhum provedor externo de IA ou de autenticação. As credenciais ficam na tabela de usuários, com a senha em hash scrypt.

---

## Camadas

### `packages/core`: domínio compartilhado

Sem I/O e sem framework. Roda igual no Node e no app (Hermes).

| Pasta | Responsabilidade |
|---|---|
| `domain/nutrition/` | TMB, TDEE, meta calórica, macros, porções, resumo diário, pós-processamento da análise de foto, **gerador de cardápio por regras** |
| `domain/training/` | volume de treino, duração estimada, **agenda semanal** (`/treino-dia`), **gerador de plano de treino por regras** |
| `domain/progress/` | média móvel de peso, aderência, streak |
| `domain/disclaimers.ts` | Textos de isenção servidos junto das respostas |
| `schemas/` | Contratos Zod de todas as rotas (entrada **e** saída) |
| `utils/` | `DomainError`, arredondamento, datas por fuso |

**Por que existe:** o app calcula a meta offline com o mesmo código do servidor, e a validação de um payload usa o mesmo schema nos dois lados.

**Regra:** função que precisa de relógio, rede ou banco recebe isso por parâmetro.

### `apps/api`: servidor principal (Node + Express)

```
src/
  app.ts               # composição: serviços + middlewares + rotas
  server.ts            # bootstrap (env, Prisma, cliente da IA, listen)
  config/env.ts        # variáveis de ambiente validadas com Zod na subida
  auth/                # hash de senha (scrypt) e tokens JWT
  http/                # defineRoute (Zod in/out), auth, rate limit, erros
  services/ia/         # VisionClient (porta) + PythonVisionClient + IaService
  modules/             # um módulo por contexto do guia
    auth/              # /cadastro, /login, /logout
    perfil/            # tabela "Usuários": dados físicos, objetivo, LGPD
    dieta/             # tabela "Dieta": /calculo-fisico, metas, resumo diário
    diario/            # tabela "Diário Alimentar" + /scan-prato
    alimentos/         # base de alimentos e busca
    plano-alimentar/   # cardápio semanal
    treinos/           # tabela "Treinos": plano, /treino-dia, execução, histórico
    progresso/         # medidas, gráficos, aderência
prisma/
  schema.prisma, migrations/, seed.ts, seed-data/exercises.ts
```

Cada módulo segue **rota → service → repository**:

- **rota** (`*.routes.ts`): método, caminho e contrato Zod de entrada e saída. O helper `defineRoute` valida o corpo, a query e os params, e depois valida a resposta. Campo não declarado no contrato não sai da API, o que impede vazar `passwordHash`, `userId` etc.
- **service**: regra de negócio e orquestração. Não conhece `req`/`res`.
- **repository**: acesso ao Prisma, sempre filtrando por `userId`.

### `apps/ia`: microsserviço de IA (Python + FastAPI)

```
app/
  main.py           # FastAPI: POST /analisar, GET /health
  analise.py        # detecção de alimentos, qualidade da imagem, porção
  classificador.py  # porta Classificador + ClipClassificador
  alimentos.py      # leitura da tabela compartilhada
  dados/alimentos.json   # TABELA ÚNICA de alimentos (Python + seed do banco)
tests/test_api.py   # testes com classificador falso (sem baixar modelo)
```

**Modelo:** CLIP (`openai/clip-vit-base-patch32`) em modo *zero-shot*. A imagem é comparada com descrições dos alimentos da nossa tabela ("a photo of white rice", "a photo of brown beans stew"...), sem treino específico. Para pratos com vários itens, classificamos a imagem inteira e recortes (grade 2x2 + centro) e juntamos os rótulos mais fortes. Também há rótulos de "não comida" (teclado, pessoa, documento...): se eles dominam, a foto é rejeitada.

**Porção:** uma foto sem referência de escala não permite medir gramas. A porção vem da porção típica de cada alimento na tabela, com faixa larga (mín./máx.), e a confiança é limitada a 0,57, abaixo do limiar de 0,6 do core. Por isso **o app sempre abre o ajuste de porção**. A taxa de correção (`portionSource = user_adjusted`) mede a qualidade.

**Qualidade da imagem:** brilho médio e nitidez (variância do Laplaciano) → `good`/`fair`/`poor`.

**Uma tabela só:** `apps/ia/app/dados/alimentos.json` é lida pelo serviço de IA (macros devolvidos) **e** pelo seed do banco (`apps/api/prisma/seed.ts`). O número mostrado pela IA e o que está na base nunca divergem.

---

## Fluxo da foto (`POST /scan-prato`)

```
app ── multipart (foto, mealType?, userHint?) ──► API
  1. requireAuth: userId vem do token
  2. rate limit por usuário (10/min) + multer (máx. 5 MB, só em memória)
  3. magic bytes: só JPEG/PNG/WebP de verdade
  4. hash SHA-256: mesma foto já analisada → devolve a análise salva
  5. cota diária (30/dia, contada em ai_usage_logs)
  6. IaService → PythonVisionClient ── multipart + x-internal-token ──► IA /analisar
  7. resposta validada com mealAnalysisModelOutputSchema (Zod do core)
     inválida → 502 ai_invalid_output (nunca gravada)
  8. core: totais, faixa de calorias, confiança, motivos de confirmação
  9. grava meal_analyses (hash + resultado) e ai_usage_logs (status, latência)
◄── estimativa (NÃO salva no diário)
app: usuário confirma/edita → POST /diario (totais recalculados no servidor)
```

Analisar e salvar são separados de propósito: a análise é uma sugestão, a refeição é um fato.

---

## Planos alimentar e de treino

Os dois são gerados **por regras do core**, na hora (sem fila, sem IA externa):

- **Treino** (`generateWorkoutPlan`): a divisão sai da frequência (1–3 dias: corpo inteiro; 4: superior/inferior; 5–7: push/pull/legs). O volume depende do nível, e a faixa de repetições e o descanso dependem do objetivo. Compostos vêm antes de isolados. Só entram exercícios do catálogo compatíveis com o equipamento do usuário, e a sessão é cortada até caber no tempo disponível. A agenda (`trainingWeekdays`) distribui os treinos na semana (3x = seg/qua/sex), e é isso que o `GET /treino-dia` usa.
- **Cardápio** (`generateMealPlan`): segue moldes brasileiros (café; almoço/jantar com carboidrato + leguminosa + proteína + salada + azeite; lanches). Os alimentos passam pelo filtro de restrições (tags: `lactose`, `gluten`, `animal`...) e de "não gosto". O ajuste de gramas acerta primeiro a proteína; depois o carboidrato fecha as calorias, e leguminosa/azeite reduzem se ainda sobrar. Testado: cada dia fica a no máximo 10% da meta, inclusive em dieta vegana, vegetariana e de proteína alta.

---

## Decisões e seus custos

| Decisão | Ganho | Custo aceito |
|---|---|---|
| Express (guia) | Familiar ao time, ecossistema grande | Validação de rota feita à mão (`defineRoute`) |
| IA em Python separada (guia) | Ecossistema de ML, isolamento de CPU/memória | Um serviço a mais para operar; chamada HTTP extra |
| Modelo próprio (CLIP zero-shot) | Sem custo por chamada, sem dado saindo da infra | Precisão menor que um LLM de visão; porção não medida |
| Auth própria (guia) | Sem fornecedor externo | Nós respondemos por hash, rate limit e revogação |
| Foto não armazenada | Menos dado sensível (LGPD) | Não dá para reprocessar fotos antigas com um modelo novo |
| Planos por regras | Determinístico, testável, instantâneo, grátis | Menos variedade que um gerador por IA |
| Totais denormalizados em `meals` | Resumo diário = 1 leitura indexada | Recalcular em transação a cada escrita |
| Snapshot nutricional em `meal_foods` | Histórico imutável | Duplicação de dados |
| `NutritionTarget` versionada | Aderência histórica correta | Uma tabela a mais |

---

## Segurança

- **Senhas:** scrypt (N=2^15, salt aleatório), nunca logadas nem devolvidas. O login responde igual (mensagem e tempo) para e-mail inexistente e senha errada.
- **Tokens:** JWT HS256 emitido pela API (`iss`/`aud` fixos, validade padrão de 30 dias). `users.token_version` vai no token; `POST /logout` incrementa a versão e invalida todos os tokens anteriores. Excluir a conta também os invalida.
- **Autorização:** o `userId` vem **só** do token. Todo repository filtra por ele. Recurso de outro usuário responde **404**, não 403 (não confirmamos que existe). Testado para refeição, análise, alimento privado, plano, treino e medida.
- **Validação:** todo input passa por Zod; id que não é UUID vira 422 e nunca chega ao banco. Toda saída também passa por Zod.
- **Upload:** multer em memória, máx. 5 MB, 1 arquivo; tipo real pelos magic bytes. O Python valida de novo (formato e proteção contra *decompression bomb*).
- **IA:** a resposta do serviço Python é tratada como entrada não confiável e validada com Zod antes de qualquer uso.
- **Rate limit:** global por IP (120/min); `/cadastro` e `/login` por IP (10/min, contra força bruta); `/scan-prato` por usuário (10/min) + cota diária no banco (30/dia); busca de alimentos por usuário (60/min).
- **LGPD:** consentimento explícito para dados de saúde no onboarding (`health_data_consent_at`). Exclusão de conta é `DELETE` real em cascade; `ai_usage_logs` ficam anonimizados.
- **Erros:** handler global; em produção, 5xx devolve mensagem genérica + `requestId`, e o detalhe vai para o log (com `authorization` mascarado).
- **Headers:** `helmet`; `x-powered-by` desligado.
