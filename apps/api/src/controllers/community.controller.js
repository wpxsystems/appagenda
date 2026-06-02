const asyncHandler = require('../utils/asyncHandler');
const { CommunityGroup, CommunityGroupMember, CommunityGroupMessage, CommunityGroupInvite, User, FavoritePlayer, Jogo, Participacao, SportProfile } = require('../models');
const { Op, literal } = require('sequelize');
const AppError = require('../utils/AppError');
const withUserCtx = require('../utils/withUserCtx');

exports.listGroups = asyncHandler(async (req, res) => {
  const memberships = await CommunityGroupMember.findAll({
    where: { user_id: req.auth.userId },
    include: [{
      model: CommunityGroup,
      as: 'group',
      include: [{ model: CommunityGroupMessage, as: 'messages', limit: 1, order: [['created_at', 'DESC']] }],
    }],
  });

  const groups = await Promise.all(memberships.map(async (m) => {
    const g = m.group;
    const memberCount = await CommunityGroupMember.count({ where: { group_id: g.id } });
    const lastMsg = g.messages?.[0] ?? null;
    return {
      id: g.id, nome: g.nome, sport: g.sport,
      member_count: memberCount,
      is_admin: m.role === 'admin',
      last_message: lastMsg?.content ?? null,
      last_message_at: lastMsg?.created_at ?? null,
    };
  }));

  res.json(groups.sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0)));
});

exports.createGroup = asyncHandler(async (req, res) => {
  const { nome, sport } = req.body ?? {};
  if (!nome?.trim()) throw new AppError('nome obrigatório', 400);

  const group = await CommunityGroup.create({ nome: nome.trim(), sport: sport || null, created_by: req.auth.userId });
  await CommunityGroupMember.create({ group_id: group.id, user_id: req.auth.userId, role: 'admin' });
  res.status(201).json({ id: group.id, nome: group.nome, sport: group.sport, member_count: 1, is_admin: true });
});

exports.getGroup = asyncHandler(async (req, res) => {
  const membership = await CommunityGroupMember.findOne({
    where: { group_id: req.params.id, user_id: req.auth.userId },
    include: [{ model: CommunityGroup, as: 'group' }],
  });
  if (!membership) throw new AppError('Grupo não encontrado ou não é membro', 404);

  const members = await CommunityGroupMember.findAll({
    where: { group_id: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'nome', 'avatar_url'] }],
    order: [['role', 'DESC'], ['joined_at', 'ASC']],
  });

  const g = membership.group;
  res.json({
    id: g.id, nome: g.nome, sport: g.sport,
    is_admin: membership.role === 'admin',
    members: members.map((m) => ({ id: m.user?.id, nome: m.user?.nome, avatar_url: m.user?.avatar_url, role: m.role })),
  });
});

exports.deleteGroup = asyncHandler(async (req, res) => {
  const membership = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  if (!membership || membership.role !== 'admin') throw new AppError('Proibido', 403);
  await CommunityGroup.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

exports.getMessages = asyncHandler(async (req, res) => {
  const membership = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  if (!membership) throw new AppError('Não é membro', 403);

  const messages = await CommunityGroupMessage.findAll({
    where: { group_id: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'nome'] }],
    order: [['created_at', 'ASC']],
    limit: 100,
  });
  res.json(messages);
});

exports.createMessage = asyncHandler(async (req, res) => {
  const { content } = req.body ?? {};
  if (!content?.trim()) throw new AppError('Conteúdo obrigatório', 400);
  const membership = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  if (!membership) throw new AppError('Não é membro', 403);

  const msg = await CommunityGroupMessage.create({
    group_id: req.params.id, user_id: req.auth.userId, content: content.trim(),
  });
  res.status(201).json(msg);
});

exports.joinGroup = asyncHandler(async (req, res) => {
  const group = await CommunityGroup.findByPk(req.params.id);
  if (!group) throw new AppError('Grupo não encontrado', 404);
  const existing = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  if (existing) throw new AppError('Já é membro', 409);
  await CommunityGroupMember.create({ group_id: req.params.id, user_id: req.auth.userId });
  res.status(201).json({ ok: true });
});

exports.leaveGroup = asyncHandler(async (req, res) => {
  await CommunityGroupMember.destroy({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  res.json({ ok: true });
});

// === RLS: FavoritePlayer ===
exports.getFavorites = asyncHandler(async (req, res) => {
  const userInclude = {
    model: User,
    attributes: ['id', 'nome', 'avatar_url'],
    include: [{
      model: SportProfile,
      as: 'sportProfiles',
      attributes: ['sport', 'category', 'side_preference', 'skill_level', 'play_format'],
      required: false,
    }],
  };

  const [recentRows, favRows] = await withUserCtx(req.auth.userId, (t) =>
    Promise.all([
      Participacao.findAll({
        where: { user_id: req.auth.userId },
        include: [{
          model: Jogo, as: 'jogo',
          where: { scheduled_at: { [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, status: { [Op.ne]: 'cancelled' } },
          include: [{
            model: Participacao, as: 'participacoes',
            where: { user_id: { [Op.ne]: req.auth.userId } },
            include: [{ ...userInclude, as: 'user' }],
          }],
        }],
        limit: 20,
        transaction: t,
      }),
      FavoritePlayer.findAll({
        where: { user_id: req.auth.userId },
        include: [{ ...userInclude, as: 'favoriteUser' }],
        transaction: t,
      }),
    ])
  );

  const mapSportProfiles = (profiles) =>
    (profiles ?? []).map((p) => ({
      sport: p.sport,
      category: p.category,
      side_preference: p.side_preference,
      skill_level: p.skill_level,
      play_format: p.play_format,
    }));

  const recentUsersMap = new Map();
  for (const p of recentRows) {
    for (const other of p.jogo?.participacoes ?? []) {
      if (!recentUsersMap.has(other.user_id)) {
        recentUsersMap.set(other.user_id, {
          id: other.user?.id,
          nome: other.user?.nome,
          avatar_url: other.user?.avatar_url,
          sport_profiles: mapSportProfiles(other.user?.sportProfiles),
          last_game_at: p.jogo.scheduled_at,
          is_favorite: favRows.some((f) => f.favorite_user_id === other.user_id),
        });
      }
    }
  }

  res.json({
    recent_players: Array.from(recentUsersMap.values()),
    favorites: favRows.map((f) => ({
      id: f.favoriteUser?.id,
      nome: f.favoriteUser?.nome,
      avatar_url: f.favoriteUser?.avatar_url,
      sport_profiles: mapSportProfiles(f.favoriteUser?.sportProfiles),
    })),
  });
});

exports.addFavorite = asyncHandler(async (req, res) => {
  if (req.params.targetId === req.auth.userId) throw new AppError('Não pode favoritar a si mesmo', 400);
  await withUserCtx(req.auth.userId, (t) =>
    FavoritePlayer.findOrCreate({
      where: { user_id: req.auth.userId, favorite_user_id: req.params.targetId },
      transaction: t,
    })
  );
  res.status(201).json({ ok: true });
});

exports.removeFavorite = asyncHandler(async (req, res) => {
  await withUserCtx(req.auth.userId, (t) =>
    FavoritePlayer.destroy({
      where: { user_id: req.auth.userId, favorite_user_id: req.params.targetId },
      transaction: t,
    })
  );
  res.json({ ok: true });
});

// ── CONVITES DE GRUPO ────────────────────────────────────────────────────────

exports.inviteUser = asyncHandler(async (req, res) => {
  const { targetUserId } = req.body ?? {};
  if (!targetUserId) throw new AppError('targetUserId obrigatório', 400);
  const member = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  if (!member) throw new AppError('Não é membro', 403);
  const alreadyIn = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: targetUserId } });
  if (alreadyIn) throw new AppError('Usuário já está no grupo', 409);
  const alreadyInvited = await CommunityGroupInvite.findOne({ where: { group_id: req.params.id, invitee_id: targetUserId, status: 'pending' } });
  if (alreadyInvited) throw new AppError('Já foi convidado', 409);
  await CommunityGroupInvite.create({ group_id: req.params.id, inviter_id: req.auth.userId, invitee_id: targetUserId });
  res.status(201).json({ ok: true });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const admin = await CommunityGroupMember.findOne({ where: { group_id: req.params.id, user_id: req.auth.userId } });
  if (!admin || admin.role !== 'admin') throw new AppError('Não é admin', 403);
  if (req.params.memberId === req.auth.userId) throw new AppError('Admin não pode remover a si mesmo', 400);
  await CommunityGroupMember.destroy({ where: { group_id: req.params.id, user_id: req.params.memberId } });
  res.json({ ok: true });
});

exports.listInvites = asyncHandler(async (req, res) => {
  const invites = await CommunityGroupInvite.findAll({
    where: { invitee_id: req.auth.userId, status: 'pending' },
    include: [
      { model: CommunityGroup, as: 'group' },
      { model: User, as: 'inviter', attributes: ['id', 'nome'] },
    ],
    order: [['created_at', 'DESC']],
  });
  const result = await Promise.all(invites.map(async (inv) => {
    const memberCount = await CommunityGroupMember.count({ where: { group_id: inv.group_id } });
    return {
      id: inv.id,
      group_id: inv.group_id,
      group_name: inv.group?.nome,
      group_sport: inv.group?.sport,
      inviter_name: inv.inviter?.nome,
      member_count: memberCount,
      created_at: inv.created_at,
    };
  }));
  res.json(result);
});

exports.acceptInvite = asyncHandler(async (req, res) => {
  const invite = await CommunityGroupInvite.findOne({ where: { id: req.params.id, invitee_id: req.auth.userId, status: 'pending' } });
  if (!invite) throw new AppError('Convite não encontrado', 404);
  await invite.update({ status: 'accepted' });
  await CommunityGroupMember.findOrCreate({ where: { group_id: invite.group_id, user_id: req.auth.userId } });
  res.json({ ok: true });
});

exports.declineInvite = asyncHandler(async (req, res) => {
  const invite = await CommunityGroupInvite.findOne({ where: { id: req.params.id, invitee_id: req.auth.userId, status: 'pending' } });
  if (!invite) throw new AppError('Convite não encontrado', 404);
  await invite.update({ status: 'declined' });
  res.json({ ok: true });
});
