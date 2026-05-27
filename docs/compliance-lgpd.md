# Compliance & LGPD — AppAgenda

> Lei Geral de Proteção de Dados — Lei nº 13.709/2018
> Aplica-se a todo sistema que trata dados pessoais de pessoas naturais no Brasil.
> Cumprimento é responsabilidade conjunta de produto, engenharia e empresa.

> **Atenção específica deste projeto:** AppAgenda trata **localização**, **fotos**, **conexões sociais entre usuários** e **dados infanto-juvenis** (se permitir cadastro abaixo de 18 anos). São categorias que exigem cuidados redobrados.

---

## 1. Papéis e responsabilidades

| Papel              | Quem                                                          | Responsabilidade                                 |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------ |
| **Controlador**    | WPX Systems Tecnologia Ltda (CNPJ: a registrar)               | Define finalidade e meios do tratamento de dados |
| **Operador**       | Hostinger (hosting), Expo (push), Google Maps, Cloudflare R2  | Tratam dados por conta do controlador            |
| **DPO/Encarregado**| lgpd@wpxsystems.com.br                                        | Recebe demandas dos titulares, responde à ANPD  |
| **Titular**        | Usuários do app + venues cadastrados                          | Exercem os direitos do Art. 18                   |

---

## 2. Bases legais utilizadas (Art. 7º)

| Base legal                       | Art. | Quando usamos                                                |
| -------------------------------- | ---- | ------------------------------------------------------------ |
| Execução de contrato           | V    | Operação do app (cadastro, jogos, perfil, notificações)   |
| Cumprimento de obrigação legal | II   | Logs de auditoria, retenção fiscal                         |
| Legítimo interesse              | IX   | Segurança, prevenção a fraude, recomendação de jogos     |
| Consentimento                    | I    | Localização, push, marketing por e-mail, cookies analíticos |

> **Atenção:** consentimento pode ser revogado a qualquer momento. Implementar mecanismo de revogação dentro do app (tela de Configurações → Privacidade).

---

## 3. Mapeamento de dados pessoais coletados

### 3.1 Dados do usuário (titular que se cadastra)

| Dado                       | Onde fica                          | Finalidade                | Base legal           |
| -------------------------- | ---------------------------------- | ------------------------- | -------------------- |
| Nome                       | `app_user.nome`                    | Identificação           | Contrato             |
| Apelido / nickname         | `app_user.nickname`                | Exibição social         | Contrato             |
| E-mail                     | `app_user.email`                   | Login, comunicação      | Contrato             |
| Senha (bcrypt)             | `app_user.password_hash`           | Autenticação            | Contrato             |
| Telefone                   | `app_user.phone`                   | Recuperação (opcional)  | Contrato             |
| Data de nascimento         | `app_user.data_nascimento`         | Validação idade         | Contrato             |
| Foto de perfil             | R2 + URL em `app_user.avatar_url`  | Exibição social         | Contrato             |
| Bio                        | `app_user.bio`                     | Exibição social         | Contrato             |
| Cidade                     | `app_user.cidade_id`               | Recomendações           | Contrato             |
| Nível em cada esporte     | `app_sport_profile.nivel`          | Matchmaking              | Contrato             |
| **Localização (GPS)**     | **memória, não persiste**         | Buscar jogos próximos   | **Consentimento**    |
| Push token (Expo)          | `app_user.push_token`              | Notificações            | Consentimento        |
| IP de acesso               | `app_audit_log.ip`                 | Segurança                | Legítimo interesse  |
| User agent + app version   | `app_audit_log.user_agent`         | Segurança + suporte     | Legítimo interesse  |
| Provider social (Apple/Google ID) | `app_oauth_account.provider_uid` | Login social        | Contrato             |

### 3.2 Dados relacionais entre usuários

| Dado                                 | Onde fica                         | Observação                                      |
| ------------------------------------ | --------------------------------- | ------------------------------------------------ |
| Lista de amigos / conexões          | `app_friendship`                  | Visível só entre os envolvidos                  |
| Histórico de jogos com outros        | `app_participacao`                | Quem jogou com quem                              |
| Mensagens diretas (se houver chat)   | `app_message`                     | Criptografar em trânsito; logar mínimo possível |
| Avaliações de outros jogadores      | `app_user_review`                 | Risco de abuso — moderação ativa                |

### 3.3 Dados de venues (quadras, clubes)

Venues geralmente são **pessoa jurídica** (não titulares LGPD), mas se o cadastro contém pessoa física do administrador, aplica-se LGPD para esses contatos.

### 3.4 Dados que NÃO devemos coletar

- ❌ CPF/RG (não precisamos para o uso do app)
- ❌ Dados de saúde, mesmo que relacionados a esporte (sensível — Art. 11)
- ❌ Localização em background (NÃO usar `ACCESS_BACKGROUND_LOCATION` nem `Always` no iOS)
- ❌ Dados bancários completos (se houver pagamento, delegar a gateway PCI-DSS)
- ❌ Orientação sexual, política, religião — irrelevante para o app

### 3.5 Menores de idade

> **Decisão crítica:** se permitir cadastro abaixo de 18 anos, é necessário **consentimento dos pais/responsáveis** (Art. 14). Recomendação: idade mínima **16 anos** no cadastro, com declaração + e-mail de notificação ao responsável.

Abaixo de 13 anos: **proibido** pela App Store + Play Store sem fluxo COPPA dedicado.

---

## 4. Geolocalização — cuidados específicos

A localização é tratamento de **dado sensível por proxy** (revela rotina, casa, trabalho). Regras obrigatórias:

| Regra                                                                              | Implementação                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Pedir permissão **apenas quando o usuário acessa a tela "Jogos Próximos"**      | `expo-location` com `requestForegroundPermissionsAsync` |
| Usar **somente "while in use"**, nunca "always"                                    | `accuracy: Location.Accuracy.Balanced`                 |
| **Não persistir** coordenadas exatas do usuário no banco                          | Manter só em memória; persistir só cidade_id           |
| Para outros usuários, mostrar **distância arredondada** (1km, 5km, 10km, 20km+)    | Calcular no backend, retornar bucket                   |
| Permitir o usuário **escolher um "raio de busca" fixo** sem GPS                    | Modo "fallback por cidade"                             |
| Excluir histórico de queries de localização do `app_audit_log` após **30 dias**   | Cron job                                               |

```js
// Service de busca — exemplo de bucketização de distância
exports.buscarProximos = async (userId, { lat, lng, raio_km }) => {
  const rows = await sequelize.query(/* ... */);
  return rows.map((r) => ({
    ...r,
    distancia_km: undefined,
    distancia_bucket: bucketDistancia(r.distancia_km),
  }));
};

function bucketDistancia(km) {
  if (km < 1)  return 'menos_de_1km';
  if (km < 5)  return 'ate_5km';
  if (km < 10) return 'ate_10km';
  if (km < 20) return 'ate_20km';
  return 'mais_de_20km';
}
```

---

## 5. Direitos do titular (Art. 18)

Todos os direitos devem ser atendidos em até **15 dias**. Implementar auto-serviço dentro do app:

| Direito                             | Como implementar                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Confirmação do tratamento         | `GET /api/v1/auth/me` — confirma dados em tratamento                         |
| Acesso aos dados                    | `GET /api/v1/me/export` — JSON com todos os dados do usuário (envia por e-mail) |
| Correção                          | Tela "Editar Perfil" + edição de dados em "Configurações"                  |
| Anonimização/exclusão           | Tela "Excluir Conta" → soft delete + e-mail de confirmação; hard delete em 30 dias |
| Portabilidade                       | `GET /api/v1/me/export` — JSON estruturado                                   |
| Informação sobre compartilhamento | Tela "Política de Privacidade" no app                                       |
| Revogação de consentimento        | Tela "Configurações → Privacidade" — toggles individuais                  |
| Oposição                          | Canal: lgpd@wpxsystems.com.br                                                 |

### 5.1 Fluxo de exclusão de conta (obrigatório na App Store desde 2022)

> **App Store Guideline 5.1.1(v):** se o app permite criar conta, **deve permitir excluir conta dentro do próprio app**, não só por e-mail.

```
1. Usuário acessa "Configurações → Excluir conta"
2. Pede senha de novo (re-autenticação)
3. Mostra resumo do que será excluído (LGPD: transparência)
4. POST /api/v1/me/delete → gravar deleted_at = now() no usuário + tenant
5. Logout imediato em todos os devices (invalidar refresh tokens)
6. E-mail de confirmação com link de retratação (30 dias)
7. Cron job diário: hard delete de registros com deleted_at < now() - 30 dias
   - Ordem: participações → mensagens → reviews → friendships → user → tenant
8. Logar a exclusão em app_audit_log (sem dados pessoais, apenas IDs e timestamp)
9. Manter log de auditoria por 5 anos (obrigação legal)
```

### 5.2 Exportação de dados

```js
exports.exportarDados = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const dados = await meService.exportar(userId);
  // Envia por e-mail em até 15 dias (Art. 19)
  await emailService.enviarExport(req.auth.email, dados);
  res.json({ success: true, message: 'Exportação solicitada — verifique seu e-mail' });
});
```

---

## 6. Retenção de dados

| Categoria de dado                            | Prazo de retenção                       | Justificativa                          |
| -------------------------------------------- | --------------------------------------- | -------------------------------------- |
| Dados operacionais (perfil, jogos, amigos)   | Enquanto conta ativa                    | Execução de contrato                 |
| Após pedido de exclusão                    | 30 dias (soft delete)                   | Direito de retratação                |
| Logs de auditoria (`app_audit_log`)          | 5 anos                                  | LGPD Art. 16 — prevenção a fraude   |
| Coordenadas GPS no audit log                 | 30 dias                                 | Minimização (sensível)              |
| Backups de banco                             | 30 dias                                 | Recuperação de desastre              |
| Tokens de refresh expirados                  | Deletar imediatamente após expiração   | Minimização                           |
| Push tokens inválidos                       | Deletar ao receber `DeviceNotRegistered`| Minimização + custo                  |
| Mensagens diretas                            | 1 ano + soft delete                     | Equilíbrio entre histórico e privacidade |
| Imagens de perfil deletadas                  | 7 dias (no R2)                          | Possível desfazer                     |

---

## 7. Segurança dos dados (Art. 46)

Resumo — detalhamento completo em [security.md](security.md).

- Senhas com bcrypt 12 rounds
- HTTPS obrigatório (TLS 1.2+)
- Banco não exposto publicamente
- JWT curto + refresh rotativo
- RLS no PostgreSQL
- Rate limiting
- Audit log com hash encadeado
- Backups criptografados
- Acesso de admin com 2FA

---

## 8. Incidente de segurança

**Prazo legal:** notificar ANPD e titulares afetados em até **72 horas** após conhecimento.

### Protocolo

```
1. Detectar e isolar — revogar acessos, preservar evidências
2. Avaliar impacto — quais dados, quantos titulares, risco
3. Notificar internamente (DPO, direção) — dentro de 2h
4. Notificar ANPD via peticionamento.anpd.gov.br — dentro de 72h
5. Notificar titulares afetados — push + e-mail individual
6. Relatório pós-incidente — causa raiz, correções, lições aprendidas
```

### Conteúdo da notificação à ANPD

- Descrição do incidente
- Categorias e quantidade de dados afetados
- Medidas de mitigação
- Contato do DPO

---

## 9. Permissões nas stores — declarações obrigatórias

### 9.1 App Store (App Privacy Labels)

No App Store Connect, declarar (mínimo):

| Categoria             | Coletado? | Linkado ao usuário? | Usado para tracking? |
| --------------------- | --------- | ------------------- | -------------------- |
| Contact Info (e-mail) | Sim       | Sim                 | Não                 |
| Identifiers (User ID) | Sim       | Sim                 | Não                 |
| Location (Coarse)     | Sim       | Não                 | Não                 |
| Photos                | Sim       | Sim                 | Não                 |
| User Content (perfil) | Sim       | Sim                 | Não                 |
| Diagnostics (crash)   | Sim       | Não                 | Não                 |

### 9.2 Play Console (Data Safety form)

Equivalente Android — mesma lógica. Declarar todas as coletas.

### 9.3 Permissões iOS (`Info.plist` / `app.json`)

```jsonc
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Usamos sua localização apenas para mostrar jogos próximos. Você pode revogar a qualquer momento nas Configurações do iOS.",
        "NSCameraUsageDescription": "Para você adicionar uma foto de perfil ou foto da quadra.",
        "NSPhotoLibraryUsageDescription": "Para você escolher uma foto da galeria como avatar.",
        "NSPhotoLibraryAddUsageDescription": "Para salvar resultados de jogos na galeria (opcional)."
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "POST_NOTIFICATIONS"
      ]
    }
  }
}
```

> **NUNCA usar permissões que não usa.** A Apple rejeita revisão com base nisso.

---

## 10. Cookies e rastreamento (web admin)

| Cookie                | Tipo                 | Base legal           | TTL               |
| --------------------- | -------------------- | -------------------- | ----------------- |
| `refresh_token`       | Essencial (httpOnly) | Contrato             | 30 dias           |
| `theme`               | Preferência         | Legítimo interesse  | 1 ano             |
| Analytics (PostHog/Plausible) | Não-essencial | Consentimento        | 90 dias           |

- Banner de consentimento obrigatório para cookies não-essenciais
- Recusar tão fácil quanto aceitar
- Mobile não usa cookies — sem banner

---

## 11. Subprocessadores (terceiros que recebem dados)

| Fornecedor             | Dado compartilhado            | Finalidade                  | DPA?    |
| ---------------------- | ----------------------------- | --------------------------- | ------- |
| Hostinger              | Todos (hospedagem)            | Servidor + banco            | Sim     |
| Expo (EAS + Push)      | Push token, e-mail            | Notificações + build       | Sim     |
| Apple (Sign in + Push) | Apple ID                      | Login + APNs                | DPA padrão Apple |
| Google (Sign in + FCM) | Google ID                     | Login + push                | DPA padrão Google |
| Cloudflare (R2/CDN)    | Imagens (avatar, venue)       | Storage + entrega          | Sim     |
| Sentry (se usar)       | Crash logs (sem PII)          | Monitoramento de erros      | Sim     |
| SMTP (Gmail/SendGrid)  | E-mail                        | E-mails transacionais       | Sim     |

> Verificar DPA assinado/disponível para cada fornecedor — alguns são automáticos (Apple, Google), outros precisam aceitar Terms.

---

## 12. Documentos obrigatórios

Publicar antes do lançamento:

- ✅ **Política de Privacidade** — URL fixa (ex.: `appagenda.wpxsystems.com.br/privacidade`) referenciada na App Store e Play Console
- ✅ **Termos de Uso** — incluindo regras de conduta entre usuários
- ✅ **Política de Cookies** — só na web admin
- ✅ **Canal LGPD** — e-mail `lgpd@wpxsystems.com.br` + formulário no app
- ✅ **Política de Moderação** — como denunciar usuário, prazos de resposta (importante para review da App Store)

---

## 13. Moderação de conteúdo

App social → **App Store Guideline 1.2** exige mecanismo de denúncia + bloqueio + moderação 24h.

| Recurso obrigatório                       | Implementação                                       |
| ----------------------------------------- | --------------------------------------------------- |
| Denunciar usuário                         | Botão em todo perfil → `POST /api/v1/reports`     |
| Bloquear usuário                          | Lista em "Configurações → Bloqueados"            |
| Filtro de palavrões                       | `bad-words` ou OpenAI Moderation API                |
| Revisão de denúncias em até 24h          | Painel admin web                                    |
| Suspender/banir contas                    | Campo `status` em `app_user` (`active`, `suspended`, `banned`) |

---

## 14. Checklist LGPD por feature

Antes de qualquer PR que colete ou processe dados pessoais:

- [ ] Dado mapeado na tabela da seção 3 deste documento
- [ ] Base legal definida (não usar consentimento se contrato resolve)
- [ ] Dado pessoal de terceiro? Garantir exclusão em cascata
- [ ] Campo sensível (saúde, biometria)? Base legal Art. 11 aplicada
- [ ] Dado retido apenas pelo prazo necessário (tabela seção 6)
- [ ] Não logamos o dado em texto claro em `app_audit_log`
- [ ] Campo opcional realmente é opcional
- [ ] Direito de acesso, exportação e exclusão contemplam o novo dado
- [ ] Se localização: regras da seção 4 aplicadas
- [ ] Se foto: armazenamento em R2 + redimensionamento + deleção em 7 dias após apagar
- [ ] Se nova permissão mobile: descrição clara no `Info.plist` (motivo real)
- [ ] App Privacy Labels (App Store) atualizadas
- [ ] Data Safety form (Play Console) atualizado
