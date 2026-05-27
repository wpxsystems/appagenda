# Plano de Migração — Fastify+Drizzle → Express+Sequelize

> **Objetivo:** alinhar `apps/api` ao padrão WPX (Express + Sequelize + PostgreSQL) sem perder o trabalho já feito nos schemas, enums, validações Zod e mobile.
> **Premissa:** o app ainda **não tem usuários reais em produção** — é seguro fazer cutover sem rolling deploy.
> **Branch:** trabalhar tudo em `refactor/express-sequelize` até bater verde; só então merge para `main`.

---

## 1. ESTRATÉGIA EM UMA FRASE

> Mantém **`packages/shared`** (Zod + enums + tipos) e **`apps/mobile`** intactos.
> Reescreve **`apps/api`** do zero em Express + Sequelize.
> Remove **`packages/db`** (Drizzle) — fica obsoleto.
> **`apps/web`** (Next.js) decide separado (ver seção 9).

---

## 2. O QUE MANTER, O QUE REESCREVER, O QUE REMOVER

| Pasta / Arquivo                                  | Decisão        | Motivo                                                            |
| ------------------------------------------------ | --------------- | ----------------------------------------------------------------- |
| `apps/mobile/`                                   | ✅ MANTER       | Expo + RN é o stack correto                                       |
| `apps/web/`                                      | ⚠️ DECIDIR      | Next.js funciona; migrar pra Vite é outro projeto (seção 9)       |
| `apps/api/`                                      | 🔄 REESCREVER   | Fastify → Express                                                 |
| `packages/shared/`                               | ✅ MANTER       | Zod schemas, enums, tipos — 100% reaproveitados                  |
| `packages/db/` (Drizzle schema + migrations)     | ❌ REMOVER      | Vira Sequelize models + migrations dentro de `apps/api/src/`     |
| `packages/ui/`                                   | ✅ MANTER       | Componentes RN/web são agnósticos do backend                      |
| `pnpm-workspace.yaml`, `turbo.json`              | ✅ MANTER       | Monorepo + task runner agnósticos                                 |
| `tsconfig.base.json`                             | ✅ MANTER       | TypeScript continua                                               |
| `CLAUDE.md`                                      | 🔄 REESCREVER   | Refletir o novo stack (ver seção 10)                              |
| `plano-desenvolvimento-app-raquete.md`           | ✅ MANTER       | Plano de produto não muda com troca de stack                      |
| `SPEC.md`                                        | ✅ MANTER       | Mesma razão                                                       |

---

## 3. CHECKLIST PRÉ-MIGRAÇÃO

Antes de tocar em qualquer código:

- [ ] Branch criada: `git checkout -b refactor/express-sequelize`
- [ ] Push da branch para o GitHub (backup remoto)
- [ ] Banco `appagenda` **vazio** ou apenas com migrations do Drizzle (sem dados de usuário reais)
- [ ] Se o Drizzle já criou tabelas: **dropar tudo** antes de começar (passo abaixo)
- [ ] Snapshot do `packages/db/src/schema.ts` aberto pra referência — vai ser a fonte da verdade das entidades
- [ ] Lista de rotas atuais do Fastify documentada (passo 4)

### 3.1 Dropar o schema do Drizzle (se existir)

```bash
# Listar tabelas que o Drizzle criou
docker exec -it postgres psql -U wpxadmin -d appagenda -c '\dt'

# Dropar tudo (NÃO dropa o banco, só as tabelas)
docker exec -it postgres psql -U wpxadmin -d appagenda <<'EOF'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO wpxadmin;
GRANT ALL ON SCHEMA public TO appagenda_app;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";
EOF

# Confirmar limpeza
docker exec -it postgres psql -U wpxadmin -d appagenda -c '\dt'
# Deve retornar: Did not find any relations.
```

> Reaplicar `GRANT ALL` para `appagenda_app` porque `DROP SCHEMA CASCADE` revoga permissões.

---

## 4. FASE 1 — INVENTÁRIO DO QUE EXISTE

### 4.1 Listar rotas Fastify atuais

```bash
cd apps/api
grep -r "fastify\.\(get\|post\|put\|delete\|patch\)" src/ > /tmp/rotas-atuais.txt
# OU
grep -r "\.route(" src/ > /tmp/rotas-atuais.txt
```

Anotar em uma planilha simples:

| Método | URL                  | Handler atual              | Migrado? |
| ------ | -------------------- | -------------------------- | -------- |
| POST   | `/auth/register`     | `routes/auth.ts:register`  | [ ]      |
| POST   | `/auth/login`        | `routes/auth.ts:login`     | [ ]      |
| POST   | `/auth/refresh`      | `routes/auth.ts:refresh`   | [ ]      |
| GET    | `/me`                | `routes/me.ts:get`         | [ ]      |
| GET    | `/games`             | `routes/games.ts:list`     | [ ]      |
| ...    | ...                  | ...                        | [ ]      |

### 4.2 Listar entidades do Drizzle

Abrir `packages/db/src/schema.ts` e listar as tabelas. Para cada uma, anotar:

- Nome da tabela (geralmente plural snake_case — vamos converter para `app_` + singular)
- Campos + tipos
- FKs
- Índices
- Constraints únicas
- Se usa PostGIS (`geography`)

Exemplo:

| Drizzle (atual)   | Sequelize (novo) | Tem geo? | RLS? |
| ----------------- | ---------------- | -------- | ---- |
| `users`           | `app_user`       | não     | sim  |
| `sport_profiles`  | `app_sport_profile` | não  | sim  |
| `venues`          | `app_venue`      | sim (`localizacao`) | sim |
| `games`           | `app_jogo`       | não     | sim  |
| `participants`    | `app_participacao` | não   | sim  |
| `friendships`     | `app_friendship` | não     | sim  |
| `cities`          | `app_cidade`     | sim (centro) | não (dado público) |
| `push_logs`       | `app_push_notification_log` | não | sim |

> **Padronização de nomes:** todas as tabelas vão pra `app_<singular_snake>` para bater com o padrão WPX (`app_user`, `app_jogo`, etc.).

---

## 5. FASE 2 — ESQUELETO EXPRESS

### 5.1 Limpar `apps/api/` e recriar

```bash
cd /opt/systems/apps/appagenda    # ou local de dev

# Backup do antigo (não dropa)
mv apps/api apps/_api_fastify_backup

# Criar estrutura nova
mkdir -p apps/api/src/{controllers,services,models,routes,middlewares,migrations,seeders,utils,jobs,config}
mkdir -p apps/api/tests
```

### 5.2 `apps/api/package.json`

```json
{
  "name": "@appagenda/api",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "migrate": "sequelize-cli db:migrate",
    "migrate:undo": "sequelize-cli db:migrate:undo",
    "seed": "sequelize-cli db:seed:all",
    "lint": "eslint src/",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.21.0",
    "sequelize": "^6.37.0",
    "sequelize-cli": "^6.6.0",
    "pg": "^8.13.0",
    "pg-hstore": "^2.3.4",
    "zod": "^3.23.8",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "helmet": "^8.0.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.4.0",
    "cookie-parser": "^1.4.7",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0",
    "sanitize-html": "^2.13.1",
    "sharp": "^0.33.5",
    "expo-server-sdk": "^3.10.0",
    "@aws-sdk/client-s3": "^3.670.0",
    "node-cron": "^3.0.3",
    "google-auth-library": "^9.14.2",
    "apple-signin-auth": "^1.7.6",
    "nodemailer": "^6.9.16",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.7",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "eslint": "^9.13.0"
  }
}
```

```bash
cd apps/api && pnpm install
```

### 5.3 Arquivos base (criar nesta ordem)

#### `src/config/database.js`

```js
require('dotenv').config();

const common = {
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: { underscored: true, timestamps: true, paranoid: true },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

module.exports = {
  development: common,
  test: { ...common, database: `${process.env.DB_NAME}_test` },
  production: common,
};
```

#### `.sequelizerc` (na raiz do `apps/api/`)

```js
const path = require('path');
module.exports = {
  config:        path.resolve('src/config/database.js'),
  'models-path': path.resolve('src/models'),
  'migrations-path': path.resolve('src/migrations'),
  'seeders-path':    path.resolve('src/seeders'),
};
```

#### `src/utils/AppError.js`

```js
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
module.exports = AppError;
```

#### `src/utils/asyncHandler.js`

```js
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

#### `src/middlewares/errorHandler.js`

```js
const { ZodError } = require('zod');
const logger = require('../utils/logger');

module.exports = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: 'Validation error', details: err.errors });
  }
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
  logger.error({ err, req: { url: req.url, method: req.method } }, 'Unhandled error');
  return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
};
```

#### `src/middlewares/auth.js`

```js
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

module.exports = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError('Token ausente', 401));

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (decoded.typ !== 'access') return next(new AppError('Tipo de token inválido', 401));
    req.auth = { userId: decoded.sub, tenantId: decoded.tid, role: decoded.role, email: decoded.email };
    next();
  } catch {
    next(new AppError('Token inválido ou expirado', 401));
  }
};
```

#### `src/middlewares/tenantContext.js`

```js
const { sequelize } = require('../models');
const AppError = require('../utils/AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res, next) => {
  const tenantId = req.auth?.tenantId;
  if (!UUID_RE.test(tenantId)) return next(new AppError('Tenant inválido', 401));

  const t = await sequelize.transaction();
  try {
    await sequelize.query(`SET LOCAL app.current_tenant = '${tenantId}'`, { transaction: t });
    req.tx = t;
    res.on('finish', async () => {
      try { res.statusCode < 400 ? await t.commit() : await t.rollback(); } catch {}
    });
    next();
  } catch (err) { await t.rollback(); next(err); }
};
```

#### `src/middlewares/requireRole.js`

```js
const AppError = require('../utils/AppError');
module.exports = (...roles) => (req, _res, next) =>
  roles.includes(req.auth?.role) ? next() : next(new AppError('Acesso negado', 403));
```

#### `src/utils/logger.js`

```js
const pino = require('pino');
module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.body.password', 'req.body.token', '*.password', '*.token_hash'],
});
```

#### `src/server.js`

```js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');
const { sequelize } = require('./models');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use(rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_GENERAL) || 100 }));

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/v1', routes);

app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
sequelize.authenticate()
  .then(() => app.listen(port, () => logger.info(`API on :${port}`)))
  .catch((err) => { logger.fatal({ err }, 'DB connection failed'); process.exit(1); });

process.on('unhandledRejection', (err) => { logger.fatal({ err }, 'unhandledRejection'); process.exit(1); });
process.on('uncaughtException',  (err) => { logger.fatal({ err }, 'uncaughtException'); process.exit(1); });
```

#### `src/routes/index.js` (esqueleto vazio inicial)

```js
const router = require('express').Router();
// router.use('/auth', require('./auth.routes'));
// router.use('/me',   require('./me.routes'));
// router.use('/jogos', require('./jogo.routes'));
module.exports = router;
```

### 5.4 Validar o esqueleto

```bash
cd apps/api
pnpm dev
# Deve subir, conectar no banco e responder GET /health com { ok: true }
```

---

## 6. FASE 3 — RECRIAR SCHEMA EM SEQUELIZE

Para cada tabela do inventário (seção 4.2), criar **1 migration + 1 model**.

### 6.1 Ordem das migrations (FKs importam)

```
1. 20260601100000-create-tenant.js          (raiz multi-tenant)
2. 20260601100100-create-cidade.js          (sem dep)
3. 20260601100200-create-user.js            (FK → tenant, cidade)
4. 20260601100300-create-refresh-token.js   (FK → user)
5. 20260601100400-create-oauth-account.js   (FK → user)
6. 20260601100500-create-sport-profile.js   (FK → user)
7. 20260601100600-create-venue.js           (FK → cidade — usa PostGIS)
8. 20260601100700-create-jogo.js            (FK → tenant, venue, user)
9. 20260601100800-create-participacao.js    (FK → jogo, user)
10. 20260601100900-create-friendship.js      (FK → user x2)
11. 20260601101000-create-message.js         (FK → user x2) [se houver chat]
12. 20260601101100-create-push-log.js        (FK → user)
13. 20260601101200-create-audit-log.js
14. 20260601101300-create-report.js          (denúncias entre usuários)
```

### 6.2 Template para gerar uma migration

```bash
cd apps/api
npx sequelize-cli migration:generate --name create-user
```

Editar o arquivo gerado seguindo o padrão de [architecture.md → seção 4](architecture.md). Pontos críticos:

- Toda tabela multi-tenant: incluir `tenant_id` UUID NOT NULL
- Toda tabela: `created_at`, `updated_at`, `deleted_at`
- RLS + política ao final da migration
- Índices: `tenant_id` + colunas usadas em WHERE/ORDER BY

### 6.3 Exemplo completo — `app_user`

```js
// migrations/20260601100200-create-user.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_user', {
      id:               { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      tenant_id:        { type: Sequelize.UUID, allowNull: false },
      nome:             { type: Sequelize.STRING(120), allowNull: false },
      nickname:         { type: Sequelize.STRING(60), allowNull: false, unique: true },
      email:            { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash:    { type: Sequelize.STRING(72) },
      phone:            { type: Sequelize.STRING(20) },
      data_nascimento:  { type: Sequelize.DATEONLY },
      avatar_url:       { type: Sequelize.STRING(500) },
      bio:              { type: Sequelize.TEXT },
      cidade_id:        { type: Sequelize.UUID },
      role:             { type: Sequelize.ENUM('user','professor','venue_admin','admin','superadmin'), defaultValue: 'user' },
      status:           { type: Sequelize.ENUM('active','suspended','banned'), defaultValue: 'active' },
      push_token:       { type: Sequelize.STRING(255) },
      notifications_enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at:       { type: Sequelize.DATE, allowNull: false },
      updated_at:       { type: Sequelize.DATE, allowNull: false },
      deleted_at:       { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_user', ['tenant_id']);
    await queryInterface.addIndex('app_user', ['cidade_id']);
    await queryInterface.addIndex('app_user', { fields: ['email'], unique: true, where: { deleted_at: null } });
    await queryInterface.addIndex('app_user', { fields: ['nickname'], unique: true, where: { deleted_at: null } });

    await queryInterface.sequelize.query(`
      ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
      ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON app_user
        USING      (tenant_id::text = current_setting('app.current_tenant', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
    `);

    // Permitir que appagenda_auth ignore RLS aqui (login cross-tenant)
    await queryInterface.sequelize.query(`
      GRANT SELECT ON app_user TO appagenda_auth;
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP POLICY IF EXISTS tenant_isolation ON app_user');
    await queryInterface.dropTable('app_user');
  },
};
```

### 6.4 Exemplo — `app_venue` (com PostGIS)

```js
// migrations/20260601100600-create-venue.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_venue', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      tenant_id:   { type: Sequelize.UUID, allowNull: false },
      nome:        { type: Sequelize.STRING(120), allowNull: false },
      endereco:    { type: Sequelize.STRING(255), allowNull: false },
      cidade_id:   { type: Sequelize.UUID, allowNull: false },
      telefone:    { type: Sequelize.STRING(20) },
      foto_url:    { type: Sequelize.STRING(500) },
      esportes:    { type: Sequelize.ARRAY(Sequelize.STRING), defaultValue: [] },
      created_at:  { type: Sequelize.DATE, allowNull: false },
      updated_at:  { type: Sequelize.DATE, allowNull: false },
      deleted_at:  { type: Sequelize.DATE },
    });

    // Coluna PostGIS — DEPOIS do createTable, porque Sequelize não conhece geography
    await queryInterface.sequelize.query(`
      ALTER TABLE app_venue ADD COLUMN localizacao geography(Point, 4326);
      CREATE INDEX idx_venue_localizacao ON app_venue USING GIST (localizacao);
    `);

    await queryInterface.addIndex('app_venue', ['tenant_id']);
    await queryInterface.addIndex('app_venue', ['cidade_id']);

    await queryInterface.sequelize.query(`
      ALTER TABLE app_venue ENABLE ROW LEVEL SECURITY;
      ALTER TABLE app_venue FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON app_venue
        USING      (tenant_id::text = current_setting('app.current_tenant', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP POLICY IF EXISTS tenant_isolation ON app_venue');
    await queryInterface.dropTable('app_venue');
  },
};
```

### 6.5 Rodar todas as migrations

```bash
cd apps/api
pnpm migrate

# Validar
docker exec -it postgres psql -U wpxadmin -d appagenda -c '\dt'
docker exec -it postgres psql -U wpxadmin -d appagenda -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

Esperado: ver todas as `app_*` tabelas + `SequelizeMeta` (controle de migrations).

### 6.6 Models Sequelize (`src/models/`)

#### `src/models/index.js`

```js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config);
const db = { sequelize, Sequelize };

fs.readdirSync(__dirname)
  .filter((f) => f !== 'index.js' && f.endsWith('.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.values(db).forEach((m) => m?.associate?.(db));

module.exports = db;
```

#### Exemplo `src/models/User.js`

```js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id:             { type: DataTypes.UUID, allowNull: false },
    nome:                  { type: DataTypes.STRING(120), allowNull: false },
    nickname:              { type: DataTypes.STRING(60), allowNull: false, unique: true },
    email:                 { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash:         { type: DataTypes.STRING(72) },
    phone:                 { type: DataTypes.STRING(20) },
    data_nascimento:       { type: DataTypes.DATEONLY },
    avatar_url:            { type: DataTypes.STRING(500) },
    bio:                   { type: DataTypes.TEXT },
    cidade_id:             { type: DataTypes.UUID },
    role:                  { type: DataTypes.ENUM('user','professor','venue_admin','admin','superadmin'), defaultValue: 'user' },
    status:                { type: DataTypes.ENUM('active','suspended','banned'), defaultValue: 'active' },
    push_token:            { type: DataTypes.STRING(255) },
    notifications_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'app_user', paranoid: true, timestamps: true, underscored: true });

  User.associate = (m) => {
    User.hasMany(m.RefreshToken,  { foreignKey: 'user_id', as: 'refreshTokens' });
    User.hasMany(m.SportProfile,  { foreignKey: 'user_id', as: 'sportProfiles' });
    User.hasMany(m.Participacao,  { foreignKey: 'user_id', as: 'participacoes' });
    User.belongsTo(m.Cidade,      { foreignKey: 'cidade_id', as: 'cidade' });
  };

  // Esconder campos sensíveis ao serializar
  User.prototype.toJSON = function () {
    const { password_hash, tenant_id, ...rest } = this.get();
    return rest;
  };

  return User;
};
```

---

## 7. FASE 4 — MIGRAR ROTAS, UMA POR UMA

Trabalhar nesta ordem (cada item = 1 commit):

### 7.1 Health + config

`GET /health` (já no `server.js`) e `GET /api/v1/config` (versão mínima do app).

### 7.2 Auth (a mais crítica)

Rotas: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `POST /auth/apple`, `POST /auth/google`, `POST /forgot-password`, `POST /reset-password`.

Arquivos a criar:
- `src/controllers/auth.controller.js`
- `src/services/auth.service.js`
- `src/services/token.service.js` (gerar/verificar JWT, rotação de refresh)
- `src/routes/auth.routes.js`

Testar com `curl`:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste","email":"teste@x.com","password":"senha12345","cidade_id":"<uuid>"}'

curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@x.com","password":"senha12345"}'
# Anota o accessToken da resposta

curl http://localhost:3000/api/v1/me \
  -H "Authorization: Bearer <accessToken>"
```

### 7.3 Perfil do usuário

`GET /me`, `PATCH /me`, `POST /me/avatar`, `DELETE /me`, `GET /me/export`.

### 7.4 Cidades + venues

`GET /cidades`, `GET /venues?cidade_id=...`, `GET /venues/:id`.

### 7.5 Sport profiles

`GET /me/sport-profiles`, `POST /me/sport-profiles`, `PATCH /me/sport-profiles/:id`.

### 7.6 Jogos (core do produto)

`GET /jogos/proximos` (PostGIS), `POST /jogos`, `GET /jogos/:id`, `POST /jogos/:id/participar`, `DELETE /jogos/:id/participar`, `POST /jogos/:id/cancelar`.

### 7.7 Friendships + reports

`GET /friends`, `POST /friends/:userId`, `DELETE /friends/:userId`, `POST /reports`.

### 7.8 Admin (web)

`GET /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/ban`, `GET /admin/reports`.

### 7.9 Após cada rota migrada, marcar no inventário (seção 4.1)

---

## 8. FASE 5 — DOCKERFILE + COMPOSE

### 8.1 `apps/api/Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN pnpm --filter @appagenda/api... build 2>/dev/null || true

# Runtime
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
RUN addgroup -g 1001 app && adduser -D -u 1001 -G app app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/src/server.js"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

### 8.2 Atualizar `compose.yml` da raiz

Já no padrão definido em [deploy.md → seção 6](deploy.md). Não muda nada (continua apontando pro `apps/api/Dockerfile`).

### 8.3 Build local e testar

```bash
docker compose build appagenda-api
docker compose up -d appagenda-api
docker logs -f appagenda-api
curl https://api.appagenda.wpxsystems.com.br/health
```

---

## 9. FASE 6 — DECISÃO SOBRE `apps/web`

**Recomendação:** **MANTER Next.js** por enquanto.

Motivos:
- Web admin não é prioridade (mobile é)
- Next.js + Vite são equivalentes pro caso de uso (admin é só React)
- Migrar dobra o esforço sem trazer ganho real

Quando reavaliar: se em 6 meses não tiver mexido no admin, e quiser uniformizar com os outros projetos WPX, aí migra pra Vite. É um refactor de 1 dia (mover páginas Next → rotas React Router, adaptar `getServerSideProps` → `useQuery`).

Atualizar `README.md` da raiz pra refletir que Next.js fica como exceção pra esse projeto.

---

## 10. FASE 7 — LIMPEZA FINAL

### 10.1 Remover `packages/db` (Drizzle)

```bash
git rm -r packages/db
```

Atualizar `pnpm-workspace.yaml` se listava `packages/db` explicitamente (geralmente usa glob `packages/*`).

### 10.2 Limpar dependências Drizzle e Fastify do monorepo

```bash
# Procurar referências sobreviventes
grep -r "drizzle" --include="package.json" .
grep -r "fastify" --include="package.json" .
# Remover dos package.json relevantes
```

### 10.3 Reescrever `CLAUDE.md`

Conteúdo novo (substituir o arquivo inteiro):

```markdown
# CLAUDE.md — AppAgenda

## Comandos essenciais
```bash
pnpm install
pnpm dev                              # tudo em paralelo
pnpm --filter api dev                 # só API (porta 3000)
pnpm --filter mobile start            # Expo Dev Tools
pnpm --filter web dev                 # Web admin (porta 5173)
pnpm --filter api migrate             # rodar migrations
pnpm --filter api seed                # popular dados iniciais
pnpm --filter mobile build:android    # EAS build Android
pnpm --filter mobile build:ios        # EAS build iOS
pnpm test                             # testes em todos os pacotes
pnpm lint
pnpm typecheck
```

## Arquitetura
Monorepo Turborepo com pnpm:
- `apps/api`         — Express + Sequelize + PostgreSQL/PostGIS
- `apps/mobile`      — Expo + React Native
- `apps/web`         — Next.js 14 (painel admin)
- `packages/shared`  — Zod schemas + tipos + enums compartilhados
- `packages/ui`      — componentes reutilizáveis (.native.tsx + .web.tsx)

## Regras (resumo — ver docs/ para detalhes)
**Padrão MVC:** toda rota → routes → middleware → controller (Zod) → service → model. Ver `docs/architecture.md`.
**Tipos:** sempre `packages/shared/src/enums.ts`. Nunca strings literais.
**Banco:** schema em `apps/api/src/models/` + migrations em `apps/api/src/migrations/`. Nunca editar migration aplicada.
**Validação:** schemas Zod em `packages/shared/src/schemas.ts` reusados na API + mobile + web.
**Geolocalização:** PostGIS com `geography(Point, 4326)`. Ordem `(lng, lat)`. Ver `docs/architecture.md`.
**Auth:** middleware `auth` + `tenantContext` em toda rota autenticada. Ver `docs/security.md`.
**Push:** Expo Push API via `pushService`. Sempre registrar em `app_push_notification_log`.
**LGPD:** ver `docs/compliance-lgpd.md` antes de coletar qualquer dado pessoal.

## Convenções
- TypeScript no mobile e shared; CommonJS na API (padrão WPX)
- Sem `any` explícito
- Tabelas: `app_<singular_snake>` (`app_user`, `app_jogo`)
- Rotas API: kebab-case plural (`/jogos`, `/sport-profiles`)
- Commits em inglês: `feat:`, `fix:`, `chore:`, `docs:`

## Banco local
PostgreSQL 16 + PostGIS via Docker:
```bash
docker compose -f docker-compose.dev.yml up -d postgres
docker exec -it appagenda-postgres-dev psql -U postgres -d appagenda \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
```

## CI
GitHub Actions em `.github/workflows/`:
- `ci.yml` — typecheck + lint + test em todo PR
- `deploy.yml` — deploy automático na VPS ao mergear em `main`
PR só mergeia com CI verde.
```

### 10.4 Remover backup do Fastify (quando tudo estiver verde em produção)

```bash
rm -rf apps/_api_fastify_backup
git add -A && git commit -m "chore: remove fastify backup after successful migration"
```

### 10.5 Merge da branch

```bash
git checkout main
git merge --no-ff refactor/express-sequelize
git push origin main
# CI/CD automático faz deploy
```

---

## 11. CRONOGRAMA SUGERIDO

| Dia    | Atividade                                                          |
| ------ | ------------------------------------------------------------------ |
| 1      | Checklist pré-migração + inventário (seções 3 e 4)                 |
| 1      | Esqueleto Express + middlewares base (seção 5)                     |
| 2      | Migrations + models Sequelize (seção 6)                            |
| 3      | Migrar Auth + Perfil (seção 7.1–7.3)                               |
| 4      | Migrar Cidades, Venues, Sport profiles (seção 7.4–7.5)             |
| 5      | Migrar Jogos + PostGIS (seção 7.6)                                 |
| 6      | Migrar Friendships, Reports, Admin (seção 7.7–7.8)                 |
| 7      | Dockerfile + compose + deploy em produção (seção 8)                |
| 8      | Smoke test no mobile contra a nova API + correção de bugs          |
| 9      | Cleanup (seção 10) + merge para `main`                             |

**Total: ~9 dias úteis** para uma migração tranquila. Se for full-time, 4-5 dias.

---

## 12. ROLLBACK (PLANO B)

Se algo der muito errado em produção depois do merge:

```bash
# Na VPS, voltar para o commit anterior
cd /opt/systems/apps/appagenda
git log --oneline -10                  # achar o hash do commit antes do merge
git reset --hard <hash-pre-merge>

# Restaurar backup do banco se as migrations rodaram
LATEST=$(ls -t /opt/systems/volumes/backups/pg_appagenda_*.sql.gz | head -1)
docker exec -it postgres psql -U wpxadmin -d postgres -c 'DROP DATABASE appagenda;'
docker exec -it postgres psql -U wpxadmin -d postgres -c 'CREATE DATABASE appagenda;'
gunzip -c $LATEST | docker exec -i postgres psql -U wpxadmin -d appagenda

# Rebuild com o código antigo
docker compose build && docker compose up -d --force-recreate
```

Como ainda não há usuários reais, na pior das hipóteses recria o banco do zero e roda as migrations novas.

---

## 13. CHECKLIST FINAL DE VALIDAÇÃO

Antes de declarar a migração concluída:

- [ ] Todas as rotas do inventário (seção 4.1) marcadas como migradas
- [ ] `pnpm test` verde em `apps/api`
- [ ] `pnpm typecheck` verde em todos os pacotes
- [ ] `pnpm lint` sem warnings novos
- [ ] `curl https://api.appagenda.wpxsystems.com.br/health` retorna `{ ok: true }`
- [ ] Login funciona pelo mobile (criar usuário, fazer login, ver perfil)
- [ ] `GET /jogos/proximos` retorna jogos próximos (testar com lat/lng de Joinville)
- [ ] Push notification de teste chega no celular
- [ ] Audit log gravando entradas em mutações
- [ ] RLS bloqueia query de outro tenant (testar com curl trocando tenant_id no JWT)
- [ ] Backup automático do banco rodando (`/opt/systems/backups.sh`)
- [ ] `packages/db` removido do repo
- [ ] `CLAUDE.md` atualizado pro novo stack
- [ ] `apps/_api_fastify_backup` removido
- [ ] Branch `refactor/express-sequelize` mergeada e deletada
