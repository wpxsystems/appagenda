import type { FastifyInstance } from 'fastify'
import { getPgClient } from '@racket-app/db'

export async function communityRoutes(app: FastifyInstance) {

  // ── GRUPOS ──────────────────────────────────────────────────────────────────

  app.get('/community/groups', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`
      SELECT g.id, g.name, g.sport, g.created_by, m.role,
        (SELECT count(*)::int FROM community_group_members WHERE group_id = g.id) AS member_count,
        (SELECT content FROM community_group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM community_group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
      FROM community_groups g
      JOIN community_group_members m ON m.group_id = g.id AND m.user_id = ${userId}
      ORDER BY last_message_at DESC NULLS LAST, g.created_at DESC
    `
    return reply.send(rows.map(r => ({
      id: r['id'], name: r['name'], sport: r['sport'],
      memberCount: r['member_count'], isAdmin: r['role'] === 'admin',
      lastMessage: r['last_message'] ?? null,
      lastMessageAt: r['last_message_at'] ?? null,
    })))
  })

  app.post('/community/groups', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { name, sport } = (req.body ?? {}) as { name?: string; sport?: string | null }
    if (!name?.trim()) return reply.status(400).send({ error: 'name required' })
    const pg = getPgClient()
    const rows = await pg`
      INSERT INTO community_groups (name, sport, created_by)
      VALUES (${name.trim()}, ${sport || null}, ${userId})
      RETURNING id, name, sport
    `
    const group = rows[0]
    await pg`INSERT INTO community_group_members (group_id, user_id, role) VALUES (${group['id']}, ${userId}, 'admin')`
    return reply.status(201).send({ id: group['id'], name: group['name'], sport: group['sport'], memberCount: 1, isAdmin: true })
  })

  app.get('/community/groups/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const rows = await pg`SELECT g.*, m.role FROM community_groups g JOIN community_group_members m ON m.group_id = g.id AND m.user_id = ${userId} WHERE g.id = ${id} LIMIT 1`
    if (!rows[0]) return reply.status(404).send({ error: 'Not found or not a member' })
    const members = await pg`
      SELECT u.id, u.name, u.avatar_url, m.role, m.joined_at
      FROM community_group_members m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ${id} ORDER BY m.role DESC, m.joined_at ASC
    `
    const g = rows[0]
    return reply.send({
      id: g['id'], name: g['name'], sport: g['sport'],
      isAdmin: g['role'] === 'admin',
      members: members.map(m => ({ id: m['id'], name: m['name'], avatarUrl: m['avatar_url'], role: m['role'] })),
    })
  })

  app.delete('/community/groups/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const member = await pg`SELECT role FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!member[0] || member[0]['role'] !== 'admin') return reply.status(403).send({ error: 'Forbidden' })
    await pg`DELETE FROM community_groups WHERE id = ${id}`
    return reply.send({ ok: true })
  })

  // ── MENSAGENS DO GRUPO ───────────────────────────────────────────────────────

  app.get('/community/groups/:id/messages', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const member = await pg`SELECT 1 FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!member[0]) return reply.status(403).send({ error: 'Not a member' })
    const rows = await pg`
      SELECT m.id, m.content, m.created_at, m.user_id, u.name
      FROM community_group_messages m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ${id} ORDER BY m.created_at ASC LIMIT 100
    `
    return reply.send(rows.map(r => ({ id: r['id'], content: r['content'], createdAt: r['created_at'], userId: r['user_id'], name: r['name'] })))
  })

  app.post('/community/groups/:id/messages', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const { content } = (req.body ?? {}) as { content?: string }
    if (!content?.trim()) return reply.status(400).send({ error: 'content required' })
    const pg = getPgClient()
    const member = await pg`SELECT 1 FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!member[0]) return reply.status(403).send({ error: 'Not a member' })
    const rows = await pg`
      INSERT INTO community_group_messages (group_id, user_id, content)
      VALUES (${id}, ${userId}, ${content.trim()}) RETURNING id, content, created_at
    `
    return reply.status(201).send(rows[0])
  })

  // ── MEMBROS ──────────────────────────────────────────────────────────────────

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

  app.delete('/community/groups/:id/leave', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    await pg`DELETE FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    return reply.send({ ok: true })
  })

  // POST /community/groups/:id/invite — gera (ou reutiliza) código de convite
  app.post('/community/groups/:id/invite', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const member = await pg`SELECT role FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!member[0] || member[0]['role'] !== 'admin') return reply.status(403).send({ error: 'Only admins can generate invite links' })
    const existing = await pg`SELECT invite_code FROM community_groups WHERE id = ${id} LIMIT 1`
    if (!existing[0]) return reply.status(404).send({ error: 'Group not found' })
    let code = existing[0]['invite_code']
    if (!code) {
      code = Math.random().toString(36).slice(2, 10).toUpperCase()
      await pg`UPDATE community_groups SET invite_code = ${code} WHERE id = ${id}`
    }
    return reply.send({ code, link: `racketapp://join-group/${code}` })
  })

  // POST /community/groups/join-by-code — entrar via código de convite
  app.post('/community/groups/join-by-code', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { code } = (req.body ?? {}) as { code?: string }
    if (!code?.trim()) return reply.status(400).send({ error: 'code required' })
    const pg = getPgClient()
    const rows = await pg`SELECT id, name, sport FROM community_groups WHERE invite_code = ${code.trim().toUpperCase()} LIMIT 1`
    if (!rows[0]) return reply.status(404).send({ error: 'Invalid invite code' })
    const group = rows[0]
    const existing = await pg`SELECT 1 FROM community_group_members WHERE group_id = ${group['id']} AND user_id = ${userId}`
    if (existing.length > 0) return reply.status(409).send({ error: 'Already a member' })
    await pg`INSERT INTO community_group_members (group_id, user_id) VALUES (${group['id']}, ${userId})`
    return reply.status(201).send({ id: group['id'], name: group['name'], sport: group['sport'] })
  })

  // POST /community/groups/:id/invite-user — envia convite pendente (não insere direto)
  app.post('/community/groups/:id/invite-user', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const { targetUserId } = (req.body ?? {}) as { targetUserId?: string }
    if (!targetUserId) return reply.status(400).send({ error: 'targetUserId required' })
    const pg = getPgClient()
    const member = await pg`SELECT role FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!member[0]) return reply.status(403).send({ error: 'Not a member' })
    const alreadyIn = await pg`SELECT 1 FROM community_group_members WHERE group_id = ${id} AND user_id = ${targetUserId}`
    if (alreadyIn.length > 0) return reply.status(409).send({ error: 'User already in group' })
    const alreadyInvited = await pg`
      SELECT 1 FROM community_group_invites
      WHERE group_id = ${id} AND invitee_id = ${targetUserId} AND status = 'pending'
    `
    if (alreadyInvited.length > 0) return reply.status(409).send({ error: 'Already invited' })
    await pg`
      INSERT INTO community_group_invites (group_id, inviter_id, invitee_id)
      VALUES (${id}, ${userId}, ${targetUserId})
    `
    return reply.status(201).send({ ok: true })
  })

  // DELETE /community/groups/:id/members/:userId — admin remove membro
  app.delete('/community/groups/:id/members/:memberId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id, memberId } = req.params as { id: string; memberId: string }
    const pg = getPgClient()
    const admin = await pg`SELECT role FROM community_group_members WHERE group_id = ${id} AND user_id = ${userId}`
    if (!admin[0] || admin[0]['role'] !== 'admin') return reply.status(403).send({ error: 'Not admin' })
    if (memberId === userId) return reply.status(400).send({ error: 'Admin cannot remove themselves' })
    await pg`DELETE FROM community_group_members WHERE group_id = ${id} AND user_id = ${memberId}`
    return reply.send({ ok: true })
  })

  // GET /community/invites — convites pendentes do usuário logado
  app.get('/community/invites', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`
      SELECT i.id, i.group_id, i.created_at, i.status,
        g.name AS group_name, g.sport AS group_sport,
        u.name AS inviter_name,
        (SELECT count(*)::int FROM community_group_members WHERE group_id = g.id) AS member_count
      FROM community_group_invites i
      JOIN community_groups g ON g.id = i.group_id
      JOIN users u ON u.id = i.inviter_id
      WHERE i.invitee_id = ${userId} AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `
    return reply.send(rows.map(r => ({
      id: r['id'], groupId: r['group_id'], groupName: r['group_name'],
      groupSport: r['group_sport'], inviterName: r['inviter_name'],
      memberCount: r['member_count'], createdAt: r['created_at'],
    })))
  })

  // POST /community/invites/:id/accept
  app.post('/community/invites/:id/accept', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const invite = await pg`SELECT * FROM community_group_invites WHERE id = ${id} AND invitee_id = ${userId} AND status = 'pending'`
    if (!invite[0]) return reply.status(404).send({ error: 'Invite not found' })
    await pg`UPDATE community_group_invites SET status = 'accepted' WHERE id = ${id}`
    await pg`
      INSERT INTO community_group_members (group_id, user_id)
      VALUES (${invite[0]['group_id']}, ${userId})
      ON CONFLICT DO NOTHING
    `
    return reply.send({ ok: true })
  })

  // POST /community/invites/:id/decline
  app.post('/community/invites/:id/decline', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    const invite = await pg`SELECT 1 FROM community_group_invites WHERE id = ${id} AND invitee_id = ${userId} AND status = 'pending'`
    if (!invite[0]) return reply.status(404).send({ error: 'Invite not found' })
    await pg`UPDATE community_group_invites SET status = 'declined' WHERE id = ${id}`
    return reply.send({ ok: true })
  })

  // ── FAVORITOS ────────────────────────────────────────────────────────────────

  app.get('/community/favorites', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()

    // Jogadores que já jogaram comigo (últimos 60 dias) — um registro por pessoa
    const recentRows = await pg`
      SELECT u.id, u.name, u.avatar_url,
        MAX(g.scheduled_at) AS last_game_at,
        EXISTS(SELECT 1 FROM favorite_players WHERE user_id = ${userId} AND favorite_user_id = u.id) AS is_favorite,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('sport', p.sport, 'category', p.category, 'skillLevel', p.skill_level))
          FILTER (WHERE p.sport IS NOT NULL),
          '[]'
        ) AS sport_profiles
      FROM game_participants gp1
      JOIN game_participants gp2 ON gp2.game_id = gp1.game_id AND gp2.user_id != ${userId}
      JOIN users u ON u.id = gp2.user_id
      JOIN games g ON g.id = gp1.game_id
      LEFT JOIN player_sport_profiles p ON p.user_id = u.id AND p.is_active = true
      WHERE gp1.user_id = ${userId}
        AND g.scheduled_at >= now() - interval '60 days'
        AND g.status != 'cancelled'
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY last_game_at DESC
      LIMIT 20
    `

    // Jogadores favoritados — um registro por pessoa
    const favRows = await pg`
      SELECT u.id, u.name, u.avatar_url,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('sport', p.sport, 'category', p.category, 'skillLevel', p.skill_level))
          FILTER (WHERE p.sport IS NOT NULL),
          '[]'
        ) AS sport_profiles
      FROM favorite_players f
      JOIN users u ON u.id = f.favorite_user_id
      LEFT JOIN player_sport_profiles p ON p.user_id = u.id AND p.is_active = true
      WHERE f.user_id = ${userId}
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY u.name
    `

    return reply.send({
      recentPlayers: recentRows.map(r => ({
        id: r['id'], name: r['name'], avatarUrl: r['avatar_url'],
        sportProfiles: r['sport_profiles'],
        lastGameAt: r['last_game_at'], isFavorite: r['is_favorite'],
      })),
      favorites: favRows.map(r => ({
        id: r['id'], name: r['name'], avatarUrl: r['avatar_url'],
        sportProfiles: r['sport_profiles'],
      })),
    })
  })

  app.post('/community/favorites/:targetId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { targetId } = req.params as { targetId: string }
    if (userId === targetId) return reply.status(400).send({ error: 'Cannot favorite yourself' })
    const pg = getPgClient()
    await pg`INSERT INTO favorite_players (user_id, favorite_user_id) VALUES (${userId}, ${targetId}) ON CONFLICT DO NOTHING`
    return reply.status(201).send({ ok: true })
  })

  app.delete('/community/favorites/:targetId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { targetId } = req.params as { targetId: string }
    const pg = getPgClient()
    await pg`DELETE FROM favorite_players WHERE user_id = ${userId} AND favorite_user_id = ${targetId}`
    return reply.send({ ok: true })
  })
}
