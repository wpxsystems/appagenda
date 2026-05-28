# CLAUDE.md — AppAgenda

## Comandos essenciais

```bash
pnpm install
pnpm dev                               # tudo em paralelo
pnpm --filter api dev                  # só API (porta 3000)
pnpm --filter mobile start             # Expo Dev Tools
pnpm --filter web dev                  # Web admin (porta 5173)
pnpm --filter api migrate              # rodar migrations
pnpm --filter api seed                 # popular dados iniciais
pnpm --filter mobile build:android     # EAS build Android
pnpm --filter mobile build:ios         # EAS build iOS
pnpm test                              # testes em todos os pacotes
pnpm lint
pnpm typecheck
```

## Arquitetura

Monorepo Turborepo com pnpm workspaces:
- `apps/api`         — Express + Sequelize + PostgreSQL/PostGIS (CommonJS)
- `apps/mobile`      — Expo + React Native
- `apps/web`         — Next.js 14 (painel admin)
- `packages/shared`  — Zod schemas + tipos + enums compartilhados
- `packages/ui`      — componentes reutilizáveis (.native.tsx + .web.tsx)

## Regras

**Padrão MVC:** toda rota → routes → middleware → controller (Zod) → service → model. Ver `docs/architecture.md`.

**Tipos:** sempre usar os enums de `packages/shared/src/enums.ts`. Nunca strings literais de esporte, nível ou status.

**Banco:** schema em `apps/api/src/models/` + migrations em `apps/api/src/migrations/`. Nunca editar migration já aplicada. Usar `pnpm --filter api migrate` para aplicar.

**Validação:** schemas Zod em `packages/shared/src/schemas.ts` reusados na API (controllers) + mobile + web.

**Geolocalização:** PostGIS com `geography(Point, 4326)`. Ordem `(lng, lat)`. Queries espaciais usam `ST_DWithin`. Ver `docs/architecture.md`.

**Auth:** middleware `auth` em toda rota autenticada. `requireRole('admin')` para rotas de admin. Ver `docs/security.md`.

**Notificações push:** Expo Push API via `pushService`. Sempre registrar em `app_push_notification_log`. Nunca enviar para usuário com `notifications_enabled = false`.

**Design:** seguir `docs/prototipo-app-raquete.html`. Fontes: Bricolage Grotesque (títulos) + Archivo (texto). Tokens em `packages/ui/src/tokens.ts`.

**Fase 1 escopo:** modo Professor existe na navegação mas redireciona para "em breve". Não implementar pagamentos ou campeonatos.

## Convenções

- API: CommonJS (padrão WPX); mobile/shared: TypeScript
- Sem `any` explícito no TypeScript
- Tabelas: `app_<singular_snake>` (`app_user`, `app_jogo`, `app_cidade`)
- Rotas API: kebab-case plural (`/jogos`, `/sport-profiles`, `/cidades`)
- Commits em inglês: `feat:`, `fix:`, `chore:`, `docs:`
- Componentes React: `.tsx`; funções, não classes

## Banco de dados local

PostgreSQL 16 + PostGIS via Docker:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
docker exec -it appagenda-postgres-dev psql -U postgres -d appagenda \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
pnpm --filter api migrate
```

## Variáveis de ambiente (apps/api/.env)

Copiar de `apps/api/.env.example` e preencher:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ALLOWED_ORIGINS`

## CI

GitHub Actions em `.github/workflows/ci.yml` roda em todo PR:
1. `pnpm install`
2. `pnpm turbo typecheck`
3. `pnpm turbo lint`
4. `pnpm turbo test`

PR só pode ser mergeado com CI verde.
