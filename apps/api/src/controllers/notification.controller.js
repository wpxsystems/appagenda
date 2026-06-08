const asyncHandler = require('../utils/asyncHandler');
const { Notification } = require('../models');
const AppError = require('../utils/AppError');
const withUserCtx = require('../utils/withUserCtx');

exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.count({
    where: { user_id: req.auth.userId, read: false },
  });
  res.json({ count });
});

exports.list = asyncHandler(async (req, res) => {
  const notifications = await withUserCtx(req.auth.userId, (t) =>
    Notification.findAll({
      where: { user_id: req.auth.userId },
      order: [['created_at', 'DESC']],
      limit: 50,
      transaction: t,
    })
  );
  res.json(notifications);
});

exports.readAll = asyncHandler(async (req, res) => {
  await withUserCtx(req.auth.userId, (t) =>
    Notification.update(
      { read: true },
      { where: { user_id: req.auth.userId }, transaction: t }
    )
  );
  res.json({ ok: true });
});

exports.readOne = asyncHandler(async (req, res) => {
  await withUserCtx(req.auth.userId, async (t) => {
    const n = await Notification.findOne({
      where: { id: req.params.id, user_id: req.auth.userId },
      transaction: t,
    });
    if (!n) throw new AppError('Notificação não encontrada', 404);
    await n.update({ read: true }, { transaction: t });
  });
  res.json({ ok: true });
});
