# NutriSnap

Aplicativo de alimentação e treino: você tira uma foto do prato, a inteligência artificial identifica os alimentos e estima as calorias, e o app acompanha sua meta do dia.

> As estimativas são aproximações (fórmulas populacionais e análise de imagem). Não são diagnóstico nem prescrição.

---

## 🚀 Demonstração rápida

```text
Celular (app) ──► API (Node/Express) ──► Banco (PostgreSQL)
                        │
                        ▼
                 Serviço de IA (Python)
```

| Peça | O que faz | Onde roda |
|---|---|---|
| **App** (`apps/mobile`) | Telas que o usuário vê | Celular, pelo app **Expo Go** |
| **API** (`apps/api`) | Cadastro/login, regras, cálculos, salva os dados, conversa com a IA | Seu computador, porta **3333** |
| **IA** (`apps/ia`) | Recebe a foto e diz quais alimentos tem nela | Seu computador, porta **8000** |
| **Banco** (PostgreSQL) | Guarda usuários, refeições, metas, treinos | Docker, porta **5432** |

> ⚠️ **Leia antes de apresentar:** o **app ainda não está conectado à API**. Ele mostra as telas (cadastro do perfil, diário, câmera, confirmação), mas usa **dados locais simulados**: o resultado da "foto" no app é **sorteado**, não vem da IA.
> O fluxo **real** (cadastro → foto → IA → diário → resumo) funciona pela API e é mostrado com o comando **`npm run demo`** (seção 9). A seção 10 traz um roteiro que usa as duas coisas sem enganar ninguém.

---

## Para apresentar (caminho curto)

Siga as seções **1 a 10** na ordem. Na primeira vez, separe uns **20–30 minutos** (a maior parte é download). Nas próximas vezes, só as seções **5 a 9** (uns 2 minutos).

---

## 1. Pré-requisitos

Instale o que falta e confira cada item com o comando ao lado.

| | Programa | Versão | Para quê | Como conferir |
|---|---|---|---|---|
| [ ] | **Git** | qualquer recente | Baixar o projeto | `git --version` |
| [ ] | **Node.js** | **22.9 ou mais novo** (LTS 22) — [nodejs.org](https://nodejs.org) | Rodar a API, o app e os scripts | `node --version` → `v22.x` (x ≥ 9) |
| [ ] | **npm** | vem junto com o Node (10.x) | Instalar dependências | `npm --version` |
| [ ] | **Python** | **3.12 ou mais novo** (mínimo 3.10; testado com 3.14) — [python.org](https://www.python.org/downloads/) | Rodar o serviço de IA | Linux/macOS: `python3 --version` · Windows: `py --version` |
| [ ] | **Docker** com Compose | Docker Desktop (Windows/macOS) ou Docker Engine + plugin compose (Linux) — [docker.com](https://www.docker.com/products/docker-desktop/) | Subir o banco PostgreSQL sem instalar nada | `docker compose version` |
| [ ] | **Expo Go** no celular | versão atual da loja (o app usa **Expo SDK 57**) | Abrir o app no celular | Instale pela Play Store / App Store |
| [ ] | Celular e computador **na mesma rede Wi-Fi** | — | O celular baixa o app do seu computador | — |

**Windows:** ao instalar o Python, marque **"Add python.exe to PATH"**.
**Docker:** o Docker Desktop precisa estar **aberto** (ícone da baleia ativo) antes dos comandos.

**Sistema:** todo este passo a passo foi **executado de ponta a ponta em Linux** (Fedora, Node 22.23, Python 3.14, Docker Compose 5.5). Em **Windows e macOS** os comandos são os mesmos (os scripts tratam as diferenças), mas **não foram testados**: ensaie uma vez antes do dia.

**Espaço e memória (medidos):** ~3 GB em disco no total (dependências Node ~0,8 GB, ambiente Python ~1,2 GB, modelo de IA ~0,6 GB). A IA usa ~0,5 GB de RAM. **Não precisa de placa de vídeo (GPU)**: tudo roda no processador.

---

## 2. Clonar o projeto

```bash
git clone https://github.com/beezaneyyy/projeto.git nutrisnap
cd nutrisnap
```

> Todos os comandos `npm run ...` deste README são executados **nesta pasta** (`nutrisnap`, a raiz do projeto), a não ser que esteja escrito outra coisa.

---

## 3. Instalar dependências

### 3.1 Node (API, app e scripts) — um comando só

```bash
npm install
```

Esse comando também **compila o pacote compartilhado** (`packages/core`) e **prepara o acesso ao banco** (Prisma) automaticamente. Ao final aparecem avisos de "vulnerabilities": pode ignorar para a apresentação.

### 3.2 Python (serviço de IA)

```bash
npm run setup:ia
```

Cria o ambiente Python em `apps/ia/.venv` e instala PyTorch (versão para processador), FastAPI etc. Leva **alguns minutos** na primeira vez (baixa ~1 GB). O final esperado é:

```text
OK: servico de IA instalado. Para subir: npm run dev:ia
```

---

## 4. 🔐 Configuração do ambiente

Você precisa de **dois** arquivos `.env` (o app mobile **não** precisa de nenhum). Um comando cria os dois, com senhas aleatórias:

```bash
npm run setup:env
```

```text
Criados:
  apps/api/.env  (JWT_SECRET e IA_INTERNAL_TOKEN aleatorios)
  apps/ia/.env   (mesmo IA_INTERNAL_TOKEN da API)
```

Pronto: **não há nenhuma credencial externa para conseguir**. Nada de chave de API, conta em nuvem ou cadastro em serviço. O comando nunca sobrescreve um `.env` que já existe.

<details>
<summary>O que tem em cada arquivo (só se quiser entender ou editar à mão)</summary>

**`apps/api/.env`** (modelo: `apps/api/.env.example`)

| Variável | Obrigatória? | Valor para apresentação | De onde vem |
|---|---|---|---|
| `DATABASE_URL` | Sim | `postgresql://postgres:postgres@localhost:5432/nutrisnap?schema=public` | Banco do `docker-compose.yml` (usuário/senha `postgres`, banco `nutrisnap`) |
| `DIRECT_DATABASE_URL` | Sim | igual à `DATABASE_URL` | Usada pelas migrations |
| `JWT_SECRET` | Sim (mín. 32 caracteres) | aleatório (gerado pelo `setup:env`) | Assina os tokens de login. Nunca compartilhe |
| `IA_SERVICE_URL` | Sim | `http://localhost:8000` | Endereço do serviço de IA |
| `IA_INTERNAL_TOKEN` | Sim (mín. 24) | aleatório, **igual** ao de `apps/ia/.env` | Senha entre API e IA |
| `PORT` | Não | `3333` | Porta da API |
| `HOST` | Não | `0.0.0.0` | Aceita conexões da rede (celular) |
| `LOG_LEVEL` | Não | `warn` | `info`/`debug` mostram cada requisição |
| `JWT_EXPIRES_IN_DAYS`, `IA_TIMEOUT_MS`, `RATE_LIMIT_*`, `MAX_MEAL_PHOTO_BYTES`, `TRUST_PROXY` | Não | valores do exemplo | Limites e ajustes finos |

**`apps/ia/.env`** (modelo: `apps/ia/.env.example`)

| Variável | Obrigatória? | Valor | De onde vem |
|---|---|---|---|
| `IA_INTERNAL_TOKEN` | Sim | **igual** ao da API | Gerado pelo `setup:env` |
| `IA_MODEL_NAME` | Não | `openai/clip-vit-base-patch32` | Modelo baixado no 1º start |
| `IA_MAX_IMAGE_BYTES` | Não | `5242880` (5 MB) | Tamanho máximo da foto |

**`.env` na raiz** — só existe se a porta 5432 estiver ocupada (seção 5).

> Não há CORS configurado: o app nativo não precisa. Rodar o app **no navegador** (`expo start --web`) contra a API não é suportado.
</details>

---

## 5. Subir o banco de dados

```bash
npm run db:up
```

Sobe um PostgreSQL 16 no Docker e espera ele ficar pronto. Final esperado: `Container ...-db-1  Healthy`.

Depois, crie as tabelas e carregue os dados iniciais (39 exercícios e 51 alimentos):

```bash
npm run db:setup
```

Final esperado: `seed ok: 39 exercicios, 51 alimentos`. (Pode rodar de novo sem problema.)

> **Deu `address already in use` / `port is already allocated`?** Já existe um PostgreSQL usando a porta 5432 no seu computador. Faça assim:
> 1. Crie um arquivo chamado `.env` **na raiz do projeto** com esta linha: `NUTRISNAP_DB_PORT=5433`
> 2. Em `apps/api/.env`, troque `localhost:5432` por `localhost:5433` (nas **duas** URLs).
> 3. Rode `docker compose down` e depois `npm run db:up` e `npm run db:setup` de novo.

**Como saber se funcionou:** a API (seção 7) mostra `"banco":"ok"` em http://localhost:3333/health.

---

## 6. Subir o serviço de IA

Abra um **terminal novo** (deixe este aberto o tempo todo) na pasta do projeto:

```bash
npm run dev:ia
```

> ⚠️ **Na primeira vez demora ~1–2 minutos:** o modelo de IA (~600 MB) é baixado da internet. Isso é normal e acontece **uma vez**. Nas próximas, sobe em ~6 segundos.
> O modelo fica salvo em `~/.cache/huggingface` (Windows: `C:\Users\<você>\.cache\huggingface`).

Pronto quando aparecer: `Uvicorn running on http://127.0.0.1:8000`.

**Verificar:** abra http://localhost:8000/health no navegador:

```json
{"status":"ok","modelo":"openai/clip-vit-base-patch32","versao":"visao-clip@1"}
```

---

## 7. Subir a API

Abra **outro terminal novo** na pasta do projeto:

```bash
npm run dev:api
```

**Verificar:** abra http://localhost:3333/health no navegador. Tudo certo é:

```json
{"status":"ok","banco":"ok","ia":"ok"}
```

Se aparecer `"banco":"erro"` ou `"ia":"indisponivel"`, veja **🛠️ Se der problema**.

> Não há Swagger/OpenAPI. A lista de rotas está em [docs/03-api.md](docs/03-api.md).

---

## 8. Rodar o app no celular

Abra **um terceiro terminal** na pasta do projeto:

```bash
npm run dev:mobile
```

Aparece um **QR code** no terminal.

### Celular Android ou iPhone (recomendado)

1. Celular e computador **na mesma rede Wi-Fi** (rede de visitantes/corporativa às vezes bloqueia: na dúvida, use o roteador do celular de alguém).
2. Abra o **Expo Go** e escaneie o QR code (no iPhone, use a câmera).
3. O app abre no celular. **Não é preciso gerar APK** nem rodar `gradlew`: o projeto não tem pasta `android/`.

### Emulador Android (alternativa)

1. Abra o Android Studio → *Device Manager* → ▶ em um emulador.
2. No terminal do `npm run dev:mobile`, aperte **`a`**.

### Sobre `localhost`, `10.0.2.2` e o IP da máquina

Hoje o app **não chama a API** (veja o aviso no topo), então **não há URL de API para configurar no app**. Mesmo assim, vale entender, porque é a causa nº 1 de "não conecta":

| De onde | `localhost` aponta para... | Para chegar no seu computador use |
|---|---|---|
| O próprio computador | o computador ✅ | `localhost` |
| Emulador Android | o **próprio emulador** ❌ | `10.0.2.2` |
| Celular físico | o **próprio celular** ❌ | o **IP do computador na rede** (ex.: `192.168.0.15`) |

**Descobrir o IP do computador:**
- Windows: `ipconfig` → linha **"Endereço IPv4"** da placa Wi-Fi
- macOS: `ipconfig getifaddr en0`
- Linux: `hostname -I` (o primeiro número)

**Teste rápido de rede:** no navegador **do celular**, abra `http://SEU-IP:3333/health`. Se aparecer `{"status":"ok",...}`, o celular enxerga a API. Se não abrir, é firewall ou rede (veja **🛠️ Se der problema**).

---

## 9. Rodar a demonstração do fluxo real

Com banco, IA e API no ar, em **mais um terminal** na pasta do projeto:

```bash
npm run demo -- --pausar
```

O `--pausar` espera você apertar **ENTER** entre as etapas, para dar tempo de explicar. Sem ele, roda tudo direto (~3 segundos).

Ele faz, de verdade, pela API e pela IA:

1. confere os serviços;
2. cria uma conta (`POST /cadastro`);
3. calcula gasto e meta (`POST /calculo-fisico`);
4. salva o perfil com consentimento LGPD (`POST /perfil`);
5. manda 4 fotos para a IA (`POST /scan-prato`): banana, batata frita, espaguete e um teclado;
6. "usuário" corrige a porção e salva no diário (`POST /diario`);
7. mostra o resumo do dia (`GET /dieta/resumo`);
8. gera o plano de treino e mostra o treino de hoje (`GET /treino-dia`).

**Usar outra foto** (do celular, da internet, JPEG/PNG/WebP até 5 MB):

```bash
npm run demo -- caminho/da/foto.jpg
```

As fotos de exemplo ficam em **`demo/fotos/`** (licenças livres, créditos em `demo/fotos/CREDITOS.md`). Se sumirem ou ficarem vazias: `npm run demo:fotos` baixa de novo.

---

## 10. 🎤 Roteiro de apresentação

**Antes de começar:** banco, IA e API no ar (seções 5–7), http://localhost:3333/health mostrando tudo `ok`, app aberto no celular (seção 8), um terminal pronto com `npm run demo -- --pausar`.

### Parte A — O app (interface)

**Etapa 1 — Perfil.** No celular, mostre o cadastro do perfil em passos: dados físicos (peso, altura, data de nascimento), objetivo e ritmo, atividade, treino, preferências. Na tela de resumo, mostre a **meta calórica e os macros**. *Fala:* "o cálculo usa o mesmo código que roda no servidor (pacote `core`): Mifflin-St Jeor para o gasto em repouso, fator de atividade, ajuste pelo objetivo e piso de segurança."

**Etapa 2 — Home e diário.** Mostre o anel de calorias e o diário por refeição.

**Etapa 3 — Tela da foto.** Mostre que o app abre **câmera ou galeria** e a tela de **confirmação** (porção P/M/G, ajuste em gramas, remover/adicionar item).
> ⚠️ **Diga com clareza:** "neste protótipo, o resultado que aparece no app ainda é simulado; a análise real vamos ver agora pela API." **Não apresente o resultado do app como se fosse a IA.**

### Parte B — O fluxo real (terminal)

Rode `npm run demo -- --pausar` e vá apertando ENTER:

**Etapa 4 — Cadastro.** Conta criada; senha guardada só como *hash*; a API devolve um token.

**Etapa 5 — Meta.** TMB, gasto total e meta diária com macros.

**Etapa 6 — Perfil + LGPD.** O perfil só é salvo com **consentimento explícito** para dados de saúde.

**Etapa 7 — IA.** Para cada foto, explique:

```text
A foto vai para a API.
A API confere se é mesmo uma imagem e chama o serviço Python.
O modelo (CLIP) compara a foto com os alimentos da nossa tabela.
O resultado volta com os macros da tabela; a API confere tudo antes de usar.
```

Mostre que a **batata frita** vem com aviso de calorias ocultas e que o **teclado é rejeitado**.

**Etapa 8 — Confirmação.** A IA estimou a porção; o "usuário" corrige; **o servidor recalcula** as calorias (o app não manda o total).

**Etapa 9 — Diário e resumo.** Refeição salva; consumido × meta × quanto falta.

**Etapa 10 — Treino.** Plano gerado pelo perfil (3x por semana, iniciante) e o **treino do dia** (ou descanso + próximo treino).

### O que falar sobre a arquitetura

```text
Mobile ──► API Node/Express ──► PostgreSQL
               │
               └──► Python/FastAPI ──► CLIP (modelo de visão)
```

- **Mobile:** a interface que o usuário usa.
- **API:** autenticação, regras de negócio, gravação dos dados e a ponte com a IA. É a única que o app acessa.
- **Python:** **só** analisa a imagem. Fica em rede interna, protegido por um token.
- **PostgreSQL:** guarda tudo que precisa durar (usuários, refeições, metas, treinos).
- **Core:** as regras de nutrição e treino, compartilhadas entre API e app (o mesmo cálculo nos dois lados).

---

## 🤖 Sobre a IA (para não prometer o que ela não faz)

- Roda **no processador** (CPU). Não precisa de GPU nem de internet depois do primeiro download.
- É **zero-shot**: usa o **CLIP** (`openai/clip-vit-base-patch32`), que compara a foto com descrições dos **51 alimentos da nossa tabela** ("a photo of white rice"...). Não foi treinado com fotos nossas.
- **Rejeita** fotos que não parecem comida.
- Funciona melhor com **alimentos isolados e reconhecíveis**. Em **pratos misturados** acerta só parte dos itens e às vezes inventa um item a mais.
- **Não mede gramas:** a porção vem da porção típica de cada alimento, por isso **o app sempre pede para o usuário confirmar a porção**.
- Cada análise leva **0,4–1,5 s** em um computador comum.

Resultados medidos com as fotos de `demo/fotos/`:

| Foto | Resultado obtido |
|---|---|
| `1-banana.jpg` | Banana ✔ |
| `2-batata-frita.jpg` | Batata frita ✔ + aviso de calorias ocultas |
| `3-espaguete.jpg` | Macarrão cozido ✔ (+ "cenoura", falso positivo) |
| `4-teclado.jpg` | Rejeitada ✔ (o motivo diz "um ambiente", não "teclado") |

---

## 🛠️ Se der problema

### `npm install` ou `npm run ...` dá erro de versão / `--env-file-if-exists`
Node antigo. Confira `node --version`: precisa ser **22.9+**.

### `npm run setup:ia`: "Python 3.10+ nao encontrado"
Instale o Python 3.12 (Windows: marque *Add to PATH*) e **feche e abra** o terminal.

### Banco não sobe / não conecta
- Docker aberto? `docker compose version` funciona?
- `address already in use` → siga a caixa da seção 5 (porta 5433).
- `/health` mostra `"banco":"erro"` → `docker compose ps` deve listar o `db` como `healthy`. Se não, `npm run db:up`.
- `Can't reach database server` no `db:setup` → mesma coisa: banco fora do ar ou porta errada em `apps/api/.env`.

### Prisma reclama de migration / quero começar do zero
**Isto apaga todos os dados do banco local:**
```bash
docker compose down -v
npm run db:up
npm run db:setup
```

### A API não sobe: "Configuracao invalida"
Falta o `apps/api/.env` ou alguma variável. Rode `npm run setup:env`. Se ele disser que só um dos `.env` existe, apague os dois (`apps/api/.env` e `apps/ia/.env`) e rode de novo.

### IA não responde (`"ia":"indisponivel"`)
- O terminal do `npm run dev:ia` ainda está aberto e mostrou `Uvicorn running`?
- Primeiro start: espere o download do modelo terminar (~1–2 min).
- "Ambiente Python nao encontrado" → `npm run setup:ia`.
- Porta 8000 ocupada por outro programa → feche-o (a API espera a IA em `localhost:8000`).

### A demo falha no `/scan-prato`
- `photo_empty`: a foto está vazia → `npm run demo:fotos`.
- `ai_unavailable` (HTTP 502): a IA caiu ou está carregando → veja o item anterior.
- `daily_scan_limit_reached` (HTTP 429): limite de 30 análises por usuário por dia. Cada `npm run demo` cria um usuário novo, então basta rodar de novo.

### Primeira análise demora
O primeiro start da IA baixa e carrega o modelo. Depois que ela mostrou `Uvicorn running`, cada foto leva ~1 s.

### Celular não abre o app / não acessa a API
- Mesma rede Wi-Fi? Redes de evento/faculdade costumam isolar aparelhos: use o roteador do celular.
- Está usando `localhost` no celular? Não funciona: use o **IP do computador** (seção 8).
- **Firewall** do computador bloqueando as portas **8081** (Expo) e **3333** (API):
  - Windows: aceite o aviso "Permitir acesso" do Node.js, ou libere em *Firewall do Windows → Permitir um aplicativo*.
  - Linux (Fedora): `sudo firewall-cmd --add-port=3333/tcp --add-port=8081/tcp`
- Expo Go diz que o projeto é de outra versão do SDK → atualize o Expo Go pela loja.

---

## ✅ Como saber se está tudo funcionando?

```text
[ ] PostgreSQL funcionando         → /health mostra "banco":"ok"
[ ] IA funcionando                 → http://localhost:8000/health responde
[ ] API funcionando                → http://localhost:3333/health mostra tudo "ok"
[ ] App abre no celular            → Expo Go mostra as telas
[ ] Celular enxerga a API          → http://SEU-IP:3333/health abre no navegador do celular
[ ] Cadastro funcionando           → npm run demo, etapa 2
[ ] Cálculo de meta funcionando    → npm run demo, etapa 3
[ ] Upload de foto funcionando     → npm run demo, etapas das fotos
[ ] IA reconhecendo alimento       → banana/batata/macarrão reconhecidos
[ ] Confirmação funcionando        → "usuário corrigiu para ... g"
[ ] Diário funcionando             → "Refeição salva no diário"
[ ] Resumo funcionando             → "Consumido: ... de ... kcal"
```

**Ainda não implementado** (não marque, não demonstre como pronto):

```text
[ ] ⚠️ App conectado à API (login/cadastro pelo app, foto do app indo para a IA)
```

---

## Desligar tudo

- Terminais de IA, API e app: `Ctrl + C` em cada um.
- Banco: `docker compose down` (os dados continuam salvos para a próxima vez).

---

## Para desenvolver

Testes, estrutura do código, migrations e scripts: **[docs/04-desenvolvimento.md](docs/04-desenvolvimento.md)**.
Arquitetura: [docs/01-arquitetura.md](docs/01-arquitetura.md) · Escopo do MVP: [docs/02-mvp.md](docs/02-mvp.md) · Rotas da API: [docs/03-api.md](docs/03-api.md).
