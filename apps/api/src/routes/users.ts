import type { FastifyInstance } from 'fastify'
import { getPgClient, db, games, gameParticipants, venues, userLocations, eq, sql } from '@racket-app/db'
import { z } from 'zod'

const availabilitySchema = z.record(
  z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']),
  z.object({ active: z.boolean(), from: z.string(), to: z.string() }).optional()
)

export async function usersRoutes(app: FastifyInstance) {
  app.get('/users/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`SELECT id, name, email, avatar_url, role, availability_json FROM users WHERE id = ${userId} LIMIT 1`
    const user = rows[0]
    if (!user) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      id: user['id'], name: user['name'], email: user['email'],
      avatarUrl: user['avatar_url'], role: user['role'],
      availability: user['availability_json'] ? JSON.parse(user['availability_json'] as string) : null,
    })
  })

  app.patch('/users/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { name, avatarUrl } = (req.body ?? {}) as { name?: string; avatarUrl?: string }
    const pg = getPgClient()
    if (name && name.trim().length >= 2) {
      await pg`UPDATE users SET name = ${name.trim()} WHERE id = ${userId}`
    }
    if (avatarUrl !== undefined) {
      await pg`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${userId}`
    }
    const rows = await pg`SELECT id, name, avatar_url FROM users WHERE id = ${userId} LIMIT 1`
    const u = rows[0]
    return reply.send({ id: u?.['id'], name: u?.['name'], avatarUrl: u?.['avatar_url'] })
  })

  app.get('/users/me/sport-profiles', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`SELECT id, sport, category, side_preference, skill_level, play_format, is_active FROM player_sport_profiles WHERE user_id = ${userId}`
    return reply.send(rows.map((r) => ({
      id: r['id'], sport: r['sport'], category: r['category'],
      sidePreference: r['side_preference'], skillLevel: r['skill_level'],
      playFormat: r['play_format'], isActive: r['is_active'],
    })))
  })

  app.get('/users/me/availability', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`SELECT availability_json FROM users WHERE id = ${userId} LIMIT 1`
    const u = rows[0]
    return reply.send(u?.['availability_json'] ? JSON.parse(u['availability_json'] as string) : {})
  })

  app.get('/users/me/games', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const rows = await db
      .select({
        id: games.id,
        sport: games.sport,
        scheduledAt: games.scheduledAt,
        durationMinutes: games.durationMinutes,
        vacanciesTotal: games.vacanciesTotal,
        status: games.status,
        courtReserved: games.courtReserved,
        venueName: venues.name,
        venueAddress: venues.address,
        creatorId: games.creatorId,
        participantCount: sql<number>`(SELECT count(*)::int FROM game_participants gp WHERE gp.game_id = ${games.id})`,
      })
      .from(gameParticipants)
      .innerJoin(games, eq(gameParticipants.gameId, games.id))
      .leftJoin(venues, eq(games.venueId, venues.id))
      .where(eq(gameParticipants.userId, userId))
      .orderBy(games.scheduledAt)
    return reply.send(rows.map(g => ({
      ...g,
      isCreator: g.creatorId === userId,
      openSpots: g.vacanciesTotal - g.participantCount,
    })))
  })

  app.patch('/users/me/availability', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const parsed = availabilitySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const pg = getPgClient()
    await pg`UPDATE users SET availability_json = ${JSON.stringify(parsed.data)} WHERE id = ${userId}`
    return reply.send(parsed.data)
  })

  app.get('/users/me/location', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`
      SELECT ul.city_id, c.name, c.state
      FROM user_locations ul
      JOIN cities c ON c.id = ul.city_id
      WHERE ul.user_id = ${userId}
      LIMIT 1
    `
    if (!rows[0]) return reply.status(404).send({ error: 'No location set' })
    return reply.send({ cityId: rows[0]['city_id'], name: rows[0]['name'], state: rows[0]['state'] })
  })

  app.patch('/users/me/location', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { cityId } = (req.body ?? {}) as { cityId?: string }
    if (!cityId) return reply.status(400).send({ error: 'cityId required' })
    const pg = getPgClient()
    await pg`
      INSERT INTO user_locations (user_id, city_id)
      VALUES (${userId}, ${cityId})
      ON CONFLICT (user_id) DO UPDATE SET city_id = ${cityId}, updated_at = now()
    `
    const rows = await pg`SELECT c.id, c.name, c.state FROM cities c WHERE c.id = ${cityId} LIMIT 1`
    const city = rows[0]
    if (!city) return reply.status(404).send({ error: 'City not found' })
    return reply.send({ cityId: city['id'], name: city['name'], state: city['state'] })
  })

  // Add a new sport profile
  app.post('/users/me/sport-profiles', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const body = (req.body ?? {}) as Record<string, unknown>
    const sport = body['sport'] as string
    if (!['padel', 'beach_tennis', 'tennis'].includes(sport)) {
      return reply.status(400).send({ error: 'Invalid sport' })
    }
    const pg = getPgClient()
    const existing = await pg`SELECT id FROM player_sport_profiles WHERE user_id = ${userId} AND sport = ${sport}`
    if (existing.length > 0) return reply.status(409).send({ error: 'Sport already registered' })
    if (sport === 'tennis') {
      const skillLevel = (body['skillLevel'] as string) || null
      const playFormat = (body['playFormat'] as string) || null
      await pg`INSERT INTO player_sport_profiles (user_id, sport, skill_level, play_format) VALUES (${userId}, ${sport}, ${skillLevel}, ${playFormat})`
    } else {
      const category = (body['category'] as string) || null
      const sidePreference = (body['sidePreference'] as string) || null
      await pg`INSERT INTO player_sport_profiles (user_id, sport, category, side_preference) VALUES (${userId}, ${sport}, ${category}, ${sidePreference})`
    }
    const rows = await pg`SELECT id, sport, category, side_preference, skill_level, play_format, is_active FROM player_sport_profiles WHERE user_id = ${userId} AND sport = ${sport} LIMIT 1`
    const r = rows[0]
    if (!r) return reply.status(500).send({ error: 'Insert failed' })
    return reply.status(201).send({
      id: r['id'], sport: r['sport'], category: r['category'],
      sidePreference: r['side_preference'], skillLevel: r['skill_level'],
      playFormat: r['play_format'], isActive: r['is_active'],
    })
  })

  // Update an existing sport profile
  app.put('/users/me/sport-profiles/:sport', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { sport } = req.params as { sport: string }
    const body = (req.body ?? {}) as Record<string, unknown>
    const pg = getPgClient()
    const existing = await pg`SELECT id FROM player_sport_profiles WHERE user_id = ${userId} AND sport = ${sport}`
    if (existing.length === 0) return reply.status(404).send({ error: 'Sport profile not found' })
    if (sport === 'tennis') {
      const skillLevel = (body['skillLevel'] as string) || null
      const playFormat = (body['playFormat'] as string) || null
      await pg`UPDATE player_sport_profiles SET skill_level = ${skillLevel}, play_format = ${playFormat} WHERE user_id = ${userId} AND sport = ${sport}`
    } else {
      const category = (body['category'] as string) || null
      const sidePreference = (body['sidePreference'] as string) || null
      await pg`UPDATE player_sport_profiles SET category = ${category}, side_preference = ${sidePreference} WHERE user_id = ${userId} AND sport = ${sport}`
    }
    const rows = await pg`SELECT id, sport, category, side_preference, skill_level, play_format, is_active FROM player_sport_profiles WHERE user_id = ${userId} AND sport = ${sport} LIMIT 1`
    const r = rows[0]
    if (!r) return reply.status(500).send({ error: 'Update failed' })
    return reply.send({
      id: r['id'], sport: r['sport'], category: r['category'],
      sidePreference: r['side_preference'], skillLevel: r['skill_level'],
      playFormat: r['play_format'], isActive: r['is_active'],
    })
  })
}

