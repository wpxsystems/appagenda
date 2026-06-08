const { z } = require('zod');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { User, SportProfile, Jogo, Participacao, Venue, UserLocation, Cidade, GameRating, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const withUserCtx = require('../utils/withUserCtx');

const timeSlotSchema = z.object({ from: z.string(), to: z.string() });
const availabilitySchema = z.record(
  z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']),
  z.object({
    active: z.boolean(),
    // suporta múltiplos slots ou formato legado (from/to direto)
    slots: z.array(timeSlotSchema).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
);

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.auth.userId, {
    attributes: { exclude: ['password_hash', 'deleted_at'] },
  });
  if (!user) throw new AppError('Usuário não encontrado', 404);
  const availability = user.availability_json ? JSON.parse(user.availability_json) : null;

  // Estatísticas de avaliações recebidas
  const received = await GameRating.findAll({
    where: { rated_user_id: req.auth.userId },
    attributes: ['score', 'badges'],
  });

  let avg_score = null;
  const badgeCounts = {};
  if (received.length > 0) {
    avg_score = Math.round((received.reduce((s, r) => s + r.score, 0) / received.length) * 10) / 10;
    for (const r of received) {
      for (const b of (r.badges ?? [])) {
        badgeCounts[b] = (badgeCounts[b] ?? 0) + 1;
      }
    }
  }
  const top_badges = Object.entries(badgeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  res.json({ ...user.toJSON(), availability, avg_score, top_badges });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const { nome, nickname, bio, phone, genero, data_nascimento, avatar_url, push_token, notifications_enabled } = req.body ?? {};
  const user = await User.findByPk(req.auth.userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  if (nome?.trim()?.length >= 2) user.nome = nome.trim();
  if (nickname !== undefined) user.nickname = nickname?.trim() || null;
  if (bio !== undefined) user.bio = bio?.trim() || null;
  if (phone !== undefined) user.phone = phone?.trim() || null;
  if (genero !== undefined && ['male', 'female', 'other'].includes(genero)) user.genero = genero;
  if (data_nascimento !== undefined) user.data_nascimento = data_nascimento || null;
  if (avatar_url !== undefined) user.avatar_url = avatar_url;
  if (push_token !== undefined) user.push_token = push_token;
  if (notifications_enabled !== undefined) user.notifications_enabled = notifications_enabled;

  await user.save();
  res.json({ id: user.id, nome: user.nome, nickname: user.nickname, avatar_url: user.avatar_url });
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

// === RLS: UserLocation ===
exports.getLocation = asyncHandler(async (req, res) => {
  const loc = await withUserCtx(req.auth.userId, (t) =>
    UserLocation.findOne({
      where: { user_id: req.auth.userId },
      include: [{ model: Cidade, as: 'cidade', attributes: ['id', 'nome', 'estado'] }],
      transaction: t,
    })
  );
  if (!loc) throw new AppError('Localização não definida', 404);
  res.json({ cidade_id: loc.cidade_id, nome: loc.cidade?.nome, estado: loc.cidade?.estado });
});

exports.updateLocation = asyncHandler(async (req, res) => {
  const { cidade_id } = req.body ?? {};
  if (!cidade_id) throw new AppError('cidade_id obrigatório', 400);

  const cidade = await Cidade.findByPk(cidade_id);
  if (!cidade) throw new AppError('Cidade não encontrada', 404);

  await withUserCtx(req.auth.userId, (t) =>
    UserLocation.upsert({ user_id: req.auth.userId, cidade_id }, { transaction: t })
  );
  res.json({ cidade_id, nome: cidade.nome, estado: cidade.estado });
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Nenhum arquivo enviado', 400);

  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const avatar_url = `${baseUrl}/uploads/avatars/${req.file.filename}`;

  await User.update({ avatar_url }, { where: { id: req.auth.userId } });
  res.json({ avatar_url });
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

  const completedJogoIds = participacoes
    .filter(p => p.jogo?.status === 'completed')
    .map(p => p.jogo.id);

  const ratedJogoIds = new Set(
    completedJogoIds.length > 0
      ? (await GameRating.findAll({
          where: { rater_id: req.auth.userId, jogo_id: completedJogoIds },
          attributes: ['jogo_id'],
        })).map(r => r.jogo_id)
      : []
  );

  const jogos = participacoes
    .filter((p) => p.jogo != null)
    .map((p) => {
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
        has_rated: ratedJogoIds.has(j.id),
      };
    });

  res.json(jogos);
});
