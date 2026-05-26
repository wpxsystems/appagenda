import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) throw new Error('DATABASE_URL is required')

const sql = postgres(connectionString, { max: 1 })
const db = drizzle(sql)

async function runMigrations() {
  await migrate(db, { migrationsFolder: './migrations' })
  console.log('Migrations applied successfully')
  await sql.end()
}

runMigrations().catch((err) => {
  console.error(err)
  process.exit(1)
})
