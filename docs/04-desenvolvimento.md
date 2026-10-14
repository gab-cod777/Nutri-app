# Desenvolvimento

Para quem vai **mexer no código**. Para só apresentar, use o [README](../README.md).

## Estrutura

```text
nutrisnap/
├── packages/core/        # regras de nutrição/treino + contratos Zod (API e app usam)
├── apps/api/             # API Node + Express + Prisma (porta 3333)
│   ├── src/modules/      # auth, perfil, dieta, diario (+ scan-prato), alimentos,
│   │                     # plano-alimentar, treinos, progresso
│   ├── prisma/           # schema, migrations, seed (+ seed-data/exercises.ts)
│   └── tests/            # unit/ e integration/ (Postgres real)
├── apps/ia/              # serviço de visão Python + FastAPI (porta 8000)
│   ├── app/              # main.py, analise.py, classificador.py
│   ├── app/dados/alimentos.json   # TABELA ÚNICA de alimentos (IA + seed do banco)
│   └── tests/
├── apps/mobile/          # app Expo (SDK 57) — ainda com dados locais simulados
├── scripts/              # scripts Node usados pelos `npm run` da raiz
├── demo/fotos/           # fotos de exemplo (licenças em CREDITOS.md)
├── docker-compose.yml    # PostgreSQL 16 (porta 5432 ou NUTRISNAP_DB_PORT)
└── docs/
```

Detalhes de camadas e decisões: [01-arquitetura.md](01-arquitetura.md). Rotas: [03-api.md](03-api.md).

## Scripts da raiz

Todos rodam a partir da raiz do repositório.

| Script | O que faz |
|---|---|
| `npm install` | Instala tudo; o `postinstall` compila o `core` e roda `prisma generate` |
| `npm run setup:env` | Cria `apps/api/.env` e `apps/ia/.env` com segredos aleatórios (não sobrescreve) |
| `npm run setup:ia` | Cria `apps/ia/.venv` e instala torch (CPU) + `requirements-dev.txt` |
| `npm run db:up` | `docker compose up -d --wait` (PostgreSQL) |
| `npm run db:setup` | `prisma migrate deploy` + seed (idempotente) |
| `npm run dev:ia` | Sobe a IA em `127.0.0.1:8000` com `apps/ia/.env` |
| `npm run dev:api` | Sobe a API em modo watch (`tsx watch`), lendo `apps/api/.env` |
| `npm run dev:mobile` | `expo start` no app |
| `npm run demo [-- --pausar] [-- foto.jpg]` | Fluxo completo pela API real (`scripts/demo.mjs`). Usa `API_URL` (padrão `http://localhost:3333`) |
| `npm run demo:fotos` | Baixa as fotos de exemplo do Wikimedia Commons para `demo/fotos/` |
| `npm run build` | Compila os workspaces (core e API → `dist/`) |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces (ver observação do mobile abaixo) |
| `npm run core:test` | Testes do domínio (141) |
| `npm run test:api` | Testes da API (unitários sempre; integração só com `TEST_DATABASE_URL`) |
| `npm run test:ia` | Testes do serviço Python (12, com classificador falso — não baixa modelo) |

Scripts do workspace da API (`npm run <script> --workspace @nutrisnap/api`): `dev`, `build`, `start` (roda `dist/` com `.env`), `typecheck`, `test`, `prisma:generate`, `prisma:migrate` (`migrate dev`), `prisma:deploy`, `prisma:studio`, `prisma:validate`, `db:seed`, `db:setup`.

> A API lê o `.env` via `--env-file-if-exists` do Node (exige **Node 22.9+**). Não há `dotenv`.

## Testes

```bash
npm run core:test
npm run test:ia
```

### Testes de integração da API (Postgres real)

Eles **apagam os dados** do banco que receberem. Use um banco separado. Com o compose no ar:

```bash
docker compose exec db createdb -U postgres nutrisnap_test
```

Aplique as migrations nele (bash/zsh; troque a porta se usar `NUTRISNAP_DB_PORT`):

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nutrisnap_test" \
DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nutrisnap_test" \
npx prisma migrate deploy
cd ../..
```

PowerShell:

```powershell
cd apps/api
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nutrisnap_test"
$env:DIRECT_DATABASE_URL=$env:DATABASE_URL
npx prisma migrate deploy
cd ../..
```

Rode:

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nutrisnap_test" npm run test:api
```

Sem `TEST_DATABASE_URL`, os testes de integração aparecem como **skipped** (não como aprovados).

## Banco e migrations

- Schema: `apps/api/prisma/schema.prisma`. Migration inicial: `apps/api/prisma/migrations/*_init/`.
- A migration inicial tem **SQL manual no final** (índices parciais e GIN que o Prisma não expressa). Ao criar uma migration nova com `npm run prisma:migrate --workspace @nutrisnap/api`, **revise o SQL gerado** e remova qualquer `DROP INDEX` desses índices.
- Seed: `apps/api/prisma/seed.ts` (exercícios em `seed-data/exercises.ts`, alimentos em `apps/ia/app/dados/alimentos.json`).
- Banco do zero (apaga tudo): `docker compose down -v && npm run db:up && npm run db:setup`.
- Inspecionar dados: `npm run prisma:studio --workspace @nutrisnap/api`.

## Serviço de IA

- Modelo: `openai/clip-vit-base-patch32` (zero-shot), baixado no 1º start (~581 MB medidos) para o cache do Hugging Face (`~/.cache/huggingface`; mude com `HF_HOME`).
- Medições (Linux, 8 núcleos, CPU): 1º start com download ~80 s; start com cache ~6 s; RAM ~0,4 GB parado e ~0,5 GB após análises; ~0,4–1,5 s por foto.
- Para adicionar/alterar alimentos: edite `apps/ia/app/dados/alimentos.json` (o teste `test_tabela_respeita_faixas_do_contrato` confere faixas e Atwater), reinicie a IA e rode `npm run db:setup` para levar a mudança ao banco.
- Rodar manualmente (sem os scripts): dentro de `apps/ia`, `.venv/bin/python -m uvicorn app.main:app --env-file .env --port 8000` (Windows: `.venv\Scripts\python.exe -m uvicorn ...`).

## App mobile

- Expo SDK 57, Expo Router. Roda no **Expo Go**; não há pasta `android/` nem build nativo (`gradlew`/APK não se aplicam).
- Monorepo: o Metro resolve `@nutrisnap/core` a partir de `packages/core/dist` (compilado no `postinstall`). Verificado com `npx expo export --platform android`.
- `npm run typecheck` acusa `Cannot find module ... '@/global.css'` no mobile **até o Expo rodar uma vez** (ele gera `apps/mobile/expo-env.d.ts`, que é ignorado pelo git). Rode `npm run dev:mobile` uma vez e o erro some.
- ⚠️ **Ainda não implementado:** o app não chama a API. `src/lib/mock-analysis.ts` sorteia o resultado da foto e os stores (`src/store/`) guardam tudo localmente. Para integrar: cliente HTTP com a URL da API configurável (`10.0.2.2` no emulador, IP da máquina no celular), telas de cadastro/login usando `POST /cadastro` e `POST /login`, token no `expo-secure-store`, envio da foto em `multipart/form-data` para `POST /scan-prato`, e troca dos stores locais por chamadas a `/diario`, `/dieta/resumo`, `/treino-dia` etc.

## Windows

Os scripts `npm run ...` funcionam igual (os de Python detectam `py`/`python` e o caminho `.venv\Scripts`). Não verificado em Windows por quem escreveu esta documentação, que testou em Linux.
