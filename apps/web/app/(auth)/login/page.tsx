'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiPost } from '@/lib/api'
import { PageWrapper, PhoneShell, Btn, Input, C, DISPLAY, BODY } from '@/components/PhoneShell'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const res = await apiPost<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
        '/auth/login', { email, password }
      )
      login({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user)
      router.push('/descobrir')
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } }
      setError(err.data?.error ?? 'Email ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <PhoneShell>
        <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* logo */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.25em', color: C.lime, fontFamily: BODY }}>
              Racket App
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, color: C.ink, letterSpacing: '-0.02em', marginTop: 4 }}>
              Bem-vindo de volta
            </div>
            <div style={{ fontSize: 14, color: C.inkSoft, fontFamily: BODY, marginTop: 4 }}>
              Entre para encontrar jogos perto de você
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" onKeyDown={e => e.key === 'Enter' && submit()} />
            <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" error={error || undefined} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          <div style={{ marginTop: 24 }}>
            <Btn fullWidth onClick={submit} disabled={loading || !email || !password}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Btn>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <span style={{ fontSize: 14, color: C.inkSoft, fontFamily: BODY }}>Não tem conta? </span>
            <button onClick={() => router.push('/cadastro')}
              style={{ fontSize: 14, fontWeight: 700, color: C.ink, background: 'none', border: 'none', cursor: 'pointer', fontFamily: BODY }}>
              Criar conta
            </button>
          </div>
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
