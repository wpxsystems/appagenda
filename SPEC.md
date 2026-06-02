# SPEC — App de Esportes de Raquete
> Fase 0 (Fundações) + Fase 1 (MVP — loop central do jogador)
> Versão 1.0 — baseada na entrevista de produto de 2026-05-26
>
> ⚠️ **AVISO:** a seção "Stack definitiva" deste doc é histórica (planejava Fastify + Drizzle). A stack **real implementada** é **Express + Sequelize** — ver [CLAUDE.md](CLAUDE.md) e [docs/README.md](docs/README.md). Os requisitos de produto e features descritos aqui continuam válidos.

---

## 1. Stack definitiva

| Camada | Decisão | Justificativa |
|---|---|---|
| Mobile | React Native + Expo SDK 51+ | Um código iOS + Android; Expo Push para notificações |
| Web | Next.js 14 (App Router) | Mesmo modelo mental do mobile; complemento leve no MVP |
| API | Node.js + **Fastify** | Menos boilerplate, melhor performance, TypeScript nativo |
| ORM / Schema | **Drizzle ORM** | Schema em TypeScript; migrations SQL controladas; PostGIS via raw SQL sem fricção |
| Banco | PostgreSQL 16 + **PostGIS** | Queries espaciais para match por raio; coluna `geography` nas entidades com coordenadas |
| Auth | JWT (access + refresh tokens) + Google OAuth 2.0 | Sem BaaS; controle total desde o início |
| Realtime (chat) | WebSocket nativo via Fastify plugin (`@fastify/websocket`) | Chat de jogo; sem dependência de serviço externo no MVP |
| Push | Expo Push Notifications sobre FCM (Android) + APNs (iOS) | Notificações nativas completas desde o MVP |
| Monorepo | Turborepo | Compartilha tipos, validações e componentes |
| Linguagem | TypeScript em toda a stack | Tipos ponta a ponta; inferência automática entre camadas |
| Pagamentos | Fora do escopo — Fase 2+ | |

---

## 2. Estrutura do monorepo

```
/
├── apps/
│   ├── mobile/          # Expo + React Native
│   ├── web/             # Next.js
│   └── api/             # Fastify + Drizzle
├── packages/
│   ├── shared/          # Tipos TypeScript + schemas Zod (validações compartilhadas)
│   ├── db/              # Schema Drizzle + migrations + seed scripts
│   └── ui/              # Componentes React compartilhados (web + mobile via platform files)
├── turbo.json
├── package.json         # root workspace (pnpm)
├── CLAUDE.md
└── SPEC.md
```

**Regra de dependência:** `apps/*` pode importar de `packages/*`. Pacotes não importam de apps. `packages/shared` não depende de `packages/db`.

---

## 3. Modelo de dados

### Enums compartilhados (`packages/shared/src/enums.ts`)

```typescript
export const Sport = ['padel', 'beach_tennis', 'tennis'] as const
export type Sport = typeof Sport[number]

// Padel e Beach Tennis
export const RacketCategory = ['C', 'B', 'A', 'Open'] as const
export type RacketCategory = typeof RacketCategory[number]

export const SidePreference = ['left', 'right', 'both'] as const
export type SidePreference = typeof SidePreference[number]

// Tênis
export const TennisLevel = ['beginner', 'intermediate', 'advanced', 'competitive'] as const
export type TennisLevel = typeof TennisLevel[number]

export const PlayFormat = ['singles', 'doubles', 'both'] as const
export type PlayFormat = typeof PlayFormat[number]

// Usuário
export const Gender = ['male', 'female', 'other'] as const
export type Gender = typeof Gender[number]

export const UserRole = ['player', 'admin'] as const  // 'teacher' entra na Fase 3
export type UserRole = typeof UserRole[number]

// Jogo
export const GameGenderType = ['mixed', 'male', 'female'] as const
export type GameGenderType = typeof GameGenderType[number]

export const GameStatus = ['open', 'full', 'cancelled', 'completed'] as const
export type GameStatus = typeof GameStatus[number]

export const ParticipantStatus = ['registered', 'confirmed', 'attended', 'absent', 'removed'] as const
export type ParticipantStatus = typeof ParticipantStatus[number]
```

### Tabelas (`packages/db/src/schema.ts`)

#### `users`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK default gen | |
| `email` | `text` unique not null | |
| `password_hash` | `text` nullable | null se criado via Google OAuth |
| `google_id` | `text` unique nullable | |
| `name` | `text` not null | |
| `avatar_url` | `text` nullable | |
| `gender` | `gender_enum` not null | required para match |
| `role` | `user_role_enum` default `'player'` | |
| `push_token` | `text` nullable | Expo push token |
| `notifications_enabled` | `boolean` default `true` | |
| `created_at` | `timestamptz` default now | |
| `updated_at` | `timestamptz` default now | |

#### `cities`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | |
| `state` | `text` not null | sigla, ex: "SC" |
| `country` | `text` default `'BR'` | |
| `coordinates` | `geography(Point,4326)` not null | PostGIS |
| `is_active` | `boolean` default `false` | só cidades com quadras cadastradas |
| `slug` | `text` unique | ex: "joinville-sc" |

#### `user_locations`
| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | `uuid` FK `users.id` PK | 1:1 com user |
| `city_id` | `uuid` FK `cities.id` not null | cidade escolhida no onboarding |
| `device_coordinates` | `geography(Point,4326)` nullable | GPS do dispositivo, atualizado opcionalmente |
| `search_radius_km` | `integer` default `15` | raio customizável (opção avançada) |
| `updated_at` | `timestamptz` | |

#### `player_sport_profiles`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK `users.id` | |
| `sport` | `sport_enum` not null | |
| `is_active` | `boolean` default `true` | |
| `category` | `racket_category_enum` nullable | padel + beach tennis |
| `side_preference` | `side_preference_enum` nullable | padel + beach tennis |
| `skill_level` | `tennis_level_enum` nullable | tênis |
| `play_format` | `play_format_enum` nullable | tênis |
| `created_at` | `timestamptz` | |
| UNIQUE | `(user_id, sport)` | um perfil por esporte |

**Regras de integridade:** `category` e `side_preference` são obrigatórios quando `sport` ∈ {padel, beach_tennis}. `skill_level` é obrigatório quando `sport` = tennis. Validado no nível da API via Zod.

#### `venues`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | |
| `address` | `text` not null | |
| `city_id` | `uuid` FK `cities.id` | |
| `coordinates` | `geography(Point,4326)` not null | |
| `sports` | `sport_enum[]` not null | esportes disponíveis |
| `phone` | `text` nullable | |
| `website` | `text` nullable | |
| `is_active` | `boolean` default `true` | |
| `created_at` | `timestamptz` | |

#### `courts`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `venue_id` | `uuid` FK `venues.id` | |
| `name` | `text` not null | ex: "Quadra 1" |
| `sport` | `sport_enum` not null | |
| `surface` | `text` nullable | ex: "synthetic", "clay" |
| `is_indoor` | `boolean` default `true` | |
| `is_active` | `boolean` default `true` | |

#### `games`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `sport` | `sport_enum` not null | |
| `creator_id` | `uuid` FK `users.id` | |
| `court_id` | `uuid` FK `courts.id` nullable | quadra pode não estar definida |
| `venue_id` | `uuid` FK `venues.id` nullable | desnormalizado para facilitar queries |
| `coordinates` | `geography(Point,4326)` not null | copiado do venue ou informado pelo criador |
| `city_id` | `uuid` FK `cities.id` not null | cidade do jogo |
| `scheduled_at` | `timestamptz` not null | |
| `duration_minutes` | `integer` default `90` | |
| `vacancies_total` | `integer` not null | sugerido pelo sistema, editável |
| `gender_type` | `game_gender_type_enum` default `'mixed'` | |
| `status` | `game_status_enum` default `'open'` | |
| `court_reserved` | `boolean` default `false` | quadra já reservada pelo criador? |
| `notes` | `text` nullable | |
| `target_category` | `racket_category_enum` nullable | critério de match para padel/beach |
| `target_skill_level` | `tennis_level_enum` nullable | critério de match para tênis |
| `target_side` | `side_preference_enum` nullable | padel/beach: filtra por lado |
| `target_play_format` | `play_format_enum` nullable | tênis: simples ou duplas |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Lógica de vagas sugeridas pelo sistema:**
- padel → 4
- beach_tennis → 4
- tennis + singles → 2
- tennis + doubles → 4
- tennis + both (ou não definido) → 4

#### `game_participants`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `game_id` | `uuid` FK `games.id` | |
| `user_id` | `uuid` FK `users.id` | |
| `status` | `participant_status_enum` default `'registered'` | |
| `joined_at` | `timestamptz` default now | |
| UNIQUE | `(game_id, user_id)` | |

**Nota:** `attended`/`absent` são preenchidos pelo criador do jogo após o término. O criador está sempre em `game_participants` com status `confirmed`.

#### `game_messages`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `game_id` | `uuid` FK `games.id` | |
| `user_id` | `uuid` FK `users.id` | |
| `content` | `text` not null | |
| `created_at` | `timestamptz` | |

Index: `(game_id, created_at DESC)`

#### `push_notifications_log`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK `users.id` | |
| `type` | `text` not null | ex: `game_match`, `player_joined`, `game_reminder` |
| `payload` | `jsonb` | |
| `sent_at` | `timestamptz` | |
| `error` | `text` nullable | |

#### `waitlist_entries`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `text` not null | |
| `city_name` | `text` not null | texto livre digitado pelo usuário |
| `sport` | `sport_enum` nullable | |
| `created_at` | `timestamptz` | |

---

## 4. Localização — modelo híbrido

**UX:** No onboarding, o usuário escolhe **a cidade onde quer jogar** a partir de uma lista de cidades ativas (como origem no BlaBlaCar). Isso fica salvo em `user_locations.city_id`.

**Busca de jogos:** Por padrão, busca jogos cuja `city_id` = cidade do usuário. Como opção avançada, o usuário pode definir um `search_radius_km` e a query usa PostGIS:

```sql
SELECT g.* FROM games g
JOIN venues v ON g.venue_id = v.id
WHERE g.sport = $sport
  AND g.status = 'open'
  AND ST_DWithin(
    g.coordinates,
    ST_SetSRID(ST_MakePoint($userLng, $userLat), 4326)::geography,
    $radiusMeters
  )
  AND g.scheduled_at > NOW()
ORDER BY g.scheduled_at ASC
```

**Match de alertas:** Usa `city_id` por padrão. A coluna `coordinates` em `games` e `venues` está sempre preenchida para suportar queries espaciais quando o raio for usado.

---

## 5. Autenticação

- **Registro:** `POST /auth/register` — nome, email, senha, gênero, 1 esporte com nível.
- **Login:** `POST /auth/login` — email + senha.
- **Google OAuth:** `GET /auth/google` → redirect → `GET /auth/google/callback` → JWT.
- **Tokens:** access token (15 min) + refresh token (30 dias, armazenado em `refresh_tokens` table). Mobile armazena tokens em SecureStore (Expo).
- **Refresh:** `POST /auth/refresh`.
- **Logout:** `POST /auth/logout` — invalida o refresh token.

---

## 6. Telas e fluxos — Fase 1

### 6.1 Onboarding

**Telas:**
1. **Splash** — logo + "Entrar" + "Criar conta"
2. **Registro — Conta** — nome, email, senha (mínimo 8 chars) | ou botão "Continuar com Google"
3. **Registro — Perfil** — gênero (masculino / feminino / outro), cidade (picker de cidades ativas)
4. **Registro — Esporte** — escolha do esporte (padel / beach tennis / tênis); pelo menos 1 obrigatório
5. **Registro — Nível** — campos condicionais por esporte escolhido (categoria + lado para padel/beach; nível + formato para tênis)
6. **Home** (entra no app)

**Cadastro progressivo:** disponibilidade recorrente e quadras favoritas são opcionais e podem ser preenchidos depois no perfil.

**Critérios de aceite:**
- [ ] Usuário consegue criar conta com email/senha e acessar o app em < 2 minutos
- [ ] Login com Google cria conta na primeira vez e faz login nas seguintes
- [ ] Cidade inativa mostra mensagem "Sua cidade ainda não tem jogos — entre na lista de espera"
- [ ] Ao menos 1 esporte com nível é obrigatório antes de acessar a Home
- [ ] Erro de email duplicado exibe mensagem clara sem expor detalhes técnicos

---

### 6.2 Home — Descobrir jogos

**Tela:** lista de jogos abertos na cidade do usuário, ordenados por data.

**Filtros disponíveis:** esporte, data, nível/categoria, gender_type.

**Card de jogo mostra:** esporte, data/hora, local (nome do venue), vagas restantes, nível/categoria, badge "reservada" se `court_reserved = true`.

**Critérios de aceite:**
- [ ] Lista carrega jogos abertos futuros da cidade do usuário
- [ ] Filtros funcionam de forma combinada (AND)
- [ ] Jogo lotado (`vacancies_total` = participantes confirmados) aparece com badge "Lotado" e botão desabilitado
- [ ] Pull-to-refresh atualiza a lista
- [ ] Estado vazio ("Nenhum jogo encontrado") exibe CTA para criar jogo

---

### 6.3 Criar jogo

**Tela:** formulário em etapas (stepper).

**Etapa 1 — Esporte e formato:**
- Esporte (pré-selecionado pelo perfil do usuário se só tem 1)
- Tipo de jogo: misto / masculino / feminino (padrão: misto)
- Para tênis: formato simples/duplas

**Etapa 2 — Data, hora e local:**
- Data + hora (date/time picker)
- Venue (lista de venues da cidade do usuário, busca por nome)
- Quadra (lista filtrada pelo esporte, a partir do venue escolhido)
- Toggle "Quadra já reservada"

**Etapa 3 — Vagas e nível:**
- Vagas (sugerido pelo sistema, editável entre 2–12)
- Critério de nível/categoria (quem pode entrar)
- Notas opcionais

**Critérios de aceite:**
- [ ] Sistema sugere o número de vagas correto baseado em esporte + formato
- [ ] Data não pode ser no passado
- [ ] Criador é automaticamente adicionado como participante `confirmed`
- [ ] Após criar, usuário é direcionado para a tela de detalhe do jogo
- [ ] Jogo aparece imediatamente na lista de descoberta

---

### 6.4 Detalhe do jogo

**Tela:** informações completas do jogo + lista de participantes + chat.

**Seções:**
- Header: esporte, data, venue, status de vagas
- Lista de participantes com avatares e nomes
- Botão "Entrar no jogo" (se há vagas e o usuário é compatível) ou "Sair do jogo"
- Chat de grupo (WebSocket; mensagens em tempo real)

**Compatibilidade para entrar:** esporte deve estar no perfil do jogador + gênero compatível com `gender_type` + nível/categoria deve casar com os critérios `target_*` do jogo.

**Critérios de aceite:**
- [ ] Usuário incompatível (nível/gênero) vê o jogo mas não consegue entrar (botão desabilitado com explicação)
- [ ] Ao entrar, `game_participants` é inserido e `vacancies_filled` é recalculado
- [ ] Jogo muda para `status = 'full'` automaticamente quando todas as vagas são preenchidas
- [ ] Chat exibe mensagens anteriores ao entrar e recebe novas em tempo real
- [ ] Criador pode remover participante (muda status para `removed`)
- [ ] Participante pode sair do jogo (remove o registro) até 2h antes do horário

---

### 6.5 Confirmação de comparecimento

**Fluxo:** 30 minutos após o `scheduled_at` do jogo, o criador recebe notificação push: "O jogo aconteceu? Marque quem compareceu."

**Tela:** lista de participantes com toggle presente/ausente.

**Critérios de aceite:**
- [ ] Somente o criador pode marcar comparecimentos
- [ ] Após salvar, `game_participants.status` é atualizado para `attended` ou `absent`
- [ ] `game.status` muda para `completed`
- [ ] Taxa de comparecimento (% jogos que compareceu / jogos confirmados) é calculada e exibida no perfil

---

### 6.6 Notificações push

**Tipos implementados na Fase 1:**

| Tipo | Trigger | Destinatário |
|---|---|---|
| `game_match` | Novo jogo criado compatível com perfil do usuário | Jogadores com perfil compatível na mesma cidade |
| `player_joined` | Alguém entra no jogo | Criador do jogo |
| `game_full` | Jogo fecha (todas vagas preenchidas) | Todos os participantes |
| `game_reminder` | 2 horas antes do jogo | Todos os participantes confirmados |
| `attendance_request` | 30 min após horário do jogo | Criador do jogo |

**Regras de match para `game_match`:**
1. Usuário tem `player_sport_profiles` para o esporte do jogo
2. Usuário **não** é criador do jogo
3. `gender_type` compatível (mixed aceita qualquer gênero; male/female requer gênero correspondente)
4. Nível/categoria do usuário compatível com `target_*` do jogo (se definido)
5. Cidade do usuário = cidade do jogo (Fase 1); raio usado se `search_radius_km` foi customizado

**Critérios de aceite:**
- [ ] Push token é salvo no registro do usuário após permissão concedida no app
- [ ] `game_match` é enviado apenas para usuários compatíveis (não para o criador)
- [ ] Usuário com `notifications_enabled = false` não recebe nenhuma notificação
- [ ] Falhas de envio são registradas em `push_notifications_log.error` sem quebrar o fluxo

---

### 6.7 Perfil do jogador

**Tela:** dados pessoais + perfis esportivos + histórico de jogos + taxa de comparecimento.

**Seções:**
- Avatar + nome + cidade
- Esportes praticados com nível/categoria
- Métricas: jogos realizados, taxa de comparecimento (%)
- Histórico de jogos (paginado, mais recentes primeiro)
- Botão "Editar perfil"

**Critérios de aceite:**
- [ ] Taxa de comparecimento só é exibida se o usuário participou de pelo menos 3 jogos
- [ ] Perfil público é visível para outros usuários (sem dados sensíveis: sem email, sem push_token)
- [ ] Edição de perfil atualiza nome, avatar, cidade e perfis esportivos

---

### 6.8 Lista de espera

**Tela:** acessível na tela de cidade inativa durante o onboarding.

**Campos:** email (pré-preenchido se já cadastrado), cidade (texto livre), esporte preferido.

**Critérios de aceite:**
- [ ] Email + cidade são obrigatórios
- [ ] Confirmação visual após envio
- [ ] Entradas ficam em `waitlist_entries` para análise de expansão

---

### 6.9 Admin — Gestão de quadras

**Interface:** web (Next.js), acessível apenas para `role = 'admin'`.

**Funcionalidades:**
- Listar, criar, editar e desativar cidades
- Listar, criar, editar e desativar venues (com mapa para marcar coordenadas)
- Listar, criar, editar e desativar quadras por venue

**Critérios de aceite:**
- [ ] Rota protegida por autenticação + role admin
- [ ] Venue criado com coordenadas válidas (lat/long) é imediatamente disponível para criação de jogos
- [ ] Desativar venue não cancela jogos futuros — apenas oculta da lista para novos jogos

---

## 7. API — Endpoints principais

```
# Auth
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/google
GET    /auth/google/callback

# Users
GET    /users/me
PATCH  /users/me
GET    /users/:id          (perfil público)

# Sport Profiles
GET    /users/me/sport-profiles
POST   /users/me/sport-profiles
PATCH  /users/me/sport-profiles/:sport
DELETE /users/me/sport-profiles/:sport

# Location
GET    /users/me/location
PUT    /users/me/location

# Cities
GET    /cities             (lista cidades ativas)
GET    /cities/:id

# Venues & Courts
GET    /venues?cityId=&sport=
GET    /venues/:id
GET    /venues/:id/courts

# Games
GET    /games?sport=&cityId=&date=&category=&level=&genderType=
POST   /games
GET    /games/:id
PATCH  /games/:id          (criador: cancelar, atualizar notas)
POST   /games/:id/join
DELETE /games/:id/join     (sair do jogo)
GET    /games/:id/participants
POST   /games/:id/attendance  (criador: marcar comparecimentos)

# Messages (REST para histórico; WebSocket para realtime)
GET    /games/:id/messages?cursor=&limit=

# Notifications
PATCH  /users/me/push-token

# Waitlist
POST   /waitlist

# Admin
GET    /admin/cities
POST   /admin/cities
PATCH  /admin/cities/:id
POST   /admin/venues
PATCH  /admin/venues/:id
POST   /admin/venues/:id/courts
PATCH  /admin/courts/:id
```

---

## 8. WebSocket — Chat em tempo real

**Conexão:** `wss://api.domain/games/:id/ws?token=<accessToken>`

**Eventos do cliente → servidor:**
```json
{ "type": "message", "content": "Texto da mensagem" }
{ "type": "ping" }
```

**Eventos do servidor → cliente:**
```json
{ "type": "message", "id": "uuid", "userId": "uuid", "userName": "...", "content": "...", "createdAt": "iso" }
{ "type": "participant_joined", "userId": "uuid", "userName": "..." }
{ "type": "participant_left", "userId": "uuid" }
{ "type": "pong" }
```

**Autenticação:** access token validado no handshake. Conexão fechada se token inválido ou expirado.

---

## 9. Design system

Baseado no protótipo navegável (prototipo-app-raquete.html):

- **Tipografia:** Bricolage Grotesque (títulos/headings) + Archivo (corpo/texto)
- **Dois modos de interface:** Jogador e Professor (modo Professor fora do escopo da Fase 1 na implementação, mas estrutura de navegação deve prever)
- **Design tokens** ficam em `packages/ui/src/tokens.ts` — cores, espaçamentos, bordas, sombras
- **Componentes base** em `packages/ui/`: Button, Card, Input, Badge, Avatar, BottomNav, Modal

> **Importante:** quando o arquivo `prototipo-app-raquete.html` for adicionado ao repositório, ele é a fonte da verdade para paleta de cores, estilos de componentes e layout das telas. Todo componente implementado deve ser comparado visualmente com o protótipo.

---

## 10. Variáveis de ambiente

### `apps/api/.env`
```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
EXPO_ACCESS_TOKEN=        # para enviar push via Expo Push API
NODE_ENV=development
PORT=3001
```

### `apps/mobile/.env`
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### `apps/web/.env`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 11. Decisões de modelagem — justificativas

| Decisão | Justificativa |
|---|---|
| `PlayerSportProfile` com colunas nullable por esporte (não JSONB) | Permite queries tipadas e índices; validação de campos obrigatórios por esporte fica na camada de API |
| `coordinates` em `games` desnormalizado do venue | Permite query espacial direta em `games` sem join com `venues`; atualizado quando venue é associado |
| `city_id` em `games` como coluna explícita | Permite filtro por cidade sem PostGIS (caso padrão); PostGIS é ativado só quando raio customizado é usado |
| `vacancies_filled` não armazenado | Calculado como `COUNT(*) FROM game_participants WHERE game_id = ? AND status NOT IN ('removed', 'absent')` — evita inconsistência |
| Refresh tokens em tabela separada | Permite revogar sessões específicas e auditar acessos |
| `game_participants` inclui o criador | Simplifica queries de "jogos em que estou" e de confirmação de presença |
