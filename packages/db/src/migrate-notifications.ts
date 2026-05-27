import { getPgClient } from './client.js'

async function migrate() {
  const pg = getPgClient()
  console.log('Creating notifications table...')
  await pg`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      game_id uuid REFERENCES games(id) ON DELETE SET NULL,
      read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await pg`CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id)`
  console.log('Done!')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
