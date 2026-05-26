# CLAUDE.md — App de Esportes de Raquete

## Comandos essenciais

```bash
# Instalar dependências (root)
pnpm install

# Build de todos os pacotes
pnpm turbo build

# Dev (todos os apps em paralelo)
pnpm turbo dev

# Dev individual
pnpm --filter api dev
pnpm --filter mobile start
pnpm --filter web dev

# Testes
pnpm turbo test

# Type-check
pnpm turbo typecheck

# Lint
pnpm turbo lint

# Migrations (Drizzle)
pnpm --filter db generate   # gera migration a partir do schema
pnpm --filter db migrate    # aplica migrations no banco
pnpm --filter db seed       # popula dados iniciais (cidades, venues de Joinville)

# Build mobile (Expo)
pnpm --filter mobile build:android
pnpm --filter mobile build:ios
```

## Arquitetura

Monorepo Turborepo com pnpm workspaces:
- `apps/api` — Fastify + Drizzle + PostGIS
- `apps/mobile` — Expo + React Native
- `apps/web` — Next.js 14 (App Router)
- `packages/db` — schema Drizzle + migrations (fonte da verdade do banco)
- `packages/shared` — tipos TypeScript + schemas Zod compartilhados
- `packages/ui` — componentes React (`.native.tsx` e `.web.tsx` para platform files)

## Regras do projeto

**Tipos:** sempre usar os enums de `packages/shared/src/enums.ts`. Nunca usar strings literais de esporte, nível ou status.

**Banco:** toda mudança de schema vai em `packages/db/src/schema.ts` + nova migration gerada com `pnpm --filter db generate`. Nunca editar migrations já aplicadas.

**Validação:** schemas Zod em `packages/shared/src/schemas.ts` são reutilizados na API (input validation) e no mobile/web (form validation). Não duplicar validações.

**Geolocalização:** queries espaciais usam `geography(Point,4326)` e a extensão PostGIS. Nunca filtrar por cidade via string; usar `city_id` ou `ST_DWithin` para raio.

**Auth:** toda rota autenticada usa o hook `fastify.authenticate` (verifica JWT). Rotas admin verificam `req.user.role === 'admin'`.

**Notificações push:** o envio usa a Expo Push API. Sempre registrar em `push_notifications_log`. Nunca enviar para usuário com `notifications_enabled = false`.

**Design:** seguir fielmente o protótipo `docs/prototipo-app-raquete.html`. Fontes: Bricolage Grotesque (títulos) + Archivo (texto). Tokens de design em `packages/ui/src/tokens.ts`.

**Fase 1 escopo:** modo Professor existe na navegação mas redireciona para "em breve". Não implementar agendamento de aulas, pagamentos ou campeonatos.

## Convenções de código

- Arquivos TypeScript; sem `any` explícito
- Componentes React: `.tsx`; funções, não classes
- API: handlers em `apps/api/src/routes/`; serviços (lógica de negócio) em `apps/api/src/services/`
- Nomes de tabelas: snake_case plural (`game_participants`)
- Nomes de rotas API: kebab-case plural (`/sport-profiles`)
- Commits: `feat:`, `fix:`, `chore:`, `docs:` — mensagem em inglês

## Banco de dados local

Requer PostgreSQL 16 + PostGIS. Criar banco e habilitar extensão:
```sql
CREATE DATABASE racket_app_dev;
\c racket_app_dev
CREATE EXTENSION postgis;
```

## CI

GitHub Actions em `.github/workflows/ci.yml` roda em todo PR:
1. `pnpm install`
2. `pnpm turbo typecheck`
3. `pnpm turbo lint`
4. `pnpm turbo test`

PR só pode ser mergeado com CI verde.
