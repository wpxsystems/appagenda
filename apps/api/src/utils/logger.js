const pino = require('pino');
module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: [
    'req.headers.authorization',
    'req.body.password',
    'req.body.token',
    '*.password',
    '*.token_hash',
  ],
});
