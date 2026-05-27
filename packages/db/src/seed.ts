import { db } from './client.js'
import { cities } from './schema.js'

async function seed() {
  console.log('Seeding database...')

  await db
    .insert(cities)
    .values([
      { name: 'Joinville',          state: 'SC', country: 'BR', coordinatesLng: '-48.8489', coordinatesLat: '-26.3044', isActive: true, slug: 'joinville-sc' },
      { name: 'Balneário Camboriú', state: 'SC', country: 'BR', coordinatesLng: '-48.6348', coordinatesLat: '-26.9906', isActive: true, slug: 'balneario-camboriu-sc' },
      { name: 'Itajaí',             state: 'SC', country: 'BR', coordinatesLng: '-48.6622', coordinatesLat: '-26.9078', isActive: true, slug: 'itajai-sc' },
      { name: 'Piçarras',           state: 'SC', country: 'BR', coordinatesLng: '-48.6726', coordinatesLat: '-26.7628', isActive: true, slug: 'picarras-sc' },
      { name: 'Barra Velha',        state: 'SC', country: 'BR', coordinatesLng: '-48.6803', coordinatesLat: '-26.6328', isActive: true, slug: 'barra-velha-sc' },
    ])
    .onConflictDoNothing()

  console.log('Seed complete.')
}

seed().catch(console.error)
