# ───────────────────────────────────────────────────────────
# Stage 1: Builder — instala deps do monorepo + builda Next.js
# ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /repo

# pnpm via corepack (já vem com node 20)
RUN corepack enable && corepack prepare pnpm@10.6.0 --activate

# Copia manifests do monorepo (cache de instalação)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

# Instala TODAS as deps do workspace (pra resolver shared/ui)
RUN pnpm install --frozen-lockfile=false

# Copia código
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

# Builda os pacotes do workspace (gera dist/)
RUN pnpm --filter "@racket-app/shared" build && \
    pnpm --filter "@racket-app/ui" build

# Builda Next.js (output: standalone)
WORKDIR /repo/apps/web
RUN pnpm next build

# ───────────────────────────────────────────────────────────
# Stage 2: Runtime — image mínima com só o standalone
# ───────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini curl \
 && addgroup -g 1001 app \
 && adduser -D -u 1001 -G app app

# Next.js standalone copia tudo que precisa pra rodar
COPY --from=builder --chown=app:app /repo/apps/web/.next/standalone /app
COPY --from=builder --chown=app:app /repo/apps/web/.next/static /app/apps/web/.next/static
COPY --from=builder --chown=app:app /repo/apps/web/public /app/apps/web/public

USER app
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD curl -fs http://127.0.0.1:3001/admin || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
