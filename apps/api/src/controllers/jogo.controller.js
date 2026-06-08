const { z } = require('zod');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { Jogo, Participacao, Venue, User, Notification, GameMessage, SportProfile, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const withUserCtx = require('../utils/withUserCtx');

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

async function notifyMatchingUsers(jogo, creatorId) {
  try {
    const gameDate = new Date(jogo.scheduled_at);
    const dayKey = DAY_KEYS[gameDate.getDay()];
    const gameMin = gameDate.getHours() * 60 + gameDate.getMinutes();
    const sportLabel = { padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis' };

    const users = await User.findAll({
      where: { id: { [Op.ne]: creatorId }, cidade_id: jogo.cidade_id, status: 'active' },
      include: [{ model: SportProfile, as: 'sportProfiles', where: { sport: jogo.sport }, required: true }],
      attributes: ['id', 'availability_json'],
    });

    const matched = users.filter(u => {
      if (!u.availability_json) return true;
      try {
        const avail = JSON.parse(u.availability_json);
        const day = avail[dayKey];
        if (!day?.active) return false;
        const slots = day.slots?.length ? day.slots : [{ from: day.from ?? '00:00', to: day.to ?? '23:59' }];
        return slots.some(s => {
          const [fh, fm] = s.from.split(':').map(Number);
          const [th, tm] = s.to.split(':').map(Number);
          return gameMin >= fh * 60 + fm && gameMin < th * 60 + tm;
        });
      } catch { return false; }
    });

    const date = gameDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    await Promise.all(matched.map(u =>
      withUserCtx(u.id, t =>
        Notification.create({
          user_id: u.id,
          type: 'new_game_match',
          title: 'Novo jogo no seu horário!',
          body: `Jogo de ${sportLabel[jogo.sport] ?? jogo.sport} disponível ${date} às ${gameDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Veja se encaixa na sua agenda.`,
          jogo_id: jogo.id,
        }, { transaction: t })
      ).catch(() => {})
    ));
  } catch (e) {
    console.warn('[notifyMatchingUsers] erro:', e?.message);
  }
}

const createJogoSchema = z.object({
  sport:              z.enum(['padel', 'beach_tennis', 'tennis']),
  venue_id:           z.string().uuid().optional(),
  court_id:           z.string().uuid().optional(),
  cidade_id:          z.string().uuid(),
  scheduled_at:       z.string().datetime(),
  duration_minutes:   z.number().int().default(90),
  vacancies_total:    z.number().int().min(2).max(20),
  gender_type:        z.enum(['mixed', 'male', 'female']).default('mixed'),
  court_reserved:           z.boolean().default(false),
  court_price_per_person:   z.number().positive().optional(),
  notes:              z.string().max(500).optional(),
  target_categories:  z.array(z.enum(['C', 'B', 'A', '8a', '7a', '6a', '5a', '4a', '3a', '2a', 'Open'])).max(4).optional(),
  target_category:    z.enum(['C', 'B', 'A', '8a', '7a', '6a', '5a', '4a', '3a', '2a', 'Open']).optional(),
  target_skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'competitive']).optional(),
  target_side:        z.enum(['left', 'right', 'both']).optional(),
  target_play_format: z.enum(['singles', 'doubles', 'both']).optional(),
});

exports.list = asyncHandler(async (req, res) => {
  const { cidade_id, sport, status = 'open' } = req.query;
  const where = {
    status,
    scheduled_at: { [Op.gte]: new Date() },
  };
  if (cidade_id) where.cidade_id = cidade_id;
  if (sport) where.sport = sport;

  const jogos = await Jogo.findAll({
    where,
    include: [
      { model: Venue, as: 'venue', attributes: ['nome', 'endereco'] },
      { model: User, as: 'creator', attributes: ['nome'] },
      { model: Participacao, as: 'participacoes', attributes: ['id', 'user_id'], include: [{ model: User, as: 'user', attributes: ['id', 'nome', 'avatar_url'] }] },
    ],
    order: [['scheduled_at', 'ASC']],
    limit: 50,
  });

  res.json(jogos.map((j) => ({
    id: j.id,
    sport: j.sport,
    scheduled_at: j.scheduled_at,
    duration_minutes: j.duration_minutes,
    vacancies_total: j.vacancies_total,
    status: j.status,
    court_reserved: j.court_reserved,
    court_price_per_person: j.court_price_per_person ? Number(j.court_price_per_person) : null,
    target_categories: j.target_categories ?? [],
    target_category: j.target_category,
    target_skill_level: j.target_skill_level,
    target_play_format: j.target_play_format,
    target_side: j.target_side,
    gender_type: j.gender_type,
    notes: j.notes,
    venue_nome: j.venue?.nome ?? null,
    venue_endereco: j.venue?.endereco ?? null,
    creator_id: j.creator_id,
    participant_count: j.participacoes?.length ?? 0,
    open_spots: j.vacancies_total - (j.participacoes?.length ?? 0),
    participants: (j.participacoes ?? []).map((p) => ({
      id: p.user_id,
      nome: p.user?.nome ?? '',
      avatar_url: p.user?.avatar_url ?? null,
    })),
  })));
});

exports.getById = asyncHandler(async (req, res) => {
  const jogo = await Jogo.findByPk(req.params.id, {
    include: [
      { model: Venue, as: 'venue', attributes: ['nome', 'endereco'] },
      { model: User, as: 'creator', attributes: ['nome'] },
      { model: Participacao, as: 'participacoes', include: [{ model: User, as: 'user', attributes: ['id', 'nome', 'avatar_url'] }] },
    ],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);

  const userId = req.auth?.userId;
  const is_creator = jogo.creator_id === userId;
  const already_joined = jogo.participacoes?.some((p) => p.user_id === userId) ?? false;

  res.json({
    ...jogo.toJSON(),
    is_creator,
    already_joined,
  });
});

exports.create = asyncHandler(async (req, res) => {
  const data = createJogoSchema.parse(req.body);
  if (data.target_categories?.length) {
    data.target_category = data.target_categories[0];
  }
  const jogo = await Jogo.create({ ...data, creator_id: req.auth.userId });
  await Participacao.create({ jogo_id: jogo.id, user_id: req.auth.userId });
  res.status(201).json(jogo);
  // Fire-and-forget: notifica usuários com perfil compatível
  notifyMatchingUsers(jogo, req.auth.userId);
});

exports.join = asyncHandler(async (req, res) => {
  const jogo = await Jogo.findByPk(req.params.id, {
    include: [{ model: Participacao, as: 'participacoes' }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  if (jogo.status !== 'open') throw new AppError('Jogo não está aberto', 409);
  if (jogo.participacoes.length >= jogo.vacancies_total) throw new AppError('Jogo lotado', 409);
  const existing = jogo.participacoes.find((p) => p.user_id === req.auth.userId);
  if (existing) throw new AppError('Você já está neste jogo', 409);

  await Participacao.create({ jogo_id: jogo.id, user_id: req.auth.userId });

  // Notifica o criador que alguém entrou
  try {
    const joiningUser = await User.findByPk(req.auth.userId, { attributes: ['nome'] });
    const sportLabel = { padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis' };
    const date = new Date(jogo.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    await withUserCtx(jogo.creator_id, t =>
      Notification.create({
        user_id: jogo.creator_id,
        type: 'player_joined',
        title: 'Novo jogador no seu jogo!',
        body: `${joiningUser?.nome ?? 'Um jogador'} entrou no seu jogo de ${sportLabel[jogo.sport] ?? jogo.sport} de ${date}.`,
        jogo_id: jogo.id,
      }, { transaction: t })
    );
  } catch { /* falha silenciosa */ }

  res.status(201).json({ ok: true });
});

exports.cancel = asyncHandler(async (req, res) => {
  const jogo = await Jogo.findByPk(req.params.id, {
    include: [{ model: Participacao, as: 'participacoes' }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  if (jogo.creator_id !== req.auth.userId) throw new AppError('Apenas o criador pode cancelar', 403);
  if (jogo.status === 'cancelled') throw new AppError('Jogo já cancelado', 409);

  await jogo.update({ status: 'cancelled' });

  const sportLabel = { padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis' };
  const date = new Date(jogo.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const title = 'Jogo cancelado';
  const body = `O jogo de ${sportLabel[jogo.sport] ?? jogo.sport} de ${date} foi cancelado pelo organizador`;

  // RLS: Notification cross-user — usa withUserCtx do destinatário pra passar WITH CHECK
  const otherParticipants = jogo.participacoes.filter((p) => p.user_id !== req.auth.userId);
  await Promise.all(otherParticipants.map((p) =>
    withUserCtx(p.user_id, (t) =>
      Notification.create(
        { user_id: p.user_id, type: 'game_cancelled', title, body, jogo_id: jogo.id },
        { transaction: t }
      )
    )
  ));

  res.json({ ok: true });
});

exports.confirm = asyncHandler(async (req, res) => {
  const jogo = await Jogo.findByPk(req.params.id, {
    include: [{ model: Participacao, as: 'participacoes' }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  if (jogo.creator_id !== req.auth.userId) throw new AppError('Apenas o organizador pode confirmar', 403);
  if (jogo.status === 'completed') throw new AppError('Jogo já confirmado', 409);
  if (jogo.status === 'cancelled') throw new AppError('Jogo cancelado não pode ser confirmado', 409);
  if (new Date(jogo.scheduled_at) > new Date()) throw new AppError('Jogo ainda não ocorreu', 409);

  await jogo.update({ status: 'completed' });

  // Atualiza stats de todos os participantes
  const userIds = jogo.participacoes.map(p => p.user_id);
  await User.increment({ games_played: 1, games_attended: 1 }, { where: { id: userIds } });
  await Participacao.update({ status: 'attended' }, { where: { jogo_id: jogo.id } });

  // Notifica participantes
  const sportLabel = { padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis' };
  const date = new Date(jogo.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const others = jogo.participacoes.filter(p => p.user_id !== req.auth.userId);
  await Promise.all(others.map(p =>
    withUserCtx(p.user_id, t =>
      Notification.create({
        user_id: p.user_id,
        type: 'game_completed',
        title: 'Jogo confirmado!',
        body: `Seu jogo de ${sportLabel[jogo.sport] ?? jogo.sport} de ${date} foi confirmado. Suas estatísticas foram atualizadas.`,
        jogo_id: jogo.id,
      }, { transaction: t })
    ).catch(() => {})
  ));

  res.json({ ok: true });
});

exports.leave = asyncHandler(async (req, res) => {
  const jogo = await Jogo.findByPk(req.params.id, {
    include: [{ model: Participacao, as: 'participacoes' }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  if (jogo.creator_id === req.auth.userId) throw new AppError('O organizador não pode sair do próprio jogo', 403);
  if (jogo.status === 'cancelled') throw new AppError('Jogo já cancelado', 409);

  const participation = jogo.participacoes.find((p) => p.user_id === req.auth.userId);
  if (!participation) throw new AppError('Você não está neste jogo', 404);

  await participation.destroy();

  // Notifica o organizador — falha silenciosa para não quebrar o fluxo principal
  try {
    const leavingUser = await User.findByPk(req.auth.userId, { attributes: ['nome'] });
    const sportLabel = { padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis' };
    const date = new Date(jogo.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    await withUserCtx(jogo.creator_id, (t) =>
      Notification.create(
        {
          user_id: jogo.creator_id,
          type: 'player_left',
          title: 'Jogador saiu da partida',
          body: `${leavingUser?.nome ?? 'Um jogador'} saiu do seu jogo de ${sportLabel[jogo.sport] ?? jogo.sport} de ${date}`,
          jogo_id: jogo.id,
        },
        { transaction: t }
      )
    );
  } catch (notifErr) {
    console.warn('[leave] falha ao criar notificação:', notifErr?.message);
  }

  res.json({ ok: true });
});

exports.getMessages = asyncHandler(async (req, res) => {
  const jogo = await Jogo.findByPk(req.params.id, {
    include: [{ model: Participacao, as: 'participacoes', attributes: ['user_id'] }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  const isMember = jogo.participacoes?.some((p) => p.user_id === req.auth.userId);
  if (!isMember) throw new AppError('Você não é participante deste jogo', 403);

  const messages = await GameMessage.findAll({
    where: { jogo_id: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'nome'] }],
    order: [['created_at', 'ASC']],
    limit: 100,
  });
  res.json(messages);
});

exports.createMessage = asyncHandler(async (req, res) => {
  const { content } = req.body ?? {};
  if (!content?.trim()) throw new AppError('Conteúdo obrigatório', 400);

  const jogo = await Jogo.findByPk(req.params.id, {
    include: [{ model: Participacao, as: 'participacoes', attributes: ['user_id'] }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  const isMember = jogo.participacoes?.some((p) => p.user_id === req.auth.userId);
  if (!isMember) throw new AppError('Você não é participante deste jogo', 403);

  const message = await GameMessage.create({ jogo_id: jogo.id, user_id: req.auth.userId, content: content.trim() });
  res.status(201).json(message);
});
