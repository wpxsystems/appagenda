import { getPgClient } from './client.js'

async function migrate() {
  const pg = getPgClient()
  await pg`
    CREATE TABLE IF NOT EXISTS community_group_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await pg`CREATE INDEX IF NOT EXISTS cgm_group_id_idx ON community_group_messages(group_id)`
  console.log('Done!')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
