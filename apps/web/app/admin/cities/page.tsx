import React from 'react'
import Link from 'next/link'
import { apiFetch } from '../../../lib/api'
import styles from './cities.module.css'

interface City {
  id: string
  name: string
  state: string
  slug: string | null
  isActive: boolean
}

async function getCities(): Promise<City[]> {
  try {
    return await apiFetch<City[]>('/admin/cities')
  } catch {
    return []
  }
}

export default async function CitiesPage() {
  const cities = await getCities()

  return (
    <div>
      <div className={styles.header}>
        <h1>Cidades</h1>
        <Link href="/admin/cities/new" className={styles.btnPrimary}>
          + Nova cidade
        </Link>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Estado</th>
            <th>Slug</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cities.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Nenhuma cidade cadastrada.
              </td>
            </tr>
          )}
          {cities.map((city) => (
            <tr key={city.id}>
              <td>{city.name}</td>
              <td>{city.state}</td>
              <td>{city.slug ?? '—'}</td>
              <td>
                <span className={city.isActive ? styles.badgeActive : styles.badgeInactive}>
                  {city.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td>
                <Link href={`/admin/cities/${city.id}`} className={styles.btnLink}>
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
