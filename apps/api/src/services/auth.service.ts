import { eq } from '@racket-app/db'
import { randomBytes, timingSafeEqual, scrypt } from 'crypto'
import { promisify } from 'util'
import { db } from '@racket-app/db'
import { users, refreshTokens, userLocations, playerSportProfiles } from '@racket-app/db'
import type { RegisterInput, LoginInput, SportProfileInput } from '@racket-app/shared'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return timingSafeEqual(hashBuf, derived)
}

export async function registerUser(input: RegisterInput, sportProfile: SportProfileInput) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })
  if (existing) throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_TAKEN' })

  const passwordHash = await hashPassword(input.password)

  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      gender: input.gender,
    })
    .returning()

  if (!user) throw new Error('Failed to create user')

  await db.insert(userLocations).values({
    userId: user.id,
    cityId: input.cityId,
  })

  await insertSportProfile(user.id, sportProfile)

  return user
}

export async function loginUser(input: LoginInput) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })
  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' })
  }

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' })
  }

  return user
}

export async function saveRefreshToken(userId: string, token: string, expiresAt: Date) {
  await db.insert(refreshTokens).values({ userId, token, expiresAt })
}

export async function rotateRefreshToken(oldToken: string, newToken: string, expiresAt: Date) {
  const existing = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.token, oldToken),
  })
  if (!existing || existing.expiresAt < new Date()) {
    throw Object.assign(new Error('Invalid refresh token'), { code: 'INVALID_TOKEN' })
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.token, oldToken))
  await db.insert(refreshTokens).values({
    userId: existing.userId,
    token: newToken,
    expiresAt,
  })

  return existing.userId
}

export async function revokeRefreshToken(token: string) {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token))
}

async function insertSportProfile(userId: string, profile: SportProfileInput) {
  if (profile.sport === 'tennis') {
    await db.insert(playerSportProfiles).values({
      userId,
      sport: 'tennis',
      skillLevel: profile.skillLevel,
      playFormat: profile.playFormat,
    })
  } else {
    await db.insert(playerSportProfiles).values({
      userId,
      sport: profile.sport,
      category: profile.category,
      sidePreference: profile.sidePreference,
    })
  }
}
