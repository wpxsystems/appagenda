const { sequelize } = require('../models');
const AppError = require('../utils/AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res, next) => {
  const tenantId = req.auth?.tenantId;
  if (!UUID_RE.test(tenantId)) return next(new AppError('Tenant inválido', 401));

  const t = await sequelize.transaction();
  try {
    await sequelize.query(`SET LOCAL app.current_tenant = '${tenantId}'`, { transaction: t });
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
