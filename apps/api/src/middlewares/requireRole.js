const AppError = require('../utils/AppError');
module.exports = (...roles) => (req, _res, next) =>
  roles.includes(req.auth?.role) ? next() : next(new AppError('Acesso negado', 403));
