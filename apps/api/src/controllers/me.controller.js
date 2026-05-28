const { z } = require('zod');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { User, SportProfile, Jogo, Participacao, Venue, UserLocation, Cidade, sequelize } = require('../models');
const AppError = require('../utils/AppError');

const availabilitySchema = z.record(
  z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']),
  z.object({ active: z.boolean(), from: z.string(), to: z.string() }).optional(),
);

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.auth.userId, {
    attributes: { exclude: ['password_hash', 'deleted_at'] },
  });
  if (!user) throw new AppError('Usuário não encontrado', 404);
  const availability = user.availability_json ? JSON.parse(user.availability_json) : null;
  res.json({ ...user.toJSON(), availability });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const { nome, avatar_url, bio, push_token, notifications_enabled } = req.body ?? {};
  const user = await User.findByPk(req.auth.userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  if (nome?.trim()?.length >= 2) user.nome = nome.trim();
  if (avatar_url !== undefined) user.avatar_url = avatar_url;
  if (bio !== undefined) user.bio = bio;
  if (push_token !== undefined) user.push_token = push_token;
  if (notifications_enabled !== undefined) user.notifications_enabled = notifications_enabled;

  await user.save();
  res.json({ id: user.id, nome: user.nome, avatar_url: user.avatar_url });
});

exports.getAvailability = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.auth.userId, { attributes: ['availability_json'] });
  if (!user) throw new AppError('Usuário não encontrado', 404);
  res.json(user.availability_json ? JSON.parse(user.availability_json) : {});
});

exports.updateAvailability = asyncHandler(async (req, res) => {
  const data = availabilitySchema.parse(req.body);
  await User.update({ availability_json: JSON.stringify(data) }, { where: { id: req.auth.userId } });
  res.json(data);
});

exports.getSportProfiles = asyncHandler(async (req, res) => {
  const profiles = await SportProfile.findAll({ where: { user_id: req.auth.userId } });
  res.json(profiles);
});

exports.createSportProfile = asyncHandler(async (req, res) => {
  const { sport, category, side_preference, skill_level, play_format } = req.body ?? {};
  const validSports = ['padel', 'beach_tennis', 'tennis'];
  if (!validSports.includes(sport)) throw new AppError('Esporte inválido', 400);

  const existing = await SportProfile.findOne({ where: { user_id: req.auth.userId, sport } });
  if (existing) throw new AppError('Perfil para este esporte já existe', 409);

  const profile = await SportProfile.create({
    user_id: req.auth.userId, sport, category, side_preference, skill_level, play_format,
  });
  res.status(201).json(profile);
});

exports.updateSportProfile = asyncHandler(async (req, res) => {
  const { sport } = req.params;
  const profile = await SportProfile.findOne({ where: { user_id: req.auth.userId, sport } });
  if (!profile) throw new AppError('Perfil não encontrado', 404);

  const { category, side_preference, skill_level, play_format } = req.body ?? {};
  await profile.update({ category, side_preference, skill_level, play_format });
  res.json(profile);
});

exports.getLocation = asyncHandler(async (req, res) => {
  const loc = await UserLocation.findOne({
    where: { user_id: req.auth.userId },
    include: [{ model: Cidade, as: 'cidade', attributes: ['id', 'nome', 'estado'] }],
  });
  if (!loc) throw new AppError('Localização não definida', 404);
  res.json({ cidade_id: loc.cidade_id, nome: loc.cidade?.nome, estado: loc.cidade?.estado });
});

exports.updateLocation = asyncHandler(async (req, res) => {
  const { cidade_id } = req.body ?? {};
  if (!cidade_id) throw new AppError('cidade_id obrigatório', 400);

  const cidade = await Cidade.findByPk(cidade_id);
  if (!cidade) throw new AppError('Cidade não encontrada', 404);

  await UserLocation.upsert({ user_id: req.auth.userId, cidade_id });
  res.json({ cidade_id, nome: cidade.nome, estado: cidade.estado });
});

exports.getMyGames = asyncHandler(async (req, res) => {
  const participacoes = await Participacao.findAll({
    where: { user_id: req.auth.userId },
    include: [{
      model: Jogo,
      as: 'jogo',
      include: [{ model: Venue, as: 'venue', attributes: ['nome', 'endereco'] }],
    }],
    order: [[{ model: Jogo, as: 'jogo' }, 'scheduled_at', 'ASC']],
  });

  const jogos = participacoes.map((p) => {
    const j = p.jogo;
    return {
      id: j.id,
      sport: j.sport,
      scheduled_at: j.scheduled_at,
      duration_minutes: j.duration_minutes,
      vacancies_total: j.vacancies_total,
      status: j.status,
      court_reserved: j.court_reserved,
      venue_nome: j.venue?.nome ?? null,
      venue_endereco: j.venue?.endereco ?? null,
      creator_id: j.creator_id,
      is_creator: j.creator_id === req.auth.userId,
    };
  });

  res.json(jogos);
});
