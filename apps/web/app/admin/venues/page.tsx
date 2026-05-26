import React from 'react'
import Link from 'next/link'
import { apiFetch } from '../../../lib/api'

interface Venue {
  id: string
  name: string
  address: string
  cityId: string
  isActive: boolean
}

async function getVenues(): Promise<Venue[]> {
  try {
    return await apiFetch<Venue[]>('/admin/venues')
  } catch {
    return []
  }
}

export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1>Arenas</h1>
        <Link href="/admin/venues/new" style={btnStyle}>
          + Nova arena
        </Link>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Nome</th>
            <th style={thStyle}>Endereço</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {venues.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Nenhuma arena cadastrada.
              </td>
            </tr>
          )}
          {venues.map((v) => (
            <tr key={v.id}>
              <td style={tdStyle}>{v.name}</td>
              <td style={tdStyle}>{v.address}</td>
              <td style={tdStyle}>
                <span style={v.isActive ? activeBadge : inactiveBadge}>
                  {v.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td style={tdStyle}>
                <Link href={`/admin/venues/${v.id}`} style={linkStyle}>
                  Gerenciar quadras
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'var(--color-primary)', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px', fontSize: '0.9rem',
  fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--font-body)',
}
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)',
  borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)',
}
const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: '0.875rem',
  background: 'var(--color-background)', color: 'var(--color-text-secondary)',
  fontWeight: 600, borderBottom: '1px solid var(--color-border)',
}
const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: '0.875rem',
  borderBottom: '1px solid var(--color-border)',
}
const activeBadge: React.CSSProperties = {
  color: '#10B981', background: '#D1FAE5', padding: '2px 10px',
  borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
}
const inactiveBadge: React.CSSProperties = {
  color: '#6B7280', background: '#F3F4F6', padding: '2px 10px',
  borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
}
const linkStyle: React.CSSProperties = {
  color: 'var(--color-primary)', textDecoration: 'none',
  fontWeight: 600, fontSize: '0.875rem',
}
