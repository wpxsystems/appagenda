# CLAUDE.md — AppAgenda

> Documento canônico do projeto. **Sempre leia primeiro.** Mantenha atualizado quando algo mudar de forma estrutural.

## O que é o AppAgenda

App **mobile nativo** (Android + iOS) para conectar jogadores de **padel, beach tennis e tênis** — descobrir jogos próximos, criar partidas, conversar em grupos, organizar disponibilidade.

**Foco do projeto:** app nativo é a entrega principal. O web tem apenas painel admin (gestão de cidades/quadras pelos operadores). **Não desenvolva features de usuário final no web.**

## Arquitetura

Monorepo Turborepo + pnpm workspaces:

| Pacote | Stack | Função |
|---|---|---|
| `apps/api` | Express + Sequelize + PostgreSQL/PostGIS, CommonJS | REST API |
| `apps/mobile` | Expo SDK 51 + React Native + Expo Router, TypeScript | App mobile (Android + iOS) |
| `apps/web` | Next.js 14 | **Somente** painel admin |
| `packages/shared` | TypeScript | Zod schemas + enums compartilhados |
| `packages/ui` | TypeScript | Tokens de design (cores, fonts) |

## Domínios (produção)

Só dois domínios estão configurados:

```
api.appagenda.wpxsystems.com.br    → REST API (Express)         ✅ no ar
appagenda.wpxsystems.com.br        → Painel admin (Next.js)      a deployar
```

**Mobile não tem domínio** — distribuído via Play Store (`com.wpxsystems.appagenda`), App Store, ou EAS dev builds. Sempre consome a API direto em `api.appagenda.wpxsystems.com.br`.

Se no futuro precisar de landing institucional, o admin pode mover pra path `/admin` no mesmo domínio (`appagenda.wpxsystems.com.br/admin`) e a raiz vira landing — sem precisar de outro subdomínio.

## Design system

Paleta + fonts em [packages/ui/src/tokens.ts](packages/ui/src/tokens.ts).

**Cores principais:**
- `cream` (#F3EFE6) — background
- `ink` (#1A1813) — texto/active
- `lime` (#CBF135) — CTAs, accent
- `coral` (#F0552E) — erros, destrutivo
- `card` (#FFF) — superfícies
- `line` (#E7E1D2) — bordas
- `sportColors.{padel|beach_tennis|tennis}` — cores por esporte

**Fonts (carregadas via `@expo-google-fonts`):**
- `BricolageGrotesque_{700Bold|800ExtraBold}` — títulos
- `Archivo_{400|500|600|700}` — corpo

**Primitivas mobile** em [apps/mobile/components/ui.tsx](apps/mobile/components/ui.tsx):
`Btn` · `Input` · `Avatar` · `Pill` · `SectionLabel` · `SegmentedPicker` · `StepDots` · `Toggle` · `Screen`

**Tab bar customizada** em [apps/mobile/components/TabBar.tsx](apps/mobile/components/TabBar.tsx) — 5 tabs com o botão "Criar" central elevado.

## Estrutura de rotas mobile

Expo Router file-based. Tudo em [apps/mobile/app/](apps/mobile/app/).

```
(auth)/                    → fluxo não autenticado
  splash.tsx               → tela inicial
  login.tsx
  cadastro.tsx             → multi-step (conta → perfil → esporte → nível)
(app)/                     → fluxo autenticado (com tab bar)
  index.tsx                → Descobrir (feed de jogos)
  meus-jogos.tsx
  criar.tsx                → criar jogo (single screen)
  comunidade.tsx           → grupos, conexões, convites
  perfil.tsx
  group/[id].tsx           → detalhe de grupo (não aparece na tab bar)
```

**Convenção de nomes:** rotas em **português** (`/comunidade`, `/perfil`, `/criar`) — não inglês.

## Como rodar (Windows)

### Pré-requisitos (instalar uma vez)

| Software | Para que | Como instalar |
|---|---|---|
| **Node.js 20+** | Runtime JS | [nodejs.org](https://nodejs.org) |
| **pnpm 10.6.0** | Package manager do monorepo | `npm install -g pnpm@10.6.0` |
| **Docker Desktop** | Postgres local pra API | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| **Android Studio** | SDK + emulador (mobile) | [developer.android.com/studio](https://developer.android.com/studio) — depois Tools → Device Manager → criar Pixel_9 com API 34+ |
| **VS Code** + extensões `Expo Tools` e `React Native Tools` | IDE | [code.visualstudio.com](https://code.visualstudio.com) |

### Variáveis de ambiente do Windows (uma vez)

Cole no PowerShell (não precisa de admin):

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

$paths = @(
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
  "$env:LOCALAPPDATA\Android\Sdk\emulator",
  "C:\Program Files\Android\Android Studio\jbr\bin"
)
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
foreach ($p in $paths) { if ($userPath -notlike "*$p*") { $userPath = "$userPath;$p" } }
[Environment]::SetEnvironmentVariable("PATH", $userPath, "User")
```

Libera a porta 8081 no firewall (PowerShell **como admin**, uma vez):

```powershell
New-NetFirewallRule -DisplayName "Expo Metro" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
```

**Importante:** depois de setar essas variáveis, **feche e reabra o VS Code inteiro** (não só o terminal) pra carregarem.

### Setup inicial do projeto

```powershell
# 1. clona e entra na pasta
git clone <repo> appagenda
cd appagenda

# 2. instala todas as dependências
pnpm install

# 3. build dos pacotes do workspace (shared + ui)
pnpm --filter "@racket-app/shared" build
pnpm --filter "@racket-app/ui" build

# 4. configura .env de cada app
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
copy apps\mobile\.env.example apps\mobile\.env
```

**Edite** `apps/api/.env`:
- Gere `JWT_SECRET` e `JWT_REFRESH_SECRET` com: `openssl rand -hex 32` (ou qualquer string longa aleatória)
- Os outros campos podem ficar com os defaults pra dev local

### Banco de dados local (Postgres + PostGIS)

```powershell
# Sobe o Postgres em Docker
docker compose -f docker-compose.dev.yml up -d postgres

# Habilita extensão PostGIS
docker exec -it appagenda-postgres-dev psql -U postgres -d appagenda -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Aplica migrations
pnpm --filter api migrate

# (opcional) popula dados iniciais (cidades de SC, etc.)
pnpm --filter api seed
```

### Portas em dev

| Serviço | Porta | URL |
|---|---|---|
| API | 3000 | http://localhost:3000 |
| Web admin (Next.js) | 3001 | http://localhost:3001 |
| Mobile (Metro / web preview) | 8081 | http://localhost:8081 |
| Postgres | 5432 | (interno) |

### Rodar tudo em paralelo (Turbo)

```powershell
pnpm dev
```

Sobe API + web + mobile Metro simultaneamente. Útil quando você está mexendo em todas as camadas.

### Rodar individualmente

**API:**
```powershell
pnpm --filter api dev
# http://localhost:3000/health → { ok: true }
```

**Web admin (Next.js):**
```powershell
pnpm --filter web dev
# http://localhost:3001/admin
```

**Mobile (emulador Android):**

```powershell
# Terminal 1 — emulador (deixa rodando em janela separada)
emulator -avd Pixel_9

# Terminal 2 — Metro + dev client
cd apps\mobile

# Primeira vez (5-15min — compila APK custom):
npx expo run:android

# A partir da 2ª vez:
npx expo start --dev-client --port 8081
# aperta `a` quando o Metro estiver pronto
```

Edita código no VS Code → Ctrl+S → atualiza no emulador em 1-2s via Fast Refresh.

**Mobile (browser preview — apenas pra ver layout, não testar dados):**

```powershell
cd apps\mobile
npx expo start --web --port 8081
# aperta `w` ou abre http://localhost:8081
```

⚠️ Limitações do preview web: sombras não renderizam (`react-native-web` deprecou a API), e o login dá CORS contra a API de produção. Pra testar de verdade, use o emulador.

### Validação rápida

```powershell
pnpm typecheck   # type-check em todos os pacotes
pnpm lint        # lint
pnpm test        # testes
```

### Gotchas conhecidas (Windows + mobile)

- **pnpm + Metro em monorepo:** [apps/mobile/metro.config.js](apps/mobile/metro.config.js) tem `watchFolders` e `nodeModulesPaths` apontando pro workspace root. **Não remover.**
- **node-linker=hoisted:** [.npmrc](.npmrc) usa `node-linker=hoisted` (Metro tem problemas com symlinks pnpm no Windows).
- **Expo Go não funciona com SDK 51** — sempre use dev client (`npx expo run:android` na primeira vez).
- **expo-router/entry** carregado via [apps/mobile/index.js](apps/mobile/index.js) local (não bare specifier) por causa de bug do HmrServer no monorepo.
- **JAVA_HOME some em terminal novo:** se o VS Code não foi fechado totalmente depois de setar a env var, abra um terminal e cole `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` antes do `npx expo run:android`.
- **Build do Gradle falha por causa do Java:** o Android Studio usa JDK 21 embedded, que serve. Se aparecer "JAVA_HOME is not set", é variável de ambiente não carregada — solução acima.
- **iOS no Windows não existe** — pra testar iOS você precisa de Mac (próprio ou na nuvem como MacInCloud) ou usar EAS Build remoto.

### Workflow do dia a dia

```
1. git pull
2. pnpm install (se package.json mudou)
3. emulator -avd Pixel_9 (em outra aba)
4. cd apps\mobile && npx expo start --dev-client --port 8081
5. aperta `a` → app abre no emulador
6. abre VS Code, edita, Ctrl+S → hot reload
```

Pra mexer também na API/admin simultaneamente:

```
6.1. (outra aba) cd apps\api && pnpm dev
6.2. (outra aba) pnpm --filter web dev
```

## API — convenções

### Field naming

A API usa **snake_case** (`nome`, `email`, `cidade_id`, `vacancies_total`). Mobile mapeia pra camelCase só no boundary do UI quando faz sentido. **Não força camelCase no payload.**

**Exemplos de payloads:**
- `POST /auth/register` → `{ nome, email, password, genero, cidade_id }`
- `POST /jogos` → `{ sport, cidade_id, scheduled_at, duration_minutes, vacancies_total, gender_type, court_reserved }`

### Rotas em português

- `/cidades` (não `/cities`)
- `/jogos` (não `/games`)
- `/me/sport-profiles`
- `/community/groups`
- `/community/favorites`
- `/community/invites`

### Autenticação

JWT Bearer no header `Authorization`. Refresh tokens rotacionados.
Rate limit: 5 logins / 15min, 3 registros / 1h, 30 refresh / 1h.

### CORS

Variável `ALLOWED_ORIGINS` (lista separada por vírgula) no `.env` da API. Em prod:
```
ALLOWED_ORIGINS=https://appagenda.wpxsystems.com.br
```

Mobile não precisa de CORS (não é browser). Pra testar web local: adicione `http://localhost:8081` temporariamente.

### RLS (Row Level Security)

Tabelas `app_user_location`, `app_notification`, `app_favorite_player` têm RLS por `user_id`. Sempre use [withUserCtx](apps/api/src/utils/withUserCtx.js):

```js
const items = await withUserCtx(req.auth.userId, (t) =>
  Model.findAll({ where: { user_id: req.auth.userId }, transaction: t })
);
```

## Banco

PostgreSQL 16 + PostGIS via Docker (dev) ou VPS (prod).

```powershell
# Local dev
docker compose -f docker-compose.dev.yml up -d postgres
docker exec -it appagenda-postgres-dev psql -U postgres -d appagenda \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
pnpm --filter api migrate
```

**Tabelas:** prefixo `app_` + singular snake_case (`app_user`, `app_jogo`, `app_cidade`).
**Migrations:** nunca editar uma migration já aplicada — crie outra que ajusta.
**Geolocalização:** PostGIS `geography(Point, 4326)`, ordem `(lng, lat)`, queries com `ST_DWithin`.

## Convenções gerais

- **Commits em inglês:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **TypeScript:** sem `any` explícito. Use unknown + narrow se precisar.
- **Componentes React:** funções, não classes. Arquivos `.tsx`.
- **Mobile screen styles:** sempre em `StyleSheet.create()` (não inline) na base do arquivo, escopo `s` curto.
- **Não criar arquivos `.md`** a menos que solicitado.
- **Não commitar:** [docs/credenciais.md](docs/credenciais.md), `apps/_api_fastify_backup/`, `.env*` (não exemplos), `.idea/`, `android/`, `.expo/`.

## Onde colocar o quê

| Mexer em… | Onde fica |
|---|---|
| Cor/font/spacing tokens | [packages/ui/src/tokens.ts](packages/ui/src/tokens.ts) |
| Botão/input/avatar primitivos | [apps/mobile/components/ui.tsx](apps/mobile/components/ui.tsx) |
| Nova tela mobile | [apps/mobile/app/(app)/](apps/mobile/app/(app)/) ou [(auth)/](apps/mobile/app/(auth)/) |
| Cliente HTTP | [apps/mobile/lib/api.ts](apps/mobile/lib/api.ts) |
| Estado de auth | [apps/mobile/lib/auth-context.tsx](apps/mobile/lib/auth-context.tsx) |
| Nova rota API | `apps/api/src/routes/` + `controllers/` + `services/` + `models/` |
| Schema compartilhado | [packages/shared/src/schemas.ts](packages/shared/src/schemas.ts) |
| Migration de banco | `apps/api/src/migrations/` |
| Admin page | `apps/web/app/admin/` |

## Fluxo de PR

1. Branch a partir de `main`: `feat/x`, `fix/x`, `refactor/x`
2. Pre-PR local: `pnpm typecheck` + `pnpm test`
3. PR pra `main`
4. CI roda em `.github/workflows/ci.yml`: install → typecheck → lint → test
5. Merge só com CI verde

## Build & Deploy

### Mobile (EAS Build)

EAS Build compila o app na nuvem (sem precisar de Mac para iOS, sem precisar de Android Studio para Android). Configuração em [apps/mobile/eas.json](apps/mobile/eas.json) com 3 profiles:

| Profile | Para que | Output |
|---|---|---|
| `development` | Dev client com hot reload | APK + simulator app |
| `preview` | Build interno pra testar (TestFlight beta, APK direct) | APK + IPA |
| `production` | Submit pra Play Store / App Store | AAB + IPA |

**Setup uma vez:**

```powershell
npm install -g eas-cli
eas login                              # cria/loga conta Expo (gratuita)
cd apps\mobile
eas init                               # gera projectId e atualiza app.json
```

**Builds:**

```powershell
cd apps\mobile

# APK pra você testar (instala direto no celular Android)
pnpm build:android:preview

# IPA pra TestFlight (precisa Apple Developer ~$99/ano)
pnpm build:ios:preview

# Submit pras lojas (uma vez configurado eas.json submit)
eas submit --platform android
eas submit --platform ios
```

Cada build leva 10-20min na nuvem. Quando termina, EAS te manda link de download.

### Admin web (Docker + Traefik)

Dockerfile em [apps/web/Dockerfile](apps/web/Dockerfile) — Next.js 14 standalone output. Compose service `appagenda-web` em [docs/deploy.md](docs/deploy.md#7-subir-o-projeto-primeira-vez) já configurado pra rodar em `appagenda.wpxsystems.com.br` via Traefik.

Deploy:

```bash
# Na VPS
cd /opt/systems/apps/appagenda
git pull
docker compose build appagenda-web
docker compose up -d appagenda-web
```

API não precisa rebuild — só o admin web sobe.

## Onde achar mais detalhe

- [SPEC.md](SPEC.md) — especificação completa de produto/features
- [docs/architecture.md](docs/architecture.md) — arquitetura técnica detalhada
- [docs/security.md](docs/security.md) — auth, RLS, rate limit, headers
- [docs/deploy.md](docs/deploy.md) — deploy VPS (Traefik + Docker)
- [docs/compliance-lgpd.md](docs/compliance-lgpd.md) — LGPD
- [docs/README.md](docs/README.md) — índice do docs/

## Escopo Fase 1

✅ Cadastro/login, perfil esportivo, disponibilidade
✅ Descobrir/criar/entrar em jogos
✅ Grupos + chat + convites
❌ **Não** implementar: pagamentos, campeonatos, modo Professor (só placeholder), notificações push (registrar push_token é OK; envio fica pra Fase 2)
