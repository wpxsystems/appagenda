const { z } = require('zod');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { Jogo, Participacao, Venue, User, Notification, GameMessage, sequelize } = require('../models');
const AppError = require('../utils/AppError');

const createJogoSchema = z.object({
  sport:              z.enum(['padel', 'beach_tennis', 'tennis']),
  venue_id:           z.string().uuid().optional(),
  court_id:           z.string().uuid().optional(),
  cidade_id:          z.string().uuid(),
  scheduled_at:       z.string().datetime(),
  duration_minutes:   z.number().int().default(90),
  vacancies_total:    z.number().int().min(2).max(20),
  gender_type:        z.enum(['mixed', 'male', 'female']).default('mixed'),
  court_reserved:     z.boolean().default(false),
  notes:              z.string().max(500).optional(),
  target_category:    z.enum(['C', 'B', 'A', 'Open']).optional(),
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
      { model: Participacao, as: 'participacoes', attributes: ['id', 'user_id'] },
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
    target_category: j.target_category,
    target_skill_level: j.target_skill_level,
    target_side: j.target_side,
    notes: j.notes,
    venue_nome: j.venue?.nome ?? null,
    venue_endereco: j.venue?.endereco ?? null,
    creator_nome: j.creator?.nome ?? null,
    creator_id: j.creator_id,
    participant_count: j.participacoes?.length ?? 0,
    open_spots: j.vacancies_total - (j.participacoes?.length ?? 0),
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
  const jogo = await Jogo.create({ ...data, creator_id: req.auth.userId });
  await Participacao.create({ jogo_id: jogo.id, user_id: req.auth.userId });
  res.status(201).json(jogo);
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

  const otherParticipants = jogo.participacoes.filter((p) => p.user_id !== req.auth.userId);
  await Promise.all(otherParticipants.map((p) =>
    Notification.create({ user_id: p.user_id, type: 'game_cancelled', title, body, jogo_id: jogo.id }),
  ));

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
