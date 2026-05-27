const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const registerSchema = z.object({
  nome:      z.string().min(2).max(120),
  email:     z.string().email(),
  password:  z.string().min(8).max(72),
  genero:    z.enum(['male', 'female', 'other']),
  cidade_id: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

exports.register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const user = await authService.register(data);
  const accessToken = authService.signAccessToken(user);
  const refreshToken = await authService.createRefreshToken(user.id);
  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await authService.login(data);
  const accessToken = authService.signAccessToken(user);
  const refreshToken = await authService.createRefreshToken(user.id);
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  });
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ success: false, error: 'refreshToken obrigatório' });

  const { user, newRaw } = await authService.rotateRefreshToken(refreshToken);
  const accessToken = authService.signAccessToken(user);
  res.json({ accessToken, refreshToken: newRaw });
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) await authService.revokeRefreshToken(refreshToken, req.auth.userId);
  res.status(204).send();
});
