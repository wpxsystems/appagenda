import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------- enums ----------

export const sportEnum = pgEnum('sport_enum', ['padel', 'beach_tennis', 'tennis'])
export const racketCategoryEnum = pgEnum('racket_category_enum', ['C', 'B', 'A', 'Open'])
export const sidePreferenceEnum = pgEnum('side_preference_enum', ['left', 'right', 'both'])
export const tennisLevelEnum = pgEnum('tennis_level_enum', [
  'beginner',
  'intermediate',
  'advanced',
  'competitive',
])
export const playFormatEnum = pgEnum('play_format_enum', ['singles', 'doubles', 'both'])
export const genderEnum = pgEnum('gender_enum', ['male', 'female', 'other'])
export const userRoleEnum = pgEnum('user_role_enum', ['player', 'admin'])
export const gameGenderTypeEnum = pgEnum('game_gender_type_enum', ['mixed', 'male', 'female'])
export const gameStatusEnum = pgEnum('game_status_enum', ['open', 'full', 'cancelled', 'completed'])
export const participantStatusEnum = pgEnum('participant_status_enum', [
  'registered',
  'confirmed',
  'attended',
  'absent',
  'removed',
])

// ---------- tables ----------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  gender: genderEnum('gender').notNull(),
  role: userRoleEnum('role').notNull().default('player'),
  pushToken: text('push_token'),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  state: text('state').notNull(),
  country: text('country').notNull().default('BR'),
  // coordinates stored as text "lng,lat" and cast to geography in raw SQL where needed
  coordinatesLng: text('coordinates_lng').notNull(),
  coordinatesLat: text('coordinates_lat').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  slug: text('slug').unique(),
})

export const userLocations = pgTable('user_locations', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id),
  deviceLng: text('device_lng'),
  deviceLat: text('device_lat'),
  searchRadiusKm: integer('search_radius_km').notNull().default(15),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const playerSportProfiles = pgTable(
  'player_sport_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sport: sportEnum('sport').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    category: racketCategoryEnum('category'),
    sidePreference: sidePreferenceEnum('side_preference'),
    skillLevel: tennisLevelEnum('skill_level'),
    playFormat: playFormatEnum('play_format'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userSportUnique: unique().on(t.userId, t.sport) }),
)

export const venues = pgTable('venues', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  address: text('address').notNull(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id),
  coordinatesLng: text('coordinates_lng').notNull(),
  coordinatesLat: text('coordinates_lat').notNull(),
  sports: sportEnum('sports').array().notNull().default(sql`ARRAY[]::sport_enum[]`),
  phone: text('phone'),
  website: text('website'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const courts = pgTable('courts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sport: sportEnum('sport').notNull(),
  surface: text('surface'),
  isIndoor: boolean('is_indoor').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
})

export const games = pgTable('games', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sport: sportEnum('sport').notNull(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id),
  courtId: uuid('court_id').references(() => courts.id),
  venueId: uuid('venue_id').references(() => venues.id),
  coordinatesLng: text('coordinates_lng').notNull(),
  coordinatesLat: text('coordinates_lat').notNull(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(90),
  vacanciesTotal: integer('vacancies_total').notNull(),
  genderType: gameGenderTypeEnum('gender_type').notNull().default('mixed'),
  status: gameStatusEnum('status').notNull().default('open'),
  courtReserved: boolean('court_reserved').notNull().default(false),
  notes: text('notes'),
  targetCategory: racketCategoryEnum('target_category'),
  targetSkillLevel: tennisLevelEnum('target_skill_level'),
  targetSide: sidePreferenceEnum('target_side'),
  targetPlayFormat: playFormatEnum('target_play_format'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const gameParticipants = pgTable(
  'game_participants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: participantStatusEnum('status').notNull().default('registered'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ gameUserUnique: unique().on(t.gameId, t.userId) }),
)

export const gameMessages = pgTable('game_messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushNotificationsLog = pgTable('push_notifications_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').notNull(),
  payload: text('payload'), // JSON string
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  error: text('error'),
})

export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  cityName: text('city_name').notNull(),
  sport: sportEnum('sport'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
