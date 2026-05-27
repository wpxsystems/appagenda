const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

module.exports = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError('Token ausente', 401));

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (decoded.typ !== 'access') return next(new AppError('Tipo de token inválido', 401));
    req.auth = {
      userId: decoded.sub,
      tenantId: decoded.tid,
      role: decoded.role,
      email: decoded.email,
    };
    next();
  } catch {
    next(new AppError('Token inválido ou expirado', 401));
  }
};
