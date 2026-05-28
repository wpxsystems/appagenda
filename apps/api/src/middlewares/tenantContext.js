// AppAgenda é B2C single-tenant: o "contexto" é o user_id, não tenant_id.
// Nome do arquivo mantido pra não quebrar imports nas routes.
const { sequelize } = require('../models');
const AppError = require('../utils/AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res, next) => {
  const userId = req.auth?.userId;
  if (!UUID_RE.test(userId)) return next(new AppError('Usuário inválido', 401));

  const t = await sequelize.transaction();
  try {
    // Seta o GUC que as policies de RLS leem
    await sequelize.query(`SET LOCAL app.current_user = '${userId}'`, { transaction: t });
    req.tx = t;
    res.on('finish', async () => {
      try {
        res.statusCode < 400 ? await t.commit() : await t.rollback();
      } catch {}
    });
    next();
  } catch (err) {
    await t.rollback();
    next(err);
  }
};
