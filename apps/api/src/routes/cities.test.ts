import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { citiesRoutes } from './cities.js'

vi.mock('@racket-app/db', () => ({
  db: {
    query: {
      cities: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  },
  cities: {},
  eq: vi.fn(),
}))

import * as db from '@racket-app/db'

async function buildApp() {
  const app = Fastify()
  await app.register(citiesRoutes)
  return app
}

describe('GET /cities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active cities', async () => {
    const mockCities = [
      { id: 'city-1', name: 'Joinville', state: 'SC', slug: 'joinville-sc', country: 'BR', coordinatesLng: '-49', coordinatesLat: '-26', isActive: true },
      { id: 'city-2', name: 'Florianópolis', state: 'SC', slug: 'florianopolis-sc', country: 'BR', coordinatesLng: '-48', coordinatesLat: '-27', isActive: true },
    ]
    vi.mocked(db.db.query.cities.findMany).mockResolvedValue(mockCities)

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cities' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(mockCities)
  })

  it('returns empty array when no active cities', async () => {
    vi.mocked(db.db.query.cities.findMany).mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cities' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('GET /cities/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for unknown city', async () => {
    vi.mocked(db.db.query.cities.findFirst).mockResolvedValue(undefined)

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cities/00000000-0000-0000-0000-000000000099' })

    expect(res.statusCode).toBe(404)
  })

  it('returns city when found', async () => {
    const city = { id: 'city-1', name: 'Joinville', state: 'SC', slug: 'joinville-sc', isActive: true, country: 'BR', coordinatesLng: '-49', coordinatesLat: '-26' }
    vi.mocked(db.db.query.cities.findFirst).mockResolvedValue(city)

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/cities/city-1' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: 'city-1', name: 'Joinville' })
  })
})
