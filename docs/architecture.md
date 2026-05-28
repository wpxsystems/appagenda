# Arquitetura — Padrão MVC AppAgenda

> Toda nova rota / regra de negócio deve seguir este padrão.
> Violações bloqueiam o code review.
> Baseado em [padrao-desenvolvimento-mvc.md](https://wpxsystems.com.br) — adaptado para mobile-first + geolocalização.

---

## 1. Fluxo de uma requisição (API)

```
HTTP Request (mobile/web)
   ↓
Express Router  (routes/)
   ↓
Middlewares     (auth → tenantContext → rateLimit → audit)
   ↓
Controller      (controllers/)   ← valida input com Zod
   ↓
Service         (services/)      ← regras de negócio, transações
   ↓
Model           (models/)        ← Sequelize ORM
   ↓
PostgreSQL      (com RLS ativo)
   ↑
HTTP Response   ← JSON padronizado { success, data, meta }
```

---

## 2. Responsabilidade de cada camada (backend)

### 2.1 Routes (`apps/api/src/routes/index.js`)

- Mapeia URL + método HTTP para um controller
- Aplica os middlewares corretos na ordem certa
- **Zero lógica de negócio aqui**

```js
// routes/jogo.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const tenantContext = require('../middlewares/tenantContext');
const writeLimiter = require('../middlewares/rateLimit').writeLimiter;
const requireRole = require('../middlewares/requireRole');
const ctrl = require('../controllers/jogo.controller');

router.get('/jogos',          auth, tenantContext, ctrl.list);
router.get('/jogos/proximos', auth, tenantContext, ctrl.proximos);   // PostGIS — ST_DWithin
router.post('/jogos',         auth, tenantContext, writeLimiter, ctrl.create);
router.post('/jogos/:id/participar', auth, tenantContext, writeLimiter, ctrl.participar);
router.delete('/jogos/:id',   auth, tenantContext, requireRole('admin'), ctrl.remove);

module.exports = router;
```

### 2.2 Middlewares (`apps/api/src/middlewares/`)

| Middleware              | Responsabilidade                                                                |
| ----------------------- | ------------------------------------------------------------------------------- |
| `auth.js`               | Valida JWT, popula `req.auth = { userId, tenantId, role, email }`              |
| `tenantContext.js`      | Abre transação Sequelize + `SET LOCAL app.current_tenant` para RLS             |
| `requireRole.js`        | Rejeita com 403 se `req.auth.role` não satisfaz                                 |
| `rateLimit.js`          | Limita requisições por IP / usuário                                             |
| `sanitize.js`           | Remove scripts e caracteres perigosos de strings                                |
| `audit.js`              | Grava mutações em `app_audit_log` com hash encadeado                            |
| `errorHandler.js`       | Captura `AppError`, retorna JSON `{ success: false, error }`                    |
| `mobileVersionGate.js`  | Bloqueia versões antigas do app (campo `min_app_version` no `/api/config`)      |

### 2.3 Controllers (`apps/api/src/controllers/<entidade>.controller.js`)

- Recebe `req`, valida com Zod, chama o service, devolve resposta
- **Não conhece SQL nem ORM diretamente**
- Use `asyncHandler()` — elimina try/catch repetido
- Ideal: < 200 linhas por arquivo

```js
// controllers/jogo.controller.js
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const jogoService = require('../services/jogo.service');

const createSchema = z.object({
  esporte:       z.enum(['tenis', 'padel', 'beach_tennis']),
  venue_id:      z.string().uuid(),
  data_hora:     z.string().datetime(),
  duracao_min:   z.number().int().min(30).max(240),
  nivel_minimo:  z.enum(['iniciante', 'intermediario', 'avancado']),
  vagas:         z.number().int().min(2).max(8),
  observacoes:   z.string().max(500).optional(),
});

const proximosSchema = z.object({
  lat:       z.coerce.number().min(-90).max(90),
  lng:       z.coerce.number().min(-180).max(180),
  raio_km:   z.coerce.number().min(1).max(50).default(10),
  esporte:   z.enum(['tenis', 'padel', 'beach_tennis']).optional(),
});

exports.create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const jogo = await jogoService.create(req.auth.tenantId, req.auth.userId, data);
  res.status(201).json({ success: true, data: jogo });
});

exports.proximos = asyncHandler(async (req, res) => {
  const params = proximosSchema.parse(req.query);
  const jogos = await jogoService.buscarProximos(req.auth.userId, params);
  res.json({ success: true, data: jogos });
});
```

### 2.4 Services (`apps/api/src/services/<entidade>.service.js`)

- **Toda regra de negócio vive aqui**
- Gerencia transações Sequelize
- Pode chamar outros services (ex.: `pushService` para notificar participantes)
- Lança `AppError` para erros esperados

```js
// services/jogo.service.js
const { Op } = require('sequelize');
const { sequelize, Jogo, Participacao, Venue, User } = require('../models');
const AppError = require('../utils/AppError');
const pushService = require('./push.service');

exports.create = async (tenantId, userId, data) => {
  return sequelize.transaction(async (t) => {
    const venue = await Venue.findOne({
      where: { id: data.venue_id, tenant_id: tenantId },
      transaction: t,
    });
    if (!venue) throw new AppError('Local não encontrado', 404);

    const jogo = await Jogo.create({
      ...data,
      tenant_id: tenantId,
      criado_por: userId,
      status: 'aberto',
    }, { transaction: t });

    // Criador entra como primeiro participante
    await Participacao.create({
      jogo_id: jogo.id,
      user_id: userId,
      status: 'confirmado',
    }, { transaction: t });

    return jogo;
  });
};

// Busca jogos num raio X usando PostGIS
exports.buscarProximos = async (userId, { lat, lng, raio_km, esporte }) => {
  const where = esporte
    ? `AND j.esporte = :esporte`
    : '';
  const replacements = { lat, lng, raio_m: raio_km * 1000, userId };
  if (esporte) replacements.esporte = esporte;

  return sequelize.query(`
    SELECT
      j.id, j.esporte, j.data_hora, j.duracao_min, j.nivel_minimo, j.vagas,
      v.nome AS venue_nome, v.endereco,
      ST_Distance(v.localizacao, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000 AS distancia_km,
      (SELECT COUNT(*) FROM app_participacao p WHERE p.jogo_id = j.id AND p.status = 'confirmado') AS confirmados
    FROM app_jogo j
    INNER JOIN app_venue v ON v.id = j.venue_id
    WHERE
      ST_DWithin(v.localizacao, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :raio_m)
      AND j.status = 'aberto'
      AND j.data_hora > NOW()
      AND j.criado_por != :userId
      ${where}
    ORDER BY j.data_hora ASC
    LIMIT 100;
  `, { replacements, type: sequelize.QueryTypes.SELECT });
};
```

### 2.5 Models (`apps/api/src/models/<Entidade>.js`)

- Schema Sequelize com tipos, validações e associações
- `paranoid: true` para soft delete (coluna `deleted_at`)
- **Nunca** colocar regra de negócio aqui

```js
// models/Jogo.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Jogo = sequelize.define('Jogo', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id:    { type: DataTypes.UUID, allowNull: false },
    venue_id:     { type: DataTypes.UUID, allowNull: false },
    esporte:      { type: DataTypes.ENUM('tenis','padel','beach_tennis'), allowNull: false },
    data_hora:    { type: DataTypes.DATE, allowNull: false },
    duracao_min:  { type: DataTypes.INTEGER, allowNull: false },
    nivel_minimo: { type: DataTypes.ENUM('iniciante','intermediario','avancado'), allowNull: false },
    vagas:        { type: DataTypes.INTEGER, allowNull: false },
    status:       { type: DataTypes.ENUM('aberto','cheio','realizado','cancelado'), defaultValue: 'aberto' },
    observacoes:  { type: DataTypes.TEXT },
    criado_por:   { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName:  'app_jogo',
    paranoid:   true,
    timestamps: true,
    underscored: true,
  });

  Jogo.associate = (models) => {
    Jogo.belongsTo(models.Venue,  { foreignKey: 'venue_id',   as: 'venue' });
    Jogo.belongsTo(models.User,   { foreignKey: 'criado_por', as: 'criador' });
    Jogo.hasMany(models.Participacao, { foreignKey: 'jogo_id', as: 'participacoes' });
  };

  return Jogo;
};
```

---

## 3. Convenções de nomenclatura

| Artefato             | Padrão                          | Exemplo                  |
| -------------------- | ------------------------------- | ------------------------ |
| Tabela               | `app_` + snake_case             | `app_jogo`               |
| Coluna               | snake_case                      | `data_hora`, `criado_por`|
| Coluna geográfica    | nome semântico + tipo PostGIS  | `localizacao geography(Point, 4326)` |
| Model (arquivo)      | PascalCase                      | `Jogo.js`                |
| Controller (arquivo) | snake_case + `.controller.js`   | `jogo.controller.js`     |
| Service (arquivo)    | snake_case + `.service.js`      | `jogo.service.js`        |
| Rota                 | kebab-case plural               | `/api/v1/jogos`          |
| Variável JS         | camelCase                       | `clienteId`, `dataHora`  |
| Tela mobile/web      | PascalCase                      | `JogosProximos.tsx`      |

---

## 4. Migrations + PostGIS

- **Nunca editar migration existente** — criar nova com timestamp
- Nome: `YYYYMMDDHHMMSS-descricao-curta.js`
- Habilitar PostGIS **uma única vez** na primeira migration do banco
- DML em tabela com RLS: usar `SET ROLE appagenda_auth` antes do INSERT

```js
// migrations/20260601120000-create-venue.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Habilita PostGIS (uma vez no projeto)
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');

    await queryInterface.createTable('app_venue', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      tenant_id:   { type: Sequelize.UUID, allowNull: false },
      nome:        { type: Sequelize.STRING(120), allowNull: false },
      endereco:    { type: Sequelize.STRING(255), allowNull: false },
      cidade_id:   { type: Sequelize.UUID, allowNull: false },
      created_at:  { type: Sequelize.DATE, allowNull: false },
      updated_at:  { type: Sequelize.DATE, allowNull: false },
      deleted_at:  { type: Sequelize.DATE },
    });

    // Coluna PostGIS — tipo geography é mais simples que geometry para distâncias em metros
    await queryInterface.sequelize.query(`
      ALTER TABLE app_venue ADD COLUMN localizacao geography(Point, 4326);
      CREATE INDEX idx_venue_localizacao ON app_venue USING GIST (localizacao);
    `);

    // Índices regulares
    await queryInterface.addIndex('app_venue', ['tenant_id']);
    await queryInterface.addIndex('app_venue', ['cidade_id']);

    // RLS
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

### Inserir/atualizar ponto PostGIS

```js
// No service, ao criar venue:
await Venue.create({
  ...data,
  localizacao: sequelize.literal(`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`),
});
```

> **Atenção:** PostGIS usa ordem `(longitude, latitude)` — não inverter. O `4326` é o SRID do WGS84 (GPS padrão).

---

## 5. Resposta HTTP padronizada

```js
// Sucesso com dado
res.status(200).json({ success: true, data: { ... } });

// Lista paginada
res.status(200).json({ success: true, data: [...], meta: { total, page, limit } });

// Criação
res.status(201).json({ success: true, data: { id, ... } });

// Erro esperado (lançado no service)
throw new AppError('Mensagem para o usuário', 422);
// errorHandler converte para:
// { success: false, error: 'Mensagem para o usuário' }

// Erro de validação (Zod no controller via asyncHandler)
// { success: false, error: 'Validation error', details: [...] }
```

### Status codes padronizados

| Code | Quando                                         |
| ---- | ---------------------------------------------- |
| 200  | OK                                             |
| 201  | Recurso criado                                 |
| 204  | OK sem corpo (DELETE bem-sucedido)             |
| 400  | Erro de input (validação Zod)                  |
| 401  | JWT inválido / ausente / expirado              |
| 403  | Autenticado mas sem permissão                  |
| 404  | Recurso não encontrado                         |
| 409  | Conflito (ex.: já está participando do jogo)   |
| 422  | Regra de negócio violada                       |
| 426  | Versão do app desatualizada (forçar update)    |
| 429  | Rate limit                                     |
| 500  | Erro interno (logar com pino)                  |

---

## 6. Mobile (Expo + React Native) — padrão de tela

```tsx
// apps/mobile/src/screens/JogosProximos.tsx
import { useQuery } from '@tanstack/react-query';
import { View, FlatList, Text } from 'react-native';
import { api } from '../services/api';
import { useLocation } from '../hooks/useLocation';
import { JogoCard } from '../components/JogoCard';
import { Skeleton } from '../components/Skeleton';

interface Jogo {
  id: string;
  esporte: 'tenis' | 'padel' | 'beach_tennis';
  data_hora: string;
  venue_nome: string;
  distancia_km: number;
  confirmados: number;
  vagas: number;
}

export default function JogosProximos() {
  const { location, requestPermission } = useLocation();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jogos-proximos', location?.coords],
    queryFn: () => api.get('/jogos/proximos', {
      params: { lat: location!.coords.latitude, lng: location!.coords.longitude, raio_km: 10 },
    }).then((r) => r.data.data as Jogo[]),
    enabled: !!location,
  });

  if (!location) {
    return <PermissionGate onRequest={requestPermission} />;
  }
  if (isLoading) return <Skeleton count={5} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(j) => j.id}
      renderItem={({ item }) => <JogoCard jogo={item} />}
      onRefresh={refetch}
      refreshing={isLoading}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    />
  );
}
```

### Estado global mobile

- **Zustand** para auth, theme, location (leve, sem boilerplate)
- **React Query** para dados do servidor (cache + refetch + offline-first)
- **AsyncStorage** apenas para dados não sensíveis (preferências)
- **SecureStore (expo-secure-store)** para tokens (refresh token, biometria)

---

## 7. Web (React + Vite) — padrão de página

```tsx
// apps/web/src/pages/admin/Jogos.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface Jogo { id: string; esporte: string; data_hora: string; status: string; }

export default function AdminJogos() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jogos'],
    queryFn: () => api.get('/admin/jogos').then((r) => r.data.data as Jogo[]),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => api.post(`/admin/jogos/${id}/cancelar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-jogos'] }),
    onError: (err: any) => showToast(err.response?.data?.error ?? 'Erro ao cancelar', 'error'),
  });

  if (isLoading) return <SkeletonTable />;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Jogos</h1>
      </div>
      {/* tabela */}
    </div>
  );
}
```

---

## 8. AppError + asyncHandler (utilitários obrigatórios)

```js
// utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
module.exports = AppError;

// utils/asyncHandler.js
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
module.exports = asyncHandler;
```

---

## 9. Schemas Zod compartilhados (`packages/shared/src/schemas.ts`)

Mesmo schema usado na API (validação de input) e no mobile/web (validação de form) — fonte única da verdade.

```ts
import { z } from 'zod';

export const SportEnum = z.enum(['tenis', 'padel', 'beach_tennis']);
export const SkillEnum = z.enum(['iniciante', 'intermediario', 'avancado']);

export const createJogoSchema = z.object({
  esporte: SportEnum,
  venue_id: z.string().uuid(),
  data_hora: z.string().datetime(),
  duracao_min: z.number().int().min(30).max(240),
  nivel_minimo: SkillEnum,
  vagas: z.number().int().min(2).max(8),
  observacoes: z.string().max(500).optional(),
});

export type CreateJogoInput = z.infer<typeof createJogoSchema>;
```

---

## 10. Tabela de decisão rápida

| Pergunta                                          | Onde colocar                                          |
| ------------------------------------------------- | ----------------------------------------------------- |
| Validar input HTTP?                               | Controller (Zod)                                      |
| Buscar/escrever no banco?                         | Service → Model                                       |
| Regra de "só admin pode"?                         | Middleware `requireRole('admin')` na rota             |
| Cálculo de distância PostGIS?                    | Service (raw query com `sequelize.query`)             |
| Enviar push notification?                         | Service (chama `pushService.send(...)`)               |
| Transformar resposta antes de enviar?             | Serializer no controller (`toJSON()` do model)        |
| Job assíncrono (ex.: limpar jogos expirados)?     | `jobs/` + cron via `node-cron` ou Bull               |
| Cache de query frequente?                         | Redis (futuro) ou `node-cache` em memória             |
| Validar form no mobile/web?                       | Schema Zod de `packages/shared`                       |
| Subir foto?                                       | Service → R2 (Cloudflare) → grava URL no banco       |

---

## 11. O que NUNCA fazer

- ❌ `req.body` direto no `Model.create()` (mass assignment)
- ❌ `tenant_id` vindo do body/query/params (sempre do JWT)
- ❌ Lógica de negócio no controller
- ❌ Query SQL com concatenação de string (use `replacements`)
- ❌ `console.log` em produção (use `pino` ou similar)
- ❌ Editar migration já aplicada
- ❌ Retornar `tenant_id`, hash de senha ou refresh token no JSON de resposta
- ❌ Coordenadas GPS na ordem `(lat, lng)` em PostGIS — é `(lng, lat)`!
- ❌ Push sem checar `notifications_enabled` do usuário
