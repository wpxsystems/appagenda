# ───────────────────────────────────────────────────────────
# Stage 1: Builder — instala deps da API (standalone)
# ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Toolchain pra módulos nativos (bcrypt)
RUN apk add --no-cache python3 make g++

# Copia apenas manifests da API
COPY package.json ./

# Install — usa npm pra evitar lockfile podre do monorepo
RUN npm install --omit=optional --no-audit --no-fund

# Copia código
COPY src ./src
COPY .sequelizerc* ./

# ───────────────────────────────────────────────────────────
# Stage 2: Runtime
# ───────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini curl \
 && addgroup -g 1001 app \
 && adduser -D -u 1001 -G app app

COPY --from=builder --chown=app:app /app /app

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -fs http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
