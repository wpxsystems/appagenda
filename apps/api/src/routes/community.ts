import type { FastifyInstance } from 'fastify'
import { getPgClient } from '@racket-app/db'

export async function communityRoutes(app: FastifyInstance) {

  // GET /community/groups — grupos do usuário
  app.get('/community/groups', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`
      SELECT
        g.id, g.name, g.sport,
        g.created_by,
        m.role,
        (SELECT count(*)::int FROM community_group_members WHERE group_id = g.id) AS member_count
      FROM community_groups g
      JOIN community_group_members m ON m.group_id = g.id AND m.user_id = ${userId}
      ORDER BY g.created_at DESC
    `
    return reply.send(rows.map(r => ({
      id: r['id'],
      name: r['name'],
      sport: r['sport'],
      memberCount: r['member_count'],
      isAdmin: r['role'] === 'admin',
    })))
  })

  // POST /community/groups — criar grupo
  app.post('/community/groups', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { name, sport } = (req.body ?? {}) as { name?: string; sport?: string | null }
    if (!name?.trim()) return reply.status(400).send({ error: 'name required' })
    const pg = getPgClient()

    const rows = await pg`
      INSERT INTO community_groups (name, sport, created_by)
      VALUES (${name.trim()}, ${sport ?? null}, ${userId})
      RETURNING id, name, sport
    `
    const group = rows[0]
    await pg`
      INSERT INTO community_group_members (group_id, user_id, role)
      VALUES (${group['id']}, ${userId}, 'admin')
    `
    return reply.status(201).send({
      id: group['id'], name: group['name'], sport: group['sport'],
      memberCount: 1, isAdmin: true,
    })
  })

  // POST /community/groups/:id/join — entrar num grupo
  app.post('/community/groups/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const group = await pg`SELECT id FROM community_groups WHERE id = ${id} LIMIT 1`
    if (!group[0]) return reply.status(404).send({ error: 'Group not found' })
    const existing = await pg`SELECT 1 FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (existing.length > 0) return reply.status(409).send({ error: 'Already a member' })
    await pg`INSERT INTO community_group_members (group_id, user_id) VALUES (${id}, ${userId})`
    return reply.status(201).send({ ok: true })
  })

  // DELETE /community/groups/:id — deletar grupo (somente admin)
  app.delete('/community/groups/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const member = await pg`SELECT role FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!member[0] || member[0]['role'] !== 'admin') return reply.status(403).send({ error: 'Forbidden' })
    await pg`DELETE FROM community_groups WHERE id = ${id}`
    return reply.send({ ok: true })
  })

  // GET /community/favorites — jogadores favoritos
  app.get('/community/favorites', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`
      SELECT
        u.id, u.name,
        p.sport, p.category, p.skill_level
      FROM favorite_players f
      JOIN users u ON u.id = f.favorite_user_id
      LEFT JOIN player_sport_profiles p ON p.user_id = u.id AND p.is_active = true
      WHERE f.user_id = ${userId}
      ORDER BY u.name
    `
    return reply.send(rows.map(r => ({
      id: r['id'],
      name: r['name'],
      sport: r['sport'],
      category: r['category'],
      skillLevel: r['skill_level'],
    })))
  })

  // POST /community/favorites/:userId — adicionar favorito
  app.post('/community/favorites/:targetId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { targetId } = req.params as { targetId: string }
    if (userId === targetId) return reply.status(400).send({ error: 'Cannot favorite yourself' })
    const pg = getPgClient()
    const user = await pg`SELECT id FROM users WHERE id = ${targetId} LIMIT 1`
    if (!user[0]) return reply.status(404).send({ error: 'User not found' })
    await pg`
      INSERT INTO favorite_players (user_id, favorite_user_id)
      VALUES (${userId}, ${targetId})
      ON CONFLICT DO NOTHING
    `
    return reply.status(201).send({ ok: true })
  })

  // DELETE /community/favorites/:userId — remover favorito
  app.delete('/community/favorites/:targetId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { targetId } = req.params as { targetId: string }
    const pg = getPgClient()
    await pg`DELETE FROM favorite_players WHERE user_id = ${userId} AND favorite_user_id = ${targetId}`
    return reply.send({ ok: true })
  })
}
