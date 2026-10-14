# API REST

Servidor: `apps/api` (Node + Express). Contratos (Zod) de entrada e saída em `packages/core/src/schemas/`; o app importa os mesmos tipos.

Rotas autenticadas exigem `Authorization: Bearer <token>`, com o token devolvido por `/cadastro` ou `/login`. Campos JSON em inglês (iguais aos contratos do core); rotas em português, como no guia.

## Autenticação e autorização

- **Autenticação própria:** e-mail + senha (hash scrypt) na tabela `users`. A API emite um JWT (validade padrão de 30 dias). `POST /logout` invalida **todos** os tokens do usuário (`token_version`).
- **Autorização:** o `userId` vem do token, nunca do corpo ou da query. Recurso de outro usuário responde **404**, não 403.
- **Validação:** `body`, `params` e `query` passam pelo schema Zod antes do handler. Falha → `422` com a lista de campos. A resposta também é validada; o que não está no contrato não sai.

### Códigos de erro

| Código | Quando |
|---|---|
| 400 | JSON malformado |
| 401 | Token ausente, inválido, expirado ou revogado; credenciais erradas |
| 404 | Não existe **ou** não é seu |
| 409 | Conflito de estado (e-mail já usado, treino em andamento, plano ativo, onboarding pendente) |
| 413 | Foto ou corpo grande demais |
| 422 | Falhou na validação Zod, em regra de domínio (`DomainError`) ou a imagem é inválida (`photo_required`, `photo_empty`, `unsupported_image`) |
| 429 | Rate limit ou cota diária |
| 502 | Serviço de IA indisponível, lento ou com resposta fora do contrato |

Corpo do erro:
```json
{ "error": { "code": "validation_failed", "message": "...", "details": {}, "requestId": "..." } }
```
O `requestId` também volta no header `x-request-id`.

---

## Rotas do guia

| Método | Rota | Auth | O que faz |
|---|---|---|---|
| POST | `/cadastro` | — | Cria o usuário (`email`, `password` 8–128) e devolve `{ token, expiresAt, user }`. E-mail repetido → 409 |
| POST | `/calculo-fisico` | — | TMB + TDEE + meta calórica + macros (core). Sem efeito colateral; serve para a prévia do onboarding |
| GET | `/treino-dia` | ✔ | Treino agendado para hoje no plano ativo, ou `isRestDay: true` + `nextWorkout` |
| POST | `/scan-prato` | ✔ | **Rota mágica.** `multipart/form-data`: `foto` (JPEG/PNG/WebP, máx. 5 MB) + `mealType?` + `userHint?`. A API repassa ao serviço Python e devolve alimentos, gramas, macros, faixa de calorias e se precisa confirmar. **Não salva no diário** |

## Demais rotas do MVP

### Sessão

| Método | Rota | Notas |
|---|---|---|
| POST | `/login` | `{ email, password }` → `{ token, expiresAt, user }`. Mesma resposta para e-mail inexistente e senha errada |
| POST | `/logout` | Invalida todos os tokens do usuário. 204 |

### Perfil (tabela "Usuários")

| Método | Rota | Notas |
|---|---|---|
| GET | `/perfil` | Perfil + meta vigente + status do onboarding |
| POST | `/perfil` | Onboarding: perfil completo + `healthDataConsent: true` (LGPD). Calcula e grava a primeira meta e o peso inicial |
| PUT | `/perfil` | Atualização parcial. Mudar peso/objetivo/atividade **encerra a meta atual e cria uma nova** |
| DELETE | `/perfil` | Exclui a conta e **todos** os dados (DELETE real, cascade). 204 |

### Dieta

| Método | Rota | Notas |
|---|---|---|
| GET | `/dieta/meta` | Meta vigente (calorias, proteína, carboidratos, gorduras, fibra, avisos) |
| GET | `/dieta/resumo?date=YYYY-MM-DD` | Consumido, restante e por refeição. Compara com a meta vigente **naquele dia** |

### Diário alimentar

| Método | Rota | Notas |
|---|---|---|
| POST | `/diario` | Salva a refeição confirmada. `analysisId` opcional (vinda do `/scan-prato`; cada análise vira no máximo uma refeição). Totais **recalculados no servidor** a partir de `per100gSnapshot × grams` |
| GET | `/diario?date=` ou `?from=&to=` | Histórico, paginado por cursor (`nextCursor`) |
| GET | `/diario/:id` | |
| PUT | `/diario/:id` | Atualização parcial; recalcula totais em transação |
| DELETE | `/diario/:id` | 204 |

### Alimentos

| Método | Rota | Notas |
|---|---|---|
| GET | `/alimentos?q=&category=&limit=&cursor=` | Busca por substring + similaridade (pg_trgm). Públicos e os do próprio usuário |
| GET | `/alimentos/:id` | |
| POST | `/alimentos` | Alimento privado do usuário (`source: user`) |

### Plano alimentar

| Método | Rota | Notas |
|---|---|---|
| POST | `/plano-alimentar/gerar` | `{ days?: 1-7, force?: bool }`. Gera **na hora** (regras do core) pela meta e restrições. Com plano ativo e sem `force` → 409 |
| GET | `/plano-alimentar` | Plano ativo (404 se não houver) |
| POST | `/plano-alimentar/refeicoes/:mealId/trocar` | `{ keepItemIds?: [] }`. Troca uma refeição mantendo os itens travados |
| PUT | `/plano-alimentar/itens/:itemId` | `{ quantity, unit, grams }`. Recalcula os totais da refeição e do dia |

### Treinos

| Método | Rota | Notas |
|---|---|---|
| POST | `/treinos/gerar` | `{ force?: bool }`. Gera **na hora** pelo perfil (frequência, nível, objetivo, equipamento, tempo) |
| GET | `/treinos/plano` | Plano ativo com os treinos e os exercícios |
| GET | `/treinos/historico?from=&to=&cursor=` | Execuções de treino, paginadas |
| GET | `/treinos/:id` | Prescrição + último registro de cada exercício (para sugerir carga) |
| POST | `/treinos/:id/iniciar` | Cria a execução. 409 se já houver uma em andamento |
| POST | `/treinos/:id/concluir` | Fecha a execução e calcula o volume total (aquecimento não conta) |
| POST | `/treinos/exercicios/:workoutExerciseId/registro` | Séries do exercício. **Idempotente** por (execução, exercício): reenvio substitui, não duplica |

### Progresso

| Método | Rota | Notas |
|---|---|---|
| GET | `/progresso?metric=&from=&to=&granularity=day\|week` | Série da medida + média móvel de 7 dias, calorias × meta por dia, aderência calórica e de treino, streak |
| POST | `/progresso/medidas` | Upsert por (métrica, dia) |
| DELETE | `/progresso/medidas/:id` | 204 |

### Operação

| Método | Rota | Notas |
|---|---|---|
| GET | `/health` | Público. `{"status","banco","ia"}`: 200 se banco e IA estão ok, 503 se algum falhar |

---

## Serviço de IA (interno, `apps/ia`)

Não é chamado pelo app, só pela API.

| Método | Rota | Notas |
|---|---|---|
| POST | `/analisar` | `multipart`: `foto` + `dica?`. Header `x-internal-token` obrigatório. Devolve `{ resultado, modelo, versao, processamentoMs }`; `resultado` segue `mealAnalysisModelOutputSchema` |
| GET | `/health` | Status e modelo carregado |

---

## Rate limiting

| Escopo | Limite | Onde é contado |
|---|---|---|
| Global por IP | 120/min | memória |
| `/cadastro`, `/login` por IP | 10/min | memória |
| `/scan-prato` por usuário | 10/min **e** 30/dia | memória (minuto) + `ai_usage_logs` (dia) |
| `/alimentos?q=` por usuário | 60/min | memória |

Todos configuráveis por variável de ambiente (`apps/api/.env.example`). Com mais de uma instância da API, os limites em memória passam a valer por instância; a cota diária, por estar no banco, continua global.
