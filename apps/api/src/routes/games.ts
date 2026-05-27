import type { FastifyInstance } from 'fastify'
import { db, games, gameParticipants, venues, courts, users, userLocations, gameMessages, eq, sql, getPgClient } from '@racket-app/db'
import { createGameSchema } from '@racket-app/shared'

export async function gamesRoutes(app: FastifyInstance) {
  // GET /venues?cityId= (public, for game creation form)
  app.get('/venues', async (req, reply) => {
    const { cityId } = req.query as { cityId?: string }
    const rows = cityId
      ? await db.select({ id: venues.id, name: venues.name, address: venues.address, sports: venues.sports })
          .from(venues).where(eq(venues.cityId, cityId)).orderBy(venues.name)
      : await db.select({ id: venues.id, name: venues.name, address: venues.address, sports: venues.sports })
          .from(venues).orderBy(venues.name)
    return reply.send(rows)
  })

  // GET /venues/:id/courts
  app.get('/venues/:id/courts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const rows = await db
      .select({ id: courts.id, name: courts.name, sport: courts.sport, surface: courts.surface, isIndoor: courts.isIndoor })
      .from(courts).where(eq(courts.venueId, id))
    return reply.send(rows)
  })

  // POST /games (authenticated)
  app.post('/games', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const parsed = createGameSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const data = parsed.data

    // get user's city if not provided
    let cityId = data.cityId
    if (!cityId) {
      const locs = await db.select().from(userLocations).where(eq(userLocations.userId, userId)).limit(1)
      cityId = locs[0]?.cityId ?? ''
      if (!cityId) return reply.status(400).send({ error: 'cityId required' })
    }

    const pg = getPgClient()
    const rows = await pg`
      INSERT INTO games (sport, creator_id, venue_id, court_id, city_id,
        coordinates_lng, coordinates_lat, scheduled_at, duration_minutes,
        vacancies_total, gender_type, court_reserved, notes,
        target_category, target_skill_level, target_side, target_play_format)
      VALUES (
        ${data.sport}, ${userId},
        ${data.venueId ?? null}, ${data.courtId ?? null}, ${cityId},
        ${'0'}, ${'0'}, ${data.scheduledAt},
        ${data.durationMinutes}, ${data.vacanciesTotal}, ${data.genderType},
        ${data.courtReserved}, ${data.notes ?? null},
        ${data.targetCategory ?? null}, ${data.targetSkillLevel ?? null},
        ${data.targetSide ?? null}, ${data.targetPlayFormat ?? null}
      )
      RETURNING id, sport, scheduled_at, duration_minutes, vacancies_total, status, notes
    `
    const game = rows[0]
    if (!game) return reply.status(500).send({ error: 'Insert failed' })
    await pg`INSERT INTO game_participants (game_id, user_id) VALUES (${game['id']}, ${userId}) ON CONFLICT DO NOTHING`
    return reply.status(201).send(game)
  })

  // GET /games?cityId=&sport=&status=open
  app.get('/games', async (req, reply) => {
    const { cityId, sport, status = 'open' } = req.query as Record<string, string>

    const rows = await db
      .select({
        id: games.id,
        sport: games.sport,
        scheduledAt: games.scheduledAt,
        durationMinutes: games.durationMinutes,
        vacanciesTotal: games.vacanciesTotal,
        status: games.status,
        courtReserved: games.courtReserved,
        targetCategory: games.targetCategory,
        targetSkillLevel: games.targetSkillLevel,
        targetSide: games.targetSide,
        notes: games.notes,
        venueName: venues.name,
        venueAddress: venues.address,
        creatorName: users.name,
        creatorId: games.creatorId,
      })
      .from(games)
      .leftJoin(venues, eq(games.venueId, venues.id))
      .leftJoin(users, eq(games.creatorId, users.id))
      .where(
        sql`${games.status} = ${status}::game_status_enum
            ${cityId ? sql`AND ${games.cityId} = ${cityId}::uuid` : sql``}
            ${sport ? sql`AND ${games.sport} = ${sport}::sport_enum` : sql``}
            AND ${games.scheduledAt} >= now()`
      )
      .orderBy(games.scheduledAt)
      .limit(50)

    const gameIds = rows.map(r => r.id)
    let participantCounts: Record<string, number> = {}
    if (gameIds.length > 0) {
      const counts = await db
        .select({ gameId: gameParticipants.gameId, count: sql<number>`count(*)::int` })
        .from(gameParticipants)
        .where(sql`${gameParticipants.gameId} = ANY(${sql`ARRAY[${sql.join(gameIds.map(id => sql`${id}::uuid`), sql`, `)}]`})`)
        .groupBy(gameParticipants.gameId)
      participantCounts = Object.fromEntries(counts.map(c => [c.gameId, c.count]))
    }

    return reply.send(rows.map(g => ({
      ...g,
      participantCount: participantCounts[g.id] ?? 0,
      openSpots: g.vacanciesTotal - (participantCounts[g.id] ?? 0),
    })))
  })

  // GET /games/:id  (auth optional — adds isCreator + alreadyJoined flags)
  app.get('/games/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = (req.user as { id: string }).id

    const [game] = await db
      .select({
        id: games.id,
        sport: games.sport,
        scheduledAt: games.scheduledAt,
        durationMinutes: games.durationMinutes,
        vacanciesTotal: games.vacanciesTotal,
        status: games.status,
        courtReserved: games.courtReserved,
        targetCategory: games.targetCategory,
        targetSkillLevel: games.targetSkillLevel,
        targetSide: games.targetSide,
        targetPlayFormat: games.targetPlayFormat,
        genderType: games.genderType,
        notes: games.notes,
        venueName: venues.name,
        venueAddress: venues.address,
        creatorName: users.name,
        creatorId: games.creatorId,
      })
      .from(games)
      .leftJoin(venues, eq(games.venueId, venues.id))
      .leftJoin(users, eq(games.creatorId, users.id))
      .where(eq(games.id, id))

    if (!game) return reply.status(404).send({ error: 'Game not found' })

    const participants = await db
      .select({ userId: gameParticipants.userId, name: users.name, status: gameParticipants.status })
      .from(gameParticipants)
      .leftJoin(users, eq(gameParticipants.userId, users.id))
      .where(eq(gameParticipants.gameId, id))

    const isCreator    = game.creatorId === userId
    const alreadyJoined = participants.some(p => p.userId === userId)

    return reply.send({ ...game, participants, isCreator, alreadyJoined })
  })

  // GET /games/:id/messages
  app.get('/games/:id/messages', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const rows = await db
      .select({ id: gameMessages.id, content: gameMessages.content, createdAt: gameMessages.createdAt,
        userId: gameMessages.userId, name: users.name })
      .from(gameMessages)
      .leftJoin(users, eq(gameMessages.userId, users.id))
      .where(eq(gameMessages.gameId, id))
      .orderBy(gameMessages.createdAt)
      .limit(100)
    return reply.send(rows)
  })

  // POST /games/:id/messages
  app.post('/games/:id/messages', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = (req.user as { id: string }).id
    const { content } = (req.body ?? {}) as { content?: string }
    if (!content?.trim()) return reply.status(400).send({ error: 'content required' })
    const pg = getPgClient()
    const rows = await pg`
      INSERT INTO game_messages (game_id, user_id, content) VALUES (${id}, ${userId}, ${content.trim()})
      RETURNING id, content, created_at
    `
    return reply.status(201).send(rows[0])
  })

  // POST /games/:id/cancel (creator only)
  app.post('/games/:id/cancel', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()

    const rows = await pg`
      SELECT g.creator_id, g.status, g.sport, g.scheduled_at, u.name AS creator_name
      FROM games g
      JOIN users u ON u.id = g.creator_id
      WHERE g.id = ${id} LIMIT 1
    `
    const game = rows[0]
    if (!game) return reply.status(404).send({ error: 'Game not found' })
    if (game['creator_id'] !== userId) return reply.status(403).send({ error: 'Only the creator can cancel' })
    if (game['status'] === 'cancelled') return reply.status(409).send({ error: 'Already cancelled' })

    await pg`UPDATE games SET status = 'cancelled' WHERE id = ${id}`

    // notify all participants except the creator
    const participants = await pg`
      SELECT user_id FROM game_participants
      WHERE game_id = ${id} AND user_id != ${userId}
    `
    const sportLabel: Record<string, string> = {
      padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis'
    }
    const date = new Date(game['scheduled_at']).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit'
    })
    const title = 'Jogo cancelado'
    const body = `O jogo de ${sportLabel[game['sport']] ?? game['sport']} de ${date} foi cancelado pelo organizador`

    for (const p of participants) {
      await pg`
        INSERT INTO notifications (user_id, type, title, body, game_id)
        VALUES (${p['user_id']}, 'game_cancelled', ${title}, ${body}, ${id})
      `
    }

    return reply.send({ ok: true })
  })

  // POST /games/:id/join
  app.post('/games/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()

    const rows = await pg`SELECT id, status, vacancies_total FROM games WHERE id = ${id} LIMIT 1`
    const game = rows[0]
    if (!game) return reply.status(404).send({ error: 'Game not found' })
    if (game['status'] !== 'open') return reply.status(409).send({ error: 'Game is not open' })

    const countRows = await pg`SELECT count(*)::int AS c FROM game_participants WHERE game_id = ${id}`
    if ((countRows[0]?.['c'] ?? 0) >= game['vacancies_total']) return reply.status(409).send({ error: 'Game is full' })

    const existing = await pg`SELECT 1 FROM game_participants WHERE game_id = ${id} AND user_id = ${userId} LIMIT 1`
    if (existing.length > 0) return reply.status(409).send({ error: 'Already joined' })

    await pg`INSERT INTO game_participants (game_id, user_id) VALUES (${id}, ${userId})`
    return reply.status(201).send({ ok: true })
  })
}
