import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

function createClient() {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) throw new Error('DATABASE_URL is required')
  const queryClient = postgres(connectionString)
  return drizzle(queryClient, { schema })
}

let _db: ReturnType<typeof createClient> | undefined

export function getDb() {
  if (!_db) _db = createClient()
  return _db
}

// Proxy so existing `import { db }` usage still works at runtime,
// but the connection is only opened on first access.
export const db = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof createClient>]
  },
})

export type DB = ReturnType<typeof createClient>
