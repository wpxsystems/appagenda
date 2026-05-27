import { getPgClient } from './client.js'

async function migrate() {
  const pg = getPgClient()
  console.log('Creating community tables...')

  await pg`
    CREATE TABLE IF NOT EXISTS community_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      sport sport_enum,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  await pg`
    CREATE TABLE IF NOT EXISTS community_group_members (
      group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member',
      joined_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, user_id)
    )
  `

  await pg`
    CREATE TABLE IF NOT EXISTS favorite_players (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      favorite_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, favorite_user_id)
    )
  `

  console.log('Done!')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
