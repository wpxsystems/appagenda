# Plano de Desenvolvimento — App de Esportes de Raquete

> Documento de planejamento para o time de desenvolvimento.
> Substitua `[Nome do App]` pelo nome definitivo do produto.
> Versão 1 — base de trabalho, deve ser revisada e ajustada pelo time.

---

## 1. Visão geral do produto

`[Nome do App]` é um aplicativo que conecta a comunidade de esportes de raquete (padel, tênis, beach tennis e, futuramente, outras modalidades). A função central é a **marcação de jogos**: um usuário cria um horário, escolhe a quadra e o sistema conecta esse jogo a jogadores de perfil compatível. Posteriormente, o app evolui para incluir agendamento de aulas (perfil profissional de professor) e campeonatos.

O produto tem quatro tipos de usuário: jogadores casuais (sem aula), alunos, professores e academias/clubes.

---

## 2. Princípios que guiam o plano

Estas decisões foram tomadas ao longo da concepção do produto e devem orientar todas as escolhas de implementação:

**O MVP é um único loop.** A primeira versão entrega apenas: *quero jogar → encontro ou crio um jogo → pessoas compatíveis entram → o jogo acontece → o app registra que aconteceu*. Tudo que não serve a esse ciclo fica para fases posteriores.

**Nada de monetizar o loop central.** Criar, buscar e entrar em jogos é gratuito e ilimitado, sempre. A receita anda por cima do valor já entregue, nunca como pedágio.

**O produto é agnóstico de cidade; o lançamento é focado.** Joinville é o piloto, mas nada de "Joinville" é codificado. Localização é tratada por geolocalização e raio de busca. A expansão é um processo repetível de seeding (cadastro de quadras + comunidade inicial), não uma mudança de código.

**Perfil por esporte.** Nível, categoria, lado da quadra e preferências variam por modalidade. O modelo de dados reflete isso desde o início — uma pessoa tem um "perfil esportivo" por esporte praticado, não um perfil único.

**Cadastro progressivo.** Pede-se o mínimo para a pessoa já usar o app; o restante é enriquecido depois, com incentivo claro ("complete o perfil para receber alertas automáticos").

**App mobile como superfície principal; web como complemento.** As notificações push são o coração do valor e funcionam melhor em app nativo. A web entra mais leve no início e ganha paridade depois.

---

## 3. Stack tecnológica recomendada

A escolha final é do time. Abaixo, uma recomendação pensada para velocidade de MVP, um time enxuto e bom encaixe com desenvolvimento assistido por Claude Code (uma linguagem dominante em toda a stack reduz fricção).

| Camada | Recomendação | Por quê |
|---|---|---|
| Mobile (iOS + Android) | React Native com Expo | Um código para as duas plataformas; Expo facilita push notifications, builds e OTA updates |
| Web | Next.js (React) | Mesmo modelo mental e componentes/tipos compartilháveis com o mobile |
| Monorepo | Turborepo ou Nx | Compartilha tipos, lógica de domínio e validações entre web, mobile e backend |
| Backend / BaaS | Supabase (Postgres gerenciado + Auth + Realtime + Storage) | Acelera muito o MVP; Realtime cobre o chat de jogo; entrega auth pronto |
| Banco de dados | PostgreSQL + extensão **PostGIS** | PostGIS é essencial: o match por raio geográfico (estratégia multicidade) depende de consultas espaciais eficientes |
| Notificações push | Expo Push Notifications (sobre FCM/APNs) | Integração direta com o app Expo |
| Pagamentos (Fase 2+) | Mercado Pago ou Stripe — **com suporte a PIX** | PIX é indispensável para o público brasileiro |
| Linguagem | TypeScript em toda a stack | Tipos compartilhados ponta a ponta; menos contexto para o Claude Code gerenciar |

Alternativa ao Supabase: um backend próprio em Node.js (NestJS ou Fastify) com Postgres+PostGIS, caso o time prefira controle total desde o início. Para o MVP, o Supabase tende a economizar semanas — a migração para backend próprio, se necessária, é uma decisão de fase posterior.

---

## 4. Arquitetura — decisões estruturais

**Geolocalização como conceito de primeira classe.** Toda quadra tem coordenadas (lat/long) e uma região associada. O match de jogos usa consultas de proximidade (PostGIS), com raio configurável — não filtro rígido por cidade. Um sistema único, filtrado por geografia; nunca instâncias separadas por cidade.

**Perfil esportivo por modalidade.** O perfil do usuário é um conjunto de registros `PlayerSportProfile`, um por esporte. Modelar assim desde o dia 1 evita uma migração cara depois.

**Diretório de quadras com cadastro administrativo.** As quadras são cadastradas manualmente por vocês no início (ferramenta de admin simples). É o trabalho operacional que "liga" cada cidade.

**Motor de alertas desacoplado.** A distribuição de um jogo recém-criado para jogadores compatíveis é um serviço próprio, baseado em regras de match (esporte, categoria, lado, disponibilidade, geografia). A diferença entre grátis e Pro é parâmetro desse serviço (atraso de entrega, granularidade dos filtros), não um caminho de código separado.

**Sempre respeitar filtro de compatibilidade e preferências de notificação.** Mesmo o "disparo instantâneo" do Pro pula apenas o atraso — nunca a relevância nem um opt-out do destinatário.

---

## 5. Modelo de dados (núcleo)

Esboço das entidades principais para a Fase 1. Refine com o time antes de implementar.

- **User** — dados de conta, autenticação, cidade/região base.
- **PlayerSportProfile** — `user_id`, `sport`, `category`, `skill_level`, `side_preference` (para padel/beach: esquerda/direita/ambos), `play_format` (para tênis: simples/duplas/ambos). Um registro por esporte praticado.
- **PlayerAvailability** — disponibilidade recorrente do usuário (dia da semana + faixa de horário) e quadras/regiões favoritas. Alimenta o match proativo.
- **Venue / Court** — local de jogo: coordenadas geográficas, região, esportes suportados. Cadastrado via admin.
- **Game** — `sport`, `datetime`, `court_id`, `creator_id`, `target_category`/`target_level`, `vacancies`, `court_reserved` (booleano), `status`.
- **GameParticipant** — `game_id`, `user_id`, `status` (inscrito / confirmado / compareceu / faltou). Base da taxa de comparecimento.
- **GameMessage** — chat de grupo por jogo.
- **AlertRule** — regras de alerta salvas do usuário (Fase 2 expande isso para o Pro).
- **WaitlistEntry** — cadastros de interesse de usuários fora das regiões ativas (dado para escolher a próxima cidade).

Entidades de fases posteriores: `TeacherProfile`, `Lesson`, `Subscription`, `Tournament`.

---

## 6. Como desenvolver com Claude Code

O Claude Code é um ambiente de desenvolvimento agêntico de linha de comando: ele lê arquivos, roda comandos e implementa mudanças de forma autônoma, em vez de só responder perguntas. Isso muda o fluxo de trabalho — em vez de escrever o código e pedir revisão, o time descreve o que quer e o Claude explora, planeja e implementa. O ponto a internalizar: **o resultado depende muito mais dos padrões de trabalho ao redor da ferramenta do que dos prompts em si.**

### 6.1 Instalação e setup inicial

O Claude Code é instalado via npm (pacote `@anthropic-ai/claude-code`) e roda no terminal; há também versões para IDE (VS Code, JetBrains), desktop e web. Cada desenvolvedor do time instala localmente. Consulte a documentação oficial para requisitos atualizados de Node.js e plataformas:

- Documentação: https://docs.claude.com/en/docs/claude-code/overview
- Boas práticas: https://code.claude.com/docs/en/best-practices

### 6.2 CLAUDE.md — o arquivo de contexto do projeto

O `CLAUDE.md` é lido pelo Claude no início de toda conversa. Rode `/init` na raiz do repositório para gerar uma versão inicial e refine ao longo do tempo. Inclua nele apenas o que o Claude **não conseguiria inferir lendo o código**: comandos de build e teste, convenções de estilo que fogem do padrão, regras de branch e PR, decisões arquiteturais específicas e variáveis de ambiente necessárias.

Mantenha-o **curto**. Um CLAUDE.md inchado faz o Claude ignorar metade das instruções, porque as regras importantes se perdem no ruído. Para cada linha, pergunte: "remover isto faria o Claude errar?" Se não, corte. Versione o arquivo no git para o time inteiro contribuir — o valor dele se acumula com o tempo.

Num monorepo, vale ter um `CLAUDE.md` na raiz e outros em subpastas (`apps/mobile/`, `apps/web/`, `packages/api/`) — o Claude carrega o da pasta em que está trabalhando.

### 6.3 Skills do projeto

Conhecimento de domínio que só é relevante às vezes não deve ir no CLAUDE.md (que é carregado sempre). Coloque em **skills**: arquivos `SKILL.md` dentro de `.claude/skills/`, que o Claude carrega sob demanda. Bons candidatos para este projeto: convenções da API REST, padrões de componentes do design system, regras de modelagem de dados, e fluxos repetíveis (por exemplo, "criar um novo endpoint seguindo nosso padrão").

### 6.4 O fluxo de quatro fases: explorar → planejar → implementar → revisar

Deixar o Claude pular direto para o código produz, com frequência, uma solução para o problema errado. Para qualquer tarefa que envolva múltiplos arquivos ou cuja abordagem não seja óbvia, use o **plan mode**:

1. **Explorar** — em plan mode, o Claude lê os arquivos relevantes e responde perguntas sem alterar nada.
2. **Planejar** — peça um plano de implementação detalhado. Revise e edite esse plano antes de prosseguir.
3. **Implementar** — saia do plan mode e deixe o Claude codar seguindo o plano.
4. **Commitar** — peça um commit com mensagem descritiva e a abertura do PR.

Para mudanças pequenas e de escopo claro (corrigir um typo, renomear uma variável), pule o planejamento e peça direto.

### 6.5 Desenvolvimento orientado a spec

Para features maiores — e várias deste roadmap são — use o padrão de **entrevista**. Comece com um prompt mínimo e peça ao Claude para entrevistar o time sobre implementação técnica, UX, casos de borda e tradeoffs, escrevendo no fim uma spec completa em `SPEC.md`. Depois, **abra uma sessão nova** para executar a spec — o contexto limpo, focado só na implementação, produz um resultado melhor.

Este documento de planejamento pode servir de insumo inicial para essas entrevistas, feature por feature.

### 6.6 Verificação — o ponto de maior alavancagem

A coisa de maior impacto que o time pode fazer: **dar ao Claude uma forma de verificar o próprio trabalho.** Sem critério de sucesso claro, ele produz algo que parece certo mas não funciona, e cada erro vira trabalho manual de vocês.

- Para lógica: forneça casos de teste esperados e peça para rodar a suíte após implementar.
- Para UI: cole um screenshot do design, peça para implementar, tirar um screenshot do resultado e comparar.
- Para bugs: descreva o sintoma, o local provável e o que "corrigido" significa; peça um teste que reproduz a falha antes da correção.

Regra de ouro do time: **se não dá para verificar, não faz deploy.**

### 6.7 MCP — conectar ferramentas externas

Com servidores MCP (`claude mcp add`), o Claude pode consultar o banco de dados, puxar issues do rastreador de tarefas (Linear, Jira) e integrar designs do Figma. Conecte os que fizerem sentido — mas com moderação: cada servidor consome contexto permanentemente, então mantenha poucos ativos por vez. Instale também a CLI do GitHub (`gh`) para que o Claude crie issues e PRs de forma eficiente.

### 6.8 Trabalho em equipe e sessões paralelas

Com um time, o Claude Code escala horizontalmente:

- **Git worktrees** — cada desenvolvedor (ou cada workstream) roda uma sessão isolada num checkout próprio, sem conflito de edições.
- **Padrão Escritor/Revisor** — uma sessão implementa a feature; outra sessão, com contexto limpo, revisa. O contexto fresco torna a revisão mais honesta, porque o Claude não fica enviesado pelo código que ele mesmo escreveu.
- **Subagentes** — para investigar partes do código sem poluir o contexto da conversa principal; rodam em contexto separado e devolvem só um resumo.
- **CI** — `claude -p "prompt"` roda em modo não-interativo, útil em pipelines (ex.: revisão automática de PR, checagem de lint).

Combine isso com o fluxo de PR normal do time: spec → plan mode → implementação → revisão (sessão nova ou subagente) → PR.

### 6.9 Gestão de contexto

O desempenho do Claude cai conforme o contexto enche. Hábitos do time:

- `/clear` entre tarefas não relacionadas — não acumule assuntos numa só sessão.
- Se você corrigiu o Claude duas vezes no mesmo ponto, o contexto está poluído com tentativas falhas: `/clear` e recomece com um prompt melhor, incorporando o que aprendeu.
- Escope investigações de forma estreita ou use subagentes.

### 6.10 Padrões de falha a evitar

- **Sessão "pia de cozinha"** — misturar tarefas sem relação numa só sessão. *Solução:* `/clear` entre tarefas.
- **Corrigir sem parar** — insistir na correção em contexto já poluído. *Solução:* após duas correções, `/clear` e prompt melhor.
- **CLAUDE.md inchado** — regras importantes se perdem. *Solução:* podar sem dó.
- **Confiar sem verificar** — implementação plausível que não trata casos de borda. *Solução:* sempre fornecer verificação.
- **Exploração infinita** — pedir "investigue X" sem escopo. *Solução:* escopo estreito ou subagentes.

---

## 7. Roadmap por fases

### Fase 0 — Fundações (antes de qualquer feature)

Objetivo: preparar o terreno para que o desenvolvimento das features flua.

- Decisões de stack travadas; monorepo criado.
- `CLAUDE.md` raiz e por app; skills iniciais do projeto; CLI do GitHub configurada.
- Pipeline de CI básico.
- Autenticação (cadastro, login).
- Modelo de dados central implementado (User, PlayerSportProfile, Venue, Game e relacionados), com PostGIS habilitado.
- Ferramenta de admin para cadastro de quadras.
- Fundamentos do design system / biblioteca de componentes.

### Fase 1 — MVP: o loop central (piloto em Joinville)

Objetivo: validar se o ciclo de marcar jogo fecha de forma recorrente numa cidade.

- Onboarding com cadastro progressivo (esportes; por esporte: nível, categoria, lado/formato; região; depois: disponibilidade recorrente e quadras favoritas).
- Criar jogo (esporte, data/hora, quadra, nível/categoria-alvo, número de vagas, quadra reservada ou não).
- Descobrir e buscar jogos (filtro geográfico por raio + filtros de esporte, data, nível/categoria).
- Entrar e sair de um jogo.
- Chat de grupo por jogo.
- Notificações push: alertas básicos de match (resumo periódico), aviso quando alguém entra no seu jogo, lembrete antes do horário.
- Confirmação de comparecimento pós-jogo + taxa de comparecimento no perfil.
- Lista de espera ("avise-me quando minha cidade tiver jogos") para usuários fora das regiões ativas.
- Lançamento focado em Joinville: seeding de quadras e de comunidade inicial via parceria com arenas/professores.

Critério de sucesso da fase: medir **densidade** (jogos ativos por semana na região, taxa de jogos que fecham com gente compatível), não número de downloads.

### Fase 2 — Monetização e plano Pro

Objetivo: introduzir receita sem desacelerar o crescimento da rede.

- Motor de alertas refinado: regras de alerta personalizáveis e buscas salvas.
- Plano Pro (~R$9,99/mês), com: alertas em tempo real e instantâneos, **vantagem de largada** (Pro é notificado antes; grátis recebe o mesmo alerta com atraso), filtros finos, buscas salvas, jogos recorrentes, **disparo instantâneo para o criador Pro** (colapsa o atraso e leva o jogo a todo o público compatível na hora — respeitando sempre relevância e opt-out), estatísticas e histórico de ranking.
- Integração de pagamento e assinatura (Mercado Pago/Stripe, com PIX).
- Controles de frequência de notificação para o usuário.

Lembrete estratégico: a assinatura do jogador é complemento, não o motor principal de receita.

### Fase 3 — Lado profissional

Objetivo: abrir a fonte de receita mais sólida — professores e academias.

- Perfil profissional de professor (página, agenda, gestão de alunos).
- Agendamento e reserva de aulas.
- Assinatura de perfil profissional para professores; destaque pago na busca.
- Funcionalidades SaaS básicas para academias.

### Fase 4 — Campeonatos e integração de reservas

- Criação e gestão de torneios; inscrições com taxa.
- Integração de reserva real de quadras com arenas parceiras.
- Espaço para patrocínio de marcas do nicho.

---

## 8. Primeiros passos concretos

Sugestão para as primeiras uma a duas semanas, antes de escrever código de feature:

1. **Travar a stack** com o time, decidindo Supabase vs. backend próprio.
2. **Criar o monorepo** e rodar `/init` para gerar os `CLAUDE.md` iniciais.
3. **Escrever a `SPEC.md` do modelo de dados** usando o padrão de entrevista do Claude Code — este documento serve de insumo. Revisar em equipe.
4. **Escrever a `SPEC.md` da Fase 1** (o loop central), feature por feature, da mesma forma.
5. Só então abrir sessões novas para implementar a Fase 0, usando o fluxo explorar → planejar → implementar → revisar.

Exemplo de como abrir a primeira spec com o Claude Code:

```
Quero modelar o banco de dados de um app de marcação de jogos de esportes
de raquete. Me entreviste em detalhe usando a ferramenta AskUserQuestion.
Pergunte sobre as entidades, relacionamentos, as consultas geográficas de
match, e os casos de borda que eu posso não ter considerado. Continue até
cobrirmos tudo e então escreva a spec completa em SPEC.md.
```

---

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| **Rede vazia** — usuário abre o app, não encontra jogo, não volta | Concentrar o seeding em Joinville; densidade antes de expansão; UI honesta + lista de espera para quem está fora |
| **Scope creep** — aulas e campeonatos invadirem o MVP | Disciplina de fases; aulas só na Fase 3, campeonatos na Fase 4 |
| **Confiar no Claude Code sem verificar** | Verificação obrigatória (testes/screenshots) em toda tarefa; padrão Escritor/Revisor nos PRs |
| **Vazamento para WhatsApp** | Chat de jogo bom desde o MVP; na Fase 3, manter o app valioso além da transação (agenda, gestão, pagamentos) |
| **Monetização cedo demais** | Não monetizar no MVP; começar a receita pelo lado profissional na Fase 3 |
| **Modelo de dados rígido** | Perfil por esporte e geolocalização como conceitos de primeira classe desde a Fase 0 |
| **Notificação em excesso** | Controles de frequência para o usuário; alertas sempre respeitam filtro de compatibilidade e opt-out |

---

*Documento vivo — revise ao fim de cada fase com o time e ajuste o roadmap conforme os aprendizados do piloto em Joinville.*
