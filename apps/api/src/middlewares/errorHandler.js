const { ZodError } = require('zod');
const logger = require('../utils/logger');

module.exports = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: 'Validation error', details: err.errors });
  }
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
  logger.error({ err, req: { url: req.url, method: req.method } }, 'Unhandled error');
  return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
};
