import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, cities, venues, courts, eq } from '@racket-app/db'
import type { InferInsertModel } from '@racket-app/db'
import { Sport } from '@racket-app/shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUUID = (s: string) => UUID_RE.test(s)

const coordinateLng = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .refine((v) => Number(v) >= -180 && Number(v) <= 180, 'Longitude must be between -180 and 180')

const coordinateLat = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .refine((v) => Number(v) >= -90 && Number(v) <= 90, 'Latitude must be between -90 and 90')

const citySchema = z.object({
  name: z.string().min(1).max(100),
  state: z.string().length(2),
  country: z.string().default('BR'),
  coordinatesLng: coordinateLng,
  coordinatesLat: coordinateLat,
  isActive: z.boolean().default(false),
  slug: z.string().optional(),
})

const venueSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1),
  cityId: z.string().uuid(),
  coordinatesLng: coordinateLng,
  coordinatesLat: coordinateLat,
  sports: z.array(z.enum(Sport)).optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
})

const courtSchema = z.object({
  name: z.string().min(1).max(100),
  sport: z.enum(Sport),
  surface: z.string().optional(),
  isIndoor: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export async function adminRoutes(app: FastifyInstance) {
  const opts = { preHandler: [app.requireAdmin] }

  // Cities
  app.get('/admin/cities', opts, async () => {
    return db.select().from(cities).orderBy(cities.name)
  })

  app.post('/admin/cities', opts, async (req, reply) => {
    const parsed = citySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const [city] = await db.insert(cities).values(parsed.data as InferInsertModel<typeof cities>).returning()
    return reply.status(201).send(city)
  })

  app.patch('/admin/cities/:id', opts, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!isUUID(id)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = citySchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const [city] = await db.update(cities).set(parsed.data as Partial<InferInsertModel<typeof cities>>).where(eq(cities.id, id)).returning()
    if (!city) return reply.status(404).send({ error: 'City not found' })
    return city
  })

  // Venues
  app.get('/admin/venues', opts, async (req) => {
    const { cityId } = req.query as { cityId?: string }
    let q = db.select().from(venues)
    if (cityId) q = q.where(eq(venues.cityId, cityId)) as typeof q
    return q.orderBy(venues.name)
  })

  app.post('/admin/venues', opts, async (req, reply) => {
    const parsed = venueSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const [venue] = await db.insert(venues).values(parsed.data as InferInsertModel<typeof venues>).returning()
    return reply.status(201).send(venue)
  })

  app.patch('/admin/venues/:id', opts, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!isUUID(id)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = venueSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const [venue] = await db.update(venues).set(parsed.data as Partial<InferInsertModel<typeof venues>>).where(eq(venues.id, id)).returning()
    if (!venue) return reply.status(404).send({ error: 'Venue not found' })
    return venue
  })

  // Courts
  app.get('/admin/venues/:venueId/courts', opts, async (req, reply) => {
    const { venueId } = req.params as { venueId: string }
    if (!isUUID(venueId)) return reply.status(400).send({ error: 'Invalid venueId' })
    return db.select().from(courts).where(eq(courts.venueId, venueId)).orderBy(courts.name)
  })

  app.post('/admin/venues/:venueId/courts', opts, async (req, reply) => {
    const { venueId } = req.params as { venueId: string }
    if (!isUUID(venueId)) return reply.status(400).send({ error: 'Invalid venueId' })
    const parsed = courtSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const [court] = await db.insert(courts).values({ ...parsed.data, venueId } as InferInsertModel<typeof courts>).returning()
    return reply.status(201).send(court)
  })

  app.patch('/admin/courts/:id', opts, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!isUUID(id)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = courtSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const [court] = await db.update(courts).set(parsed.data as Partial<InferInsertModel<typeof courts>>).where(eq(courts.id, id)).returning()
    if (!court) return reply.status(404).send({ error: 'Court not found' })
    return court
  })
}
