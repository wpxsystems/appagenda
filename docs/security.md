# Segurança — AppAgenda

> Práticas obrigatórias. Toda nova rota / feature deve atender a este documento.
> Violações bloqueiam o deploy.
> Cobre especificamente o cenário **app mobile + web admin + API pública**.

---

## 1. Autenticação

### 1.1 Senhas

- Hash com **bcrypt, 12 rounds** — nunca MD5, SHA-1, SHA-256 sem salt
- Mínimo: **10 caracteres**
- Verificação com `bcrypt.compare()` — nunca comparação direta

```js
const bcrypt = require('bcrypt');

// Salvar
const hash = await bcrypt.hash(senhaPlana, 12);

// Verificar (tempo constante — protege contra timing attacks)
const ok = await bcrypt.compare(senhaPlana, hashBanco);
if (!ok) throw new AppError('Credenciais inválidas', 401);
```

### 1.2 JWT — token de acesso

| Token         | TTL     | Onde fica (mobile)                       | Onde fica (web)                              |
| ------------- | ------- | ---------------------------------------- | -------------------------------------------- |
| Access token  | 15 min  | Memória (Zustand, axios interceptor)     | Memória (React Query, axios interceptor)     |
| Refresh token | 30 dias | `expo-secure-store` (Keychain/Keystore)  | Cookie `httpOnly + Secure + SameSite=Strict` |

> **Por que 30 dias no mobile?** Apps mobile esperam sessões longas (igual Instagram/WhatsApp). O cookie web é mais curto porque o usuário tende a fazer login mais frequente em navegador.

```js
// Payload do access token — NUNCA colocar senha, refresh token, ou PII desnecessária
const payload = {
  sub:   user.id,
  tid:   user.tenant_id,
  role:  user.role,
  email: user.email,
  typ:   'access',
};
const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

// Refresh token — valor aleatório, salvo como hash SHA-256 no banco
const rawToken  = crypto.randomBytes(40).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
// Salvar tokenHash no banco; enviar rawToken para o cliente
```

### 1.3 Refresh token rotativo

- A cada uso do refresh, gerar um **novo par** (access + refresh)
- Invalidar o token antigo imediatamente após uso
- **Detecção de reuso:** se um token já invalidado for usado, invalidar **todos** os tokens do usuário (sinal de roubo)
- Logout: deletar refresh token do banco + limpar cookie/SecureStore

```js
// Service de refresh — esqueleto
exports.refresh = async (rawTokenFromClient) => {
  const tokenHash = sha256(rawTokenFromClient);
  const stored = await RefreshToken.findOne({ where: { token_hash: tokenHash } });

  if (!stored) {
    // Token nunca existiu OU já foi rotacionado — sinal de roubo
    // Procurar a "família" do token e invalidar tudo desse usuário
    await RefreshToken.destroy({ where: { user_id: '<extraído de log>' } });
    throw new AppError('Sessão inválida', 401);
  }
  if (stored.expired() || stored.revoked) throw new AppError('Sessão expirada', 401);

  // Marcar atual como revogado e gerar novo par
  stored.revoked = true;
  await stored.save();

  return gerarParTokens(stored.user_id);
};
```

### 1.4 Login social (Apple + Google) — obrigatório no mobile

A App Store **exige** "Sign in with Apple" se você oferecer outros logins sociais.

| Provider          | Quando obrigatório                                          | SDK                                       |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Sign in with Apple| Se oferecer Google/Facebook no iOS                          | `expo-apple-authentication`               |
| Sign in with Google| Opcional, mas esperado                                     | `@react-native-google-signin/google-signin` ou Expo Auth Session |

Fluxo de validação no backend: validar o `idToken` do provider via biblioteca oficial (`google-auth-library`, `apple-signin-auth`), criar/vincular usuário, devolver par JWT da AppAgenda. **Nunca confiar no email retornado pelo cliente sem validar o token.**

### 1.5 Rate limiting em auth

| Endpoint                       | Limite                | Escopo      |
| ------------------------------ | --------------------- | ----------- |
| `POST /auth/login`             | 5 tentativas / 15 min | IP + e-mail |
| `POST /auth/forgot`            | 3 tentativas / hora   | E-mail      |
| `POST /auth/refresh`           | 30 / min              | IP          |
| `POST /auth/register`          | 5 / hora              | IP          |
| Geral (endpoints públicos)     | 100 / min             | IP          |
| Geral (autenticado)            | 600 / min             | Usuário     |
| Endpoints de escrita           | 60 / min              | Usuário     |
| `/jogos/proximos` (geo intenso)| 30 / min              | Usuário     |

### 1.6 Bloqueio de conta

- 10 falhas em 1 hora → conta bloqueada por 1 hora
- Registrar em `app_audit_log` com nível `warn`
- Notificar usuário por e-mail
- **Não retornar mensagem diferente para usuário inexistente** — sempre `"Credenciais inválidas"`

---

## 2. Autorização

### 2.1 Regra de ouro

> **Tenant ID e User ID SEMPRE vêm do JWT (`req.auth`). Nunca aceitar do body, query ou params.**

```js
// CERTO
const rows = await Jogo.findAll({ where: { tenant_id: req.auth.tenantId } });

// ERRADO — abre brecha para acessar dados de outro tenant
const rows = await Jogo.findAll({ where: { tenant_id: req.body.tenant_id } });
```

### 2.2 Roles

| Role         | Acesso                                          |
| ------------ | ----------------------------------------------- |
| `user`       | App mobile — operações do próprio usuário      |
| `professor`  | Pode criar aulas (futuro)                       |
| `venue_admin`| Pode editar dados do venue que administra       |
| `admin`      | Painel admin web — tudo do tenant               |
| `superadmin` | Acesso cross-tenant — somente WPX internamente  |

```js
// middleware requireRole
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth.role)) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }
  next();
};

// Uso
router.delete('/admin/jogos/:id', auth, tenantContext, requireRole('admin', 'superadmin'), ctrl.remove);
```

### 2.3 Verificar propriedade do recurso

Sempre validar que o recurso pertence ao tenant/usuário antes de qualquer operação:

```js
const jogo = await Jogo.findOne({
  where: { id: req.params.id, tenant_id: req.auth.tenantId },
});
if (!jogo) throw new AppError('Não encontrado', 404);

// Para operações que só o criador pode fazer:
if (jogo.criado_por !== req.auth.userId && req.auth.role !== 'admin') {
  throw new AppError('Acesso negado', 403);
}
```

---

## 3. Multi-tenancy — Row Level Security (RLS)

Toda tabela com `tenant_id` deve ter RLS ativo. Isso garante isolamento **no nível do banco** — mesmo um bug no código não vaza dados de outro tenant.

```sql
ALTER TABLE app_jogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_jogo FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app_jogo
  USING      (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
```

Middleware `tenantContext.js` abre transação e seta o GUC:

```js
// IMPORTANTE: validar tenantId com regex UUID antes de interpolar — Sequelize não escapa em SET LOCAL
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res, next) => {
  const tenantId = req.auth?.tenantId;
  if (!UUID_RE.test(tenantId)) return res.status(401).json({ success: false, error: 'Tenant inválido' });

  const t = await sequelize.transaction();
  await sequelize.query(`SET LOCAL app.current_tenant = '${tenantId}'`, { transaction: t });
  req.tx = t;

  res.on('finish', () => (res.statusCode < 400 ? t.commit() : t.rollback()).catch(() => {}));
  next();
};
```

### Papéis PostgreSQL

| Role             | Privilégios                                                  |
| ---------------- | ------------------------------------------------------------ |
| `appagenda_app`  | CRUD em `app_*`, **sem** SUPERUSER, **sem** BYPASSRLS        |
| `appagenda_auth` | BYPASSRLS apenas em `app_user`, `app_refresh_token`          |
| `wpxadmin`       | Superuser — só para migrations e backups                     |

---

## 4. SQL Injection

- **Sempre** usar Sequelize com queries parametrizadas
- Raw queries: obrigatório usar `replacements` ou `bind`
- **Proibido**: concatenar input do usuário em string SQL
- Cuidado especial com queries PostGIS dinâmicas

```js
// CERTO — parametrizado
await sequelize.query(
  'SELECT * FROM app_jogo WHERE venue_id = :venueId AND tenant_id = :tenantId',
  { replacements: { venueId, tenantId }, type: QueryTypes.SELECT }
);

// CERTO — PostGIS parametrizado
await sequelize.query(
  `SELECT * FROM app_venue
   WHERE ST_DWithin(localizacao, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :raio)`,
  { replacements: { lat, lng, raio }, type: QueryTypes.SELECT }
);

// ERRADO — SQL injection
await sequelize.query(`SELECT * FROM app_jogo WHERE venue_id = '${venueId}'`);
```

---

## 5. Proteção contra ataques comuns

### 5.1 Mass assignment

Nunca passar `req.body` direto para o model. Sempre validar com Zod e extrair campos permitidos:

```js
// CERTO — campos explícitos via Zod
const { esporte, venue_id, data_hora, vagas } = createSchema.parse(req.body);
await Jogo.create({ esporte, venue_id, data_hora, vagas, tenant_id: req.auth.tenantId, criado_por: req.auth.userId });

// ERRADO — mass assignment
await Jogo.create({ ...req.body, tenant_id: req.auth.tenantId });
// Usuário poderia injetar status:'realizado', criado_por:'outro-user', etc.
```

### 5.2 XSS

- Sanitizar strings recebidas antes de armazenar
- React e React Native **escapam HTML por padrão** — nunca usar `dangerouslySetInnerHTML` com input do usuário
- Content-Security-Policy na web admin

```js
// middleware sanitize.js — aplicar globalmente
const sanitizeHtml = require('sanitize-html');

const walk = (obj) => {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') obj[key] = sanitizeHtml(obj[key], { allowedTags: [], allowedAttributes: {} });
    else if (typeof obj[key] === 'object' && obj[key]) walk(obj[key]);
  }
};

module.exports = (req, _res, next) => {
  if (req.body)  walk(req.body);
  if (req.query) walk(req.query);
  next();
};
```

### 5.3 CSRF

- Mobile: imune a CSRF (não usa cookies, manda Bearer token)
- Web: refresh token em cookie `SameSite=Strict` previne CSRF nos endpoints de auth
- Para mutações via cookie: verificar `Origin`/`Referer` contra `ALLOWED_ORIGINS`

### 5.4 Headers de segurança

```js
const helmet = require('helmet');
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc:  ["'self'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    imgSrc:     ["'self'", 'data:', 'https://*.r2.cloudflarestorage.com'],
    connectSrc: ["'self'", 'https://api.appagenda.wpxsystems.com.br'],
  },
}));
```

---

## 6. Segurança específica do mobile

### 6.1 Armazenamento seguro de tokens

- ✅ `expo-secure-store` (Keychain iOS / Keystore Android) para refresh token
- ✅ Memória (Zustand store) para access token
- ❌ `AsyncStorage` para tokens — é apenas localStorage, NÃO criptografado
- ❌ `localStorage` (no caso de uso futuro com Expo Web)

```ts
// services/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export const saveRefreshToken = (token: string) =>
  SecureStore.setItemAsync('refresh_token', token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

export const getRefreshToken = () => SecureStore.getItemAsync('refresh_token');
export const deleteRefreshToken = () => SecureStore.deleteItemAsync('refresh_token');
```

### 6.2 Certificate pinning (opcional mas recomendado)

Em apps de produção financeiros/sensíveis, usar `react-native-ssl-pinning` para evitar MITM via certificados maliciosos instalados no device. Para AppAgenda: opcional — TLS padrão + HSTS resolve 99% dos casos.

### 6.3 Forçar atualização do app

A API deve expor `GET /api/config` com versão mínima suportada:

```js
exports.config = (req, res) => res.json({
  success: true,
  data: {
    min_app_version_ios:     '1.2.0',
    min_app_version_android: '1.2.0',
    force_update_below:      '1.0.0',  // bloqueia uso
    maintenance:             false,
  },
});
```

Mobile checa no boot e bloqueia uso se versão menor que `force_update_below`.

### 6.4 Detecção de jailbreak/root (opcional)

`react-native-device-info` + `JailMonkey` — alertar usuário e/ou bloquear pagamentos em devices comprometidos. Não obrigatório em fase inicial.

### 6.5 Permissões mínimas

| Permissão           | iOS                          | Android                                          | Quando pedir      |
| ------------------- | ---------------------------- | ------------------------------------------------ | ----------------- |
| Localização       | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` (não BACKGROUND_LOCATION) | Antes de buscar jogos próximos |
| Notificações push | `aps-environment`            | `POST_NOTIFICATIONS` (Android 13+)               | Após login        |
| Câmera             | `NSCameraUsageDescription`   | `CAMERA`                                         | Ao tirar foto de perfil |
| Galeria             | `NSPhotoLibraryUsageDescription` | `READ_MEDIA_IMAGES`                          | Ao trocar foto    |

**Nunca pedir tudo de uma vez no onboarding** — pedir só quando o usuário tenta usar a feature.

---

## 7. Dados sensíveis

### 7.1 O que nunca pode aparecer em logs

- Senhas (mesmo em hash)
- Tokens JWT completos
- Refresh tokens (mesmo em hash)
- CPF, RG, dados bancários
- E-mail completo (logar primeiros 3 chars + domínio: `wil***@gmail.com`)
- Tokens de reset de senha
- Tokens de push (Expo push token)
- Coordenadas GPS exatas

### 7.2 O que nunca vai para o cliente

- `tenant_id` nas respostas (mobile/web já sabe via JWT)
- Hash de refresh token
- Senha hash de outros usuários
- Coordenadas exatas de outros usuários (mostrar só distância arredondada)

### 7.3 Variáveis de ambiente

- Nunca commitar `.env` — está no `.gitignore`
- Em produção: injetar via Docker secrets ou `env_file` do compose
- `JWT_SECRET` deve ser o mesmo em todos os containers e restarts
- `EXPO_ACCESS_TOKEN` só no servidor — **nunca no app**

---

## 8. Upload de arquivos (fotos de perfil, fotos de venue)

- Validar MIME type no servidor (não confiar no `Content-Type` do cliente)
- Limitar tamanho: máx. **5 MB** por imagem
- Aceitar apenas `image/jpeg`, `image/png`, `image/webp`
- Não executar arquivos enviados
- Armazenar em **Cloudflare R2** ou S3 — nunca no filesystem do container
- Gerar nome aleatório (UUID) — nunca usar o nome original
- **Redimensionar** no servidor (Sharp) para no máx. 1920px de largura

```js
// utils/upload.js — esboço
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

exports.uploadAvatar = async (buffer, userId) => {
  const processed = await sharp(buffer)
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `avatars/${userId}/${crypto.randomUUID()}.webp`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: processed,
    ContentType: 'image/webp',
  }));

  return `https://cdn.appagenda.wpxsystems.com.br/${key}`;
};
```

---

## 9. Auditoria

Toda mutação de dado sensível deve ser registrada em `app_audit_log`:

```js
{
  tenant_id,
  user_id,
  acao:        'jogo.cancelar',        // entidade.verbo
  entidade_id: jogo.id,
  antes:       { status: 'aberto' },   // snapshot anterior (sem PII)
  depois:      { status: 'cancelado' },
  ip:          req.ip,
  user_agent:  req.headers['user-agent'],
  app_version: req.headers['x-app-version'],  // do mobile
  created_at:  new Date(),
}
```

Não logar dados pessoais completos no campo `antes`/`depois`.

---

## 10. Push notifications — segurança

- **Nunca enviar dado sensível no payload** (SMS-like — pode aparecer na tela de bloqueio)
- ✅ Enviar IDs e títulos genéricos: "Novo jogo perto de você!"
- ❌ NÃO enviar: nome do convidado, valor, localização exata
- Sempre logar envios em `app_push_notification_log`
- Respeitar `notifications_enabled = false` do usuário
- Implementar opt-out granular (jogos, comentários, sistema)

---

## 11. Checklist de segurança por feature

Antes de fazer PR de qualquer nova feature:

- [ ] Endpoint protegido com `auth` + `tenantContext`
- [ ] `tenant_id` e `user_id` vêm do JWT, não do body
- [ ] Input validado com Zod (nunca `req.body` direto no model)
- [ ] Tabela nova com RLS habilitado + política de isolamento
- [ ] Nenhum dado sensível em logs ou resposta desnecessária
- [ ] Rate limit adequado para endpoint de escrita
- [ ] Operações destrutivas exigem `requireRole('admin')`
- [ ] Mobile: dados sensíveis em `SecureStore`, nunca `AsyncStorage`
- [ ] Push: payload sem PII, respeita `notifications_enabled`
- [ ] Upload: validação de MIME + tamanho + redimensionamento
- [ ] Testes manuais com usuário de outro tenant (deve receber 404/403)
- [ ] Forçar update do app considerado? (versão mínima na `/api/config`)
