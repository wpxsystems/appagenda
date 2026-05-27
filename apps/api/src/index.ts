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
import { communityRoutes } from './routes/community.js'
import { notificationsRoutes } from './routes/notifications.js'

async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })
  await app.register(authPlugin)
  await app.register(authRoutes)
  await app.register(adminRoutes)
  await app.register(citiesRoutes)
  await app.register(gamesRoutes)
  await app.register(usersRoutes)
  await app.register(communityRoutes)
  await app.register(notificationsRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}

// Serverless handler for Vercel
let _app: Awaited<ReturnType<typeof buildApp>> | null = null
export default async function handler(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  if (!_app) {
    _app = await buildApp()
    await _app.ready()
  }
  _app.server.emit('request', req, res)
}

// Local dev server
if (!process.env['VERCEL']) {
  buildApp().then(app => {
    const port = Number(process.env['PORT'] ?? 3001)
    app.listen({ port, host: '0.0.0.0' }).catch(err => {
      app.log.error(err)
      process.exit(1)
    })
  })
}
