import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    const port = Number(process.env['PORT'] ?? 3001)
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
