import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { loginSchema, sportProfileSchema, Gender } from '@racket-app/shared'
import { db, users, eq } from '@racket-app/db'
import {
  registerUser,
  loginUser,
  saveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/auth.service.js'

const registerBodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  gender: z.enum(Gender),
  cityId: z.string().uuid(),
  sportProfiles: z.array(sportProfileSchema).min(1),
})

const ACCESS_TOKEN_TTL = 15 * 60

function refreshExpiry(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const parsed = registerBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const { sportProfiles, ...account } = parsed.data

    try {
      const user = await registerUser(account, sportProfiles)
      const accessToken = app.jwt.sign(
        { sub: user.id, role: user.role },
        { expiresIn: ACCESS_TOKEN_TTL },
      )
      const refreshToken = randomBytes(40).toString('hex')
      await saveRefreshToken(user.id, refreshToken, refreshExpiry())
      return reply.status(201).send({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'EMAIL_TAKEN') return reply.status(409).send({ error: 'Email already in use' })
      app.log.error(err)
      return reply.status(500).send({ error: 'Registration failed' })
    }
  })

  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    try {
      const user = await loginUser(parsed.data)
      const accessToken = app.jwt.sign(
        { sub: user.id, role: user.role },
        { expiresIn: ACCESS_TOKEN_TTL },
      )
      const refreshToken = randomBytes(40).toString('hex')
      await saveRefreshToken(user.id, refreshToken, refreshExpiry())
      return reply.send({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'INVALID_CREDENTIALS')
        return reply.status(401).send({ error: 'Invalid email or password' })
      app.log.error(err)
      return reply.status(500).send({ error: 'Login failed' })
    }
  })

  app.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = (req.body ?? {}) as { refreshToken?: string }
    if (!refreshToken) return reply.status(400).send({ error: 'refreshToken required' })

    try {
      const newRefreshToken = randomBytes(40).toString('hex')
      const userId = await rotateRefreshToken(refreshToken, newRefreshToken, refreshExpiry())

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
      if (!user) return reply.status(401).send({ error: 'User not found' })

      const accessToken = app.jwt.sign(
        { sub: user.id, role: user.role },
        { expiresIn: ACCESS_TOKEN_TTL },
      )
      return reply.send({ accessToken, refreshToken: newRefreshToken })
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'INVALID_TOKEN')
        return reply.status(401).send({ error: 'Invalid or expired refresh token' })
      app.log.error(err)
      return reply.status(500).send({ error: 'Token refresh failed' })
    }
  })

  app.post('/auth/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { refreshToken } = (req.body ?? {}) as { refreshToken?: string }
    if (refreshToken) await revokeRefreshToken(refreshToken, req.user.id)
    return reply.status(204).send()
  })
}
