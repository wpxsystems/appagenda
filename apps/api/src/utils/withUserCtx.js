// withUserCtx — abre transação setando app.current_user (GUC lido pelas policies de RLS).
// Use sempre que tocar tabelas com RLS: app_user_location, app_notification, app_favorite_player.
//
// Uso:
//   const items = await withUserCtx(req.auth.userId, (t) =>
//     Model.findAll({ where: { user_id: req.auth.userId }, transaction: t })
//   );
const { sequelize } = require('../models');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function withUserCtx(userId, fn) {
  if (!UUID_RE.test(userId)) throw new Error('withUserCtx: userId inválido');
  return sequelize.transaction(async (t) => {
    await sequelize.query(
      `SET LOCAL app.current_user = '${userId}'`,
      { transaction: t }
    );
    return fn(t);
  });
};
