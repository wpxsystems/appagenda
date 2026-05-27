import { config } from 'dotenv'
config()
import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { adminRoutes } from './routes/admin.js'
import { citiesRoutes } from './routes/cities.js'
import { gamesRoutes } from './routes/games.js'
import { usersRoutes } from './routes/users.js'

async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })
  await app.register(authPlugin)
  await app.register(authRoutes)
  await app.register(adminRoutes)
  await app.register(citiesRoutes)
  await app.register(gamesRoutes)
  await app.register(usersRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}

async function start() {
  const app = await buildApp()
  try {
    const port = Number(process.env['PORT'] ?? 3001)
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
