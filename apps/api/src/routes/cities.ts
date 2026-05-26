import type { FastifyInstance } from 'fastify'
import { db, cities, eq } from '@racket-app/db'

export async function citiesRoutes(app: FastifyInstance) {
  app.get('/cities', async (_req, reply) => {
    const rows = await db.query.cities.findMany({
      where: eq(cities.isActive, true),
      columns: { id: true, name: true, state: true, slug: true },
      orderBy: (c, { asc }) => [asc(c.name)],
    })
    return reply.send(rows)
  })

  app.get('/cities/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const city = await db.query.cities.findFirst({ where: eq(cities.id, id) })
    if (!city) return reply.status(404).send({ error: 'City not found' })
    return reply.send(city)
  })
}
