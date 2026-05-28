const asyncHandler = require('../utils/asyncHandler');
const { Notification } = require('../models');
const AppError = require('../utils/AppError');

exports.list = asyncHandler(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { user_id: req.auth.userId },
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  res.json(notifications);
});

exports.readAll = asyncHandler(async (req, res) => {
  await Notification.update({ read: true }, { where: { user_id: req.auth.userId } });
  res.json({ ok: true });
});

exports.readOne = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ where: { id: req.params.id, user_id: req.auth.userId } });
  if (!n) throw new AppError('Notificação não encontrada', 404);
  await n.update({ read: true });
  res.json({ ok: true });
});
