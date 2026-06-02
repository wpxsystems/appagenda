# AppAgenda — Documentação Técnica

> App social de esportes de raquete (tênis, padel, beach tennis) — disponível na Play Store e App Store + painel web administrativo.
> Operado pela **WPX Systems Tecnologia**.

---

## Índice de documentos

| Documento                                | Ler quando                                                      |
| ---------------------------------------- | --------------------------------------------------------------- |
| [architecture.md](architecture.md)       | Nova rota, controller, service, model ou tela mobile/web        |
| [security.md](security.md)               | Autenticação, autorização, dados sensíveis, segurança mobile |
| [compliance-lgpd.md](compliance-lgpd.md) | Dados pessoais, geolocalização, fotos, retenção, direitos      |
| [credenciais.md](credenciais.md)         | Credenciais do projeto (servidor, banco, stores, push)          |
| [deploy.md](deploy.md)                   | Subir para produção, CI/CD, releases nas stores                |

---

## Visão geral

| Camada       | Tecnologia                                                                                |
| ------------ | ----------------------------------------------------------------------------------------- |
| **Mobile**   | Expo SDK 51 + React Native + TypeScript + Expo Router + design tokens em `packages/ui`    |
| **Web admin**| Next.js 14 (App Router) + TypeScript — somente painel administrativo                       |
| **API**      | Node.js 20 + Express + Sequelize + TypeScript                                             |
| **Banco**    | PostgreSQL 16 + PostGIS (extensão de geolocalização)                                     |
| **Validação**| Zod (compartilhado entre mobile, web e API)                                              |
| **Auth**     | JWT 15min + refresh token rotativo 30 dias (SecureStore no mobile, httpOnly cookie na web)|
| **Push**     | Expo Push API                                                                             |
| **Deploy**   | Docker + Traefik (HTTPS Let's Encrypt) na VPS Hostinger                                   |
| **Build mobile** | EAS Build (Expo) — distribuição via TestFlight e Play Console                         |

> **Por que esse stack?** A API segue o padrão Express + Sequelize de todos os outros projetos WPX (Estoq, Santorini, Sanches) — mesma infra Docker, mesmos docs de segurança e LGPD, mesmo CI/CD. Mobile usa Expo + React Native StyleSheet com design tokens próprios (paleta cream/lime/ink + fontes Bricolage/Archivo).
>
> **O foco do projeto é o app mobile nativo.** O web existe apenas como painel admin (gestão de cidades, quadras). Não desenvolva features de usuário final no web.

---

## Estrutura do monorepo

```
appagenda/
├── apps/
│   ├── api/                       # Express + Sequelize
│   │   └── src/
│   │       ├── controllers/       # Validação Zod + resposta HTTP
│   │       ├── services/          # Regras de negócio + transações
│   │       ├── models/            # Sequelize ORM
│   │       ├── routes/            # URL → controller + middlewares
│   │       ├── middlewares/       # auth, tenantContext, rateLimit, audit
│   │       ├── migrations/        # Versionamento do schema
│   │       ├── seeders/           # Dados iniciais (cidades, esportes)
│   │       ├── utils/             # AppError, asyncHandler, push, geo
│   │       └── server.js
│   ├── mobile/                    # Expo SDK 51 + React Native + Expo Router
│   │   ├── app/                   # File-based routing (Expo Router)
│   │   │   ├── (auth)/            # splash, login, cadastro
│   │   │   ├── (app)/             # index (descobrir), meus-jogos, criar, comunidade, perfil
│   │   │   └── _layout.tsx        # Root layout + font loading
│   │   ├── components/            # ui.tsx (primitivas) + TabBar.tsx
│   │   ├── lib/                   # api.ts, auth-context.tsx
│   │   └── assets/
│   └── web/                       # Next.js 14 (App Router) — somente painel admin
│       └── app/
│           ├── admin/             # /admin/cities, /admin/venues
│           ├── layout.tsx
│           └── page.tsx
├── packages/
│   └── shared/                    # Zod schemas + tipos + enums
│       └── src/
│           ├── enums.ts           # SportType, GameStatus, SkillLevel...
│           └── schemas.ts         # Schemas Zod compartilhados
├── docs/                          # Esta documentação
├── docker-compose.dev.yml
├── package.json
└── pnpm-workspace.yaml
```

---

## Setup local

### Pré-requisitos

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- Expo Go (celular) para dev rápido OU EAS CLI (`pnpm dlx eas-cli`) para builds nativos

### Passos

```bash
# 1. Instalar dependências do monorepo
pnpm install

# 2. Subir banco local (PostgreSQL 16 + PostGIS)
docker compose -f docker-compose.dev.yml up -d postgres

# 3. Habilitar extensão PostGIS
docker exec -it appagenda-postgres-dev psql -U postgres -d appagenda \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis;'

# 4. Variáveis de ambiente (copiar e preencher)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env

# 5. Migrations + seeds
pnpm --filter api migrate
pnpm --filter api seed

# 6. Rodar tudo em paralelo
pnpm dev

# OU individualmente:
pnpm --filter api dev      # http://localhost:3000
pnpm --filter web dev      # http://localhost:5173
pnpm --filter mobile start # abre Expo Dev Tools
```

### Validação rápida

```bash
curl http://localhost:3000/health   # API saudável?
pnpm typecheck                       # Type-check em tudo
pnpm lint                            # Lint
pnpm test                            # Testes
```

---

## Variáveis de ambiente obrigatórias (produção)

### `apps/api/.env`

```env
NODE_ENV=production
PORT=3000
APP_URL=https://api.appagenda.wpxsystems.com.br
ALLOWED_ORIGINS=https://appagenda.wpxsystems.com.br

# Banco — dentro da rede Docker wpxnet
DB_HOST=postgres
DB_PORT=5432
DB_NAME=appagenda
DB_USER=appagenda_app
DB_PASSWORD=<gerar com openssl rand -base64 32>
DB_SSL=false

# JWT — gerar cada um com: openssl rand -hex 32
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d
BCRYPT_SALT_ROUNDS=12

# Push notifications (Expo)
EXPO_ACCESS_TOKEN=

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=willian.felipe160@gmail.com
SMTP_PASSWORD=
SMTP_FROM=AppAgenda <noreply@wpxsystems.com.br>

# Storage de uploads (Cloudflare R2 ou similar)
R2_ENDPOINT=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=appagenda-uploads
```

### `apps/mobile/.env` (build time — Expo)

```env
EXPO_PUBLIC_API_URL=https://api.appagenda.wpxsystems.com.br/api/v1
EXPO_PUBLIC_SENTRY_DSN=
```

### `apps/web/.env`

```env
NEXT_PUBLIC_API_URL=https://api.appagenda.wpxsystems.com.br/api/v1
```

> **Atenção:** `JWT_SECRET` e `JWT_REFRESH_SECRET` nunca podem mudar entre restarts. Se mudarem, todas as sessões ativas são invalidadas — usuários precisam fazer login de novo (ruim no mobile, péssimo na review da App Store).

---

## Papéis PostgreSQL

| Role              | Permissão                                                                  | Uso                              |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------- |
| `appagenda_app`   | SELECT, INSERT, UPDATE, DELETE em tabelas `app_*`; sem SUPERUSER, sem BYPASSRLS | Pool de conexão da API          |
| `appagenda_auth`  | BYPASSRLS apenas em `app_user` e `app_refresh_token`                       | Login e refresh cross-tenant     |
| `wpxadmin`        | Dono do banco — superuser                                                 | Migrations, manutenção, backups |

---

## Git — regras do projeto

- `pnpm install` + `git pull` antes de começar qualquer tarefa
- Branches: `main` (produção), `develop` (integração), `feat/...`, `fix/...`
- Commits em inglês — [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- **Nunca editar migrations já aplicadas** — criar nova migration com timestamp
- Toda nova feature passa por PR — proibido push direto na `main`

---

## Checklist antes de subir para produção

- [ ] `pnpm typecheck` passa em todos os pacotes
- [ ] `pnpm lint` sem warnings novos
- [ ] `pnpm test` verde
- [ ] Migrations aplicadas em produção (ver [deploy.md](deploy.md))
- [ ] Variáveis de ambiente conferidas (especialmente JWT_SECRET, EXPO_ACCESS_TOKEN)
- [ ] Nenhum `console.log` de debug no código
- [ ] Nenhum `.env` commitado
- [ ] RLS habilitado em toda tabela nova com `tenant_id`/`user_id`
- [ ] Endpoints novos testados com usuário sem permissão (deve receber 403)
- [ ] Dados pessoais novos documentados em [compliance-lgpd.md](compliance-lgpd.md)
- [ ] Build mobile testado em device real (iOS + Android) via EAS Build dev client
- [ ] Versão do `app.json`/`app.config.ts` incrementada (versionCode Android, buildNumber iOS)
