const { z } = require('zod');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { Jogo, Participacao, GameRating } = require('../models');
const AppError = require('../utils/AppError');

const VALID_BADGES = [
  'pontual', 'respeitoso', 'simpatico', 'competitivo',
  'comprometido', 'comunicativo', 'esportivo', 'parceiro', 'energia', 'jogaria',
];

const submitSchema = z.object({
  ratings: z.array(z.object({
    rated_user_id: z.string().uuid(),
    score:         z.number().int().min(1).max(5),
    badges:        z.array(z.string()).max(3).default([]),
  })).min(1).max(20),
});

exports.submitRatings = asyncHandler(async (req, res) => {
  const { ratings } = submitSchema.parse(req.body);
  const jogoId = req.params.id;
  const raterId = req.auth.userId;

  const jogo = await Jogo.findByPk(jogoId, {
    include: [{ model: Participacao, as: 'participacoes', attributes: ['user_id'] }],
  });
  if (!jogo) throw new AppError('Jogo não encontrado', 404);
  if (jogo.status !== 'completed') throw new AppError('O jogo ainda não foi confirmado', 409);

  const participantIds = new Set(jogo.participacoes.map(p => p.user_id));
  if (!participantIds.has(raterId)) throw new AppError('Você não é participante deste jogo', 403);

  const alreadyRated = await GameRating.findOne({ where: { jogo_id: jogoId, rater_id: raterId } });
  if (alreadyRated) throw new AppError('Você já avaliou este jogo', 409);

  const toInsert = ratings
    .filter(r => r.rated_user_id !== raterId && participantIds.has(r.rated_user_id))
    .map(r => ({
      jogo_id:       jogoId,
      rater_id:      raterId,
      rated_user_id: r.rated_user_id,
      score:         r.score,
      badges:        r.badges.filter(b => VALID_BADGES.includes(b)),
    }));

  if (toInsert.length === 0) throw new AppError('Nenhuma avaliação válida', 400);

  await GameRating.bulkCreate(toInsert, { ignoreDuplicates: true });

  res.status(201).json({ ok: true });
});

exports.getMyRating = asyncHandler(async (req, res) => {
  const existing = await GameRating.findOne({
    where: { jogo_id: req.params.id, rater_id: req.auth.userId },
    attributes: ['id'],
  });
  res.json({ has_rated: !!existing });
});
