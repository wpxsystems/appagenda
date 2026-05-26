import { z } from 'zod'
import {
  Sport,
  RacketCategory,
  SidePreference,
  TennisLevel,
  PlayFormat,
  Gender,
  GameGenderType,
} from './enums.js'

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  gender: z.enum(Gender),
  cityId: z.string().uuid(),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

const racketSportProfileSchema = z.object({
  sport: z.enum(['padel', 'beach_tennis'] as const),
  category: z.enum(RacketCategory),
  sidePreference: z.enum(SidePreference),
})

const tennisSportProfileSchema = z.object({
  sport: z.literal('tennis'),
  skillLevel: z.enum(TennisLevel),
  playFormat: z.enum(PlayFormat),
})

export const sportProfileSchema = z.discriminatedUnion('sport', [
  racketSportProfileSchema,
  tennisSportProfileSchema,
])

export type SportProfileInput = z.infer<typeof sportProfileSchema>

export const createGameSchema = z.object({
  sport: z.enum(Sport),
  venueId: z.string().uuid().optional(),
  courtId: z.string().uuid().optional(),
  cityId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(30).max(480).default(90),
  vacanciesTotal: z.number().int().min(2).max(12),
  genderType: z.enum(GameGenderType).default('mixed'),
  courtReserved: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  targetCategory: z.enum(RacketCategory).optional(),
  targetSkillLevel: z.enum(TennisLevel).optional(),
  targetSide: z.enum(SidePreference).optional(),
  targetPlayFormat: z.enum(PlayFormat).optional(),
})

export type CreateGameInput = z.infer<typeof createGameSchema>
