import type { FastifyInstance } from 'fastify'
import { getPgClient } from '@racket-app/db'

export async function notificationsRoutes(app: FastifyInstance) {

  // GET /notifications — lista notificações do usuário
  app.get('/notifications', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    const rows = await pg`
      SELECT id, type, title, body, game_id, read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `
    return reply.send(rows.map(r => ({
      id: r['id'],
      type: r['type'],
      title: r['title'],
      body: r['body'],
      gameId: r['game_id'],
      read: r['read'],
      createdAt: r['created_at'],
    })))
  })

  // PATCH /notifications/read-all — marcar todas como lidas
  app.patch('/notifications/read-all', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const pg = getPgClient()
    await pg`UPDATE notifications SET read = true WHERE user_id = ${userId}`
    return reply.send({ ok: true })
  })

  // PATCH /notifications/:id/read — marcar uma como lida
  app.patch('/notifications/:id/read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const pg = getPgClient()
    await pg`UPDATE notifications SET read = true WHERE id = ${id} AND user_id = ${userId}`
    return reply.send({ ok: true })
  })
}
