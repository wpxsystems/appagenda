'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCityPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    state: '',
    coordinatesLng: '',
    coordinatesLat: '',
    slug: '',
    isActive: false,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/admin/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, country: 'BR' }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      router.push('/admin/cities')
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ marginBottom: 24 }}>Nova Cidade</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Nome" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
        <Field label="Estado (sigla)" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} maxLength={2} required />
        <Field label="Longitude" value={form.coordinatesLng} onChange={(v) => setForm((f) => ({ ...f, coordinatesLng: v }))} required />
        <Field label="Latitude" value={form.coordinatesLat} onChange={(v) => setForm((f) => ({ ...f, coordinatesLat: v }))} required />
        <Field label="Slug (ex: joinville-sc)" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Ativa
        </label>
        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>}
        <button type="submit" disabled={saving} style={btnStyle}>
          {saving ? 'Salvando…' : 'Criar cidade'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, required, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; maxLength?: number
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem', fontWeight: 500 }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}
      />
    </label>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '12px 20px',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}
