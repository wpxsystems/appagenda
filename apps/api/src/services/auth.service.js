const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, RefreshToken } = require('../models');
const AppError = require('../utils/AppError');

const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TTL_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TTL_DAYS);
  return d;
}

async function register({ nome, email, password, genero, cidade_id }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new AppError('Email já cadastrado', 409);

  const password_hash = await bcrypt.hash(password, 12);
  const user = await User.create({ nome, email, password_hash, genero, cidade_id });
  return user;
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new AppError('Credenciais inválidas', 401);
  if (user.status !== 'active') throw new AppError('Conta suspensa ou banida', 403);

  const valid = await bcrypt.compare(password, user.password_hash || '');
  if (!valid) throw new AppError('Credenciais inválidas', 401);

  return user;
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, typ: 'access', role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

async function createRefreshToken(userId) {
  const raw = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(raw);
  await RefreshToken.create({ user_id: userId, token_hash: hash, expires_at: refreshExpiry() });
  return raw;
}

async function rotateRefreshToken(rawToken) {
  const hash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ where: { token_hash: hash } });

  if (!record || record.expires_at < new Date()) {
    if (record) await record.destroy({ force: true });
    throw new AppError('Token de refresh inválido ou expirado', 401);
  }

  await record.destroy({ force: true });

  const user = await User.findByPk(record.user_id);
  if (!user) throw new AppError('Usuário não encontrado', 401);

  const newRaw = crypto.randomBytes(40).toString('hex');
  const newHash = hashToken(newRaw);
  await RefreshToken.create({ user_id: user.id, token_hash: newHash, expires_at: refreshExpiry() });

  return { user, newRaw };
}

async function revokeRefreshToken(rawToken, userId) {
  const hash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ where: { token_hash: hash, user_id: userId } });
  if (record) await record.destroy({ force: true });
}

module.exports = { register, login, signAccessToken, createRefreshToken, rotateRefreshToken, revokeRefreshToken };
