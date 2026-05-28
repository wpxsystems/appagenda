const rateLimit = require('express-rate-limit');

// Limiter pra LOGIN: 5 tentativas FALHAS por IP a cada 15 min
// (logins bem-sucedidos não contam, pra não punir quem digitou senha errada uma vez)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

// Limiter pra REGISTER: 3 contas por IP a cada 1h (anti-spam de cadastros)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitos cadastros do mesmo IP. Tente novamente em 1 hora.' },
});

// Limiter pra REFRESH: 30 trocas/hora por IP (token rotation legítima é rara)
const refreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de refresh.' },
});

module.exports = { loginLimiter, registerLimiter, refreshLimiter };
