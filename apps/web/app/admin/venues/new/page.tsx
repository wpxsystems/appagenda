'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface City { id: string; name: string; state: string }

export default function NewVenuePage() {
  const router = useRouter()
  const [cities, setCities] = useState<City[]>([])
  const [form, setForm] = useState({
    name: '', address: '', cityId: '', coordinatesLng: '', coordinatesLat: '',
    phone: '', website: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
    fetch(`${apiUrl}/admin/cities`)
      .then((r) => r.json())
      .then(setCities)
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/admin/venues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      router.push('/admin/venues')
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: 24 }}>Nova Arena</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Nome" value={form.name} onChange={set('name')} required />
        <Field label="Endereço" value={form.address} onChange={set('address')} required />
        <label style={labelStyle}>
          Cidade
          <select
            value={form.cityId}
            onChange={(e) => setForm((f) => ({ ...f, cityId: e.target.value }))}
            required
            style={inputStyle}
          >
            <option value="">Selecione…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.state}</option>
            ))}
          </select>
        </label>
        <Field label="Longitude" value={form.coordinatesLng} onChange={set('coordinatesLng')} required />
        <Field label="Latitude" value={form.coordinatesLat} onChange={set('coordinatesLat')} required />
        <Field label="Telefone" value={form.phone} onChange={set('phone')} />
        <Field label="Website" value={form.website} onChange={set('website')} />
        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>}
        <button type="submit" disabled={saving} style={btnStyle}>
          {saving ? 'Salvando…' : 'Criar arena'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} style={inputStyle} />
    </label>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem', fontWeight: 500 }
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'var(--font-body)' }
const btnStyle: React.CSSProperties = { background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }
