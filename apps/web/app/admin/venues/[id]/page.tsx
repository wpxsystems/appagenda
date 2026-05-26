'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Court { id: string; name: string; sport: string; surface: string | null; isIndoor: boolean; isActive: boolean }

const SPORTS = ['padel', 'beach_tennis', 'tennis'] as const

export default function VenueDetailPage() {
  const { id } = useParams() as { id: string }
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', sport: 'padel', surface: '', isIndoor: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

  async function loadCourts() {
    try {
      const res = await fetch(`${apiUrl}/admin/venues/${id}/courts`)
      const data = await res.json() as Court[]
      setCourts(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCourts() }, [id])

  async function handleAddCourt(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/admin/venues/${id}/courts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, surface: form.surface || undefined }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setForm({ name: '', sport: 'padel', surface: '', isIndoor: true })
      await loadCourts()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(courtId: string, current: boolean) {
    await fetch(`${apiUrl}/admin/courts/${courtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    await loadCourts()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/venues" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Arenas
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>Quadras da Arena</h1>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Adicionar quadra</h2>
      <form onSubmit={handleAddCourt} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        <input
          placeholder="Nome (ex: Quadra 1)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          style={inputStyle}
        />
        <select value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))} style={inputStyle}>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="Superfície (optional)"
          value={form.surface}
          onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value }))}
          style={inputStyle}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}>
          <input type="checkbox" checked={form.isIndoor} onChange={(e) => setForm((f) => ({ ...f, isIndoor: e.target.checked }))} />
          Coberta
        </label>
        <button type="submit" disabled={saving} style={btnStyle}>
          {saving ? '…' : 'Adicionar'}
        </button>
      </form>
      {error && <p style={{ color: 'var(--color-error)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Carregando…</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>Esporte</th>
              <th style={thStyle}>Superfície</th>
              <th style={thStyle}>Coberta</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {courts.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Nenhuma quadra cadastrada.</td></tr>
            )}
            {courts.map((c) => (
              <tr key={c.id}>
                <td style={tdStyle}>{c.name}</td>
                <td style={tdStyle}>{c.sport}</td>
                <td style={tdStyle}>{c.surface ?? '—'}</td>
                <td style={tdStyle}>{c.isIndoor ? 'Sim' : 'Não'}</td>
                <td style={tdStyle}>
                  <span style={c.isActive ? activeBadge : inactiveBadge}>{c.isActive ? 'Ativa' : 'Inativa'}</span>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => toggleActive(c.id, c.isActive)} style={linkBtnStyle}>
                    {c.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.875rem', fontFamily: 'var(--font-body)', minWidth: 140 }
const btnStyle: React.CSSProperties = { background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '0.8rem', background: 'var(--color-background)', color: 'var(--color-text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }
const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }
const activeBadge: React.CSSProperties = { color: '#10B981', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }
const inactiveBadge: React.CSSProperties = { color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }
const linkBtnStyle: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', padding: 0 }
