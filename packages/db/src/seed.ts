import { db } from './client.js'
import { cities } from './schema.js'

async function seed() {
  console.log('Seeding database...')

  await db
    .insert(cities)
    .values([
      {
        name: 'Joinville',
        state: 'SC',
        country: 'BR',
        coordinatesLng: '-48.8489',
        coordinatesLat: '-26.3044',
        isActive: true,
        slug: 'joinville-sc',
      },
    ])
    .onConflictDoNothing()

  console.log('Seed complete.')
}

seed().catch(console.error)
