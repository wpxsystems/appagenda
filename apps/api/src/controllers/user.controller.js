const asyncHandler = require('../utils/asyncHandler');
const { User, SportProfile, GameRating, FavoritePlayer } = require('../models');
const AppError = require('../utils/AppError');

exports.getPublicProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByPk(id, {
    attributes: ['id', 'nome', 'nickname', 'bio', 'avatar_url', 'genero', 'games_played'],
  });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const sportProfiles = await SportProfile.findAll({
    where: { user_id: id },
    attributes: ['sport', 'category', 'skill_level', 'play_format', 'side_preference'],
  });

  const received = await GameRating.findAll({
    where: { rated_user_id: id },
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

  const isFavorite = await FavoritePlayer.findOne({
    where: { user_id: req.auth.userId, favorite_user_id: id },
  });

  res.json({
    id: user.id,
    nome: user.nome,
    nickname: user.nickname,
    bio: user.bio,
    avatar_url: user.avatar_url,
    genero: user.genero,
    games_played: user.games_played,
    sport_profiles: sportProfiles.map(s => s.toJSON()),
    avg_score,
    top_badges,
    is_favorite: !!isFavorite,
  });
});
