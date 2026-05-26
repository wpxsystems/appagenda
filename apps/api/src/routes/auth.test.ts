import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from '../plugins/auth.js'
import { authRoutes } from './auth.js'

vi.mock('../services/auth.service.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  saveRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}))

import * as authService from '../services/auth.service.js'

process.env['JWT_ACCESS_SECRET'] = 'test-secret'
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret'

async function buildTestApp() {
  const app = Fastify()
  await app.register(cors, { origin: true })
  await app.register(authPlugin)
  await app.register(authRoutes)
  return app
}

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for invalid body', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', body: {} })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when email is taken', async () => {
    vi.mocked(authService.registerUser).mockRejectedValue(
      Object.assign(new Error('taken'), { code: 'EMAIL_TAKEN' }),
    )
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: {
        name: 'João',
        email: 'test@example.com',
        password: 'password123',
        gender: 'male',
        cityId: '00000000-0000-0000-0000-000000000001',
        sportProfile: { sport: 'padel', category: 'B', sidePreference: 'right' },
      },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 201 with tokens on success', async () => {
    vi.mocked(authService.registerUser).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      role: 'player',
      email: 'test@example.com',
      name: 'João',
      gender: 'male',
      passwordHash: null,
      googleId: null,
      avatarUrl: null,
      pushToken: null,
      notificationsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(authService.saveRefreshToken).mockResolvedValue(undefined)
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: {
        name: 'João',
        email: 'test@example.com',
        password: 'password123',
        gender: 'male',
        cityId: '00000000-0000-0000-0000-000000000001',
        sportProfile: { sport: 'padel', category: 'B', sidePreference: 'right' },
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toHaveProperty('accessToken')
    expect(body).toHaveProperty('refreshToken')
  })
})

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 for wrong credentials', async () => {
    vi.mocked(authService.loginUser).mockRejectedValue(
      Object.assign(new Error('invalid'), { code: 'INVALID_CREDENTIALS' }),
    )
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      body: { email: 'a@b.com', password: 'wrongpass' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with tokens on success', async () => {
    vi.mocked(authService.loginUser).mockResolvedValue({
      id: 'user-1',
      role: 'player',
      email: 'a@b.com',
      name: 'Test',
      gender: 'male',
      passwordHash: 'hash',
      googleId: null,
      avatarUrl: null,
      pushToken: null,
      notificationsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(authService.saveRefreshToken).mockResolvedValue(undefined)
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      body: { email: 'a@b.com', password: 'correctpass' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('accessToken')
  })
})
