'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiPost, apiGet } from '@/lib/api'
import { PageWrapper, PhoneShell, Btn, Input, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { ChevronLeft, Check } from 'lucide-react'

type City = { id: string; name: string; state: string }
type Sport = 'padel' | 'beach_tennis' | 'tennis'

const SPORTS_INFO: Record<Sport, { label: string; color: string }> = {
  padel: { label: 'Padel', color: '#2E6F9E' },
  beach_tennis: { label: 'Beach Tennis', color: '#E0A12C' },
  tennis: { label: 'Tênis', color: '#C0492B' },
}

const PADEL_CATS = [{ label: 'C', value: 'C' }, { label: 'B', value: 'B' }, { label: 'A', value: 'A' }, { label: 'Open', value: 'Open' }]
const PADEL_SIDES = [{ label: 'Esquerdo', value: 'left' }, { label: 'Direito', value: 'right' }, { label: 'Ambos', value: 'both' }]
const TENNIS_LEVELS = [{ label: 'Iniciante', value: 'beginner' }, { label: 'Intermediário', value: 'intermediate' }, { label: 'Avançado', value: 'advanced' }, { label: 'Competitivo', value: 'competitive' }]
const TENNIS_FORMATS = [{ label: 'Simples', value: 'singles' }, { label: 'Duplas', value: 'doubles' }, { label: 'Ambos', value: 'both' }]

export default function CadastroPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [passErr, setPassErr] = useState('')

  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('')
  const [cityId, setCityId] = useState('')
  const [cities, setCities] = useState<City[]>([])

  const [sports, setSports] = useState<Sport[]>([])
  const [profiles, setProfiles] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  useEffect(() => { apiGet<City[]>('/cities').then(setCities) }, [])

  function validateStep1() {
    let ok = true
    if (name.trim().length < 2) { setNameErr('Mínimo 2 caracteres'); ok = false } else setNameErr('')
    if (!email.includes('@')) { setEmailErr('Email inválido'); ok = false } else setEmailErr('')
    if (password.length < 8) { setPassErr('Mínimo 8 caracteres'); ok = false } else setPassErr('')
    return ok
  }

  function toggleSport(s: Sport) {
    setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function setProfile(sport: string, key: string, value: string) {
    setProfiles(prev => ({ ...prev, [sport]: { ...(prev[sport] ?? {}), [key]: value } }))
  }

  async function submit() {
    setSubmitErr('')
    setLoading(true)
    const sportProfiles = sports.map(s => {
      const p = profiles[s] ?? {}
      if (s === 'padel' || s === 'beach_tennis') {
        return { sport: s, category: p.category ?? 'C', sidePreference: p.sidePreference ?? 'both' }
      }
      return { sport: s, skillLevel: p.skillLevel ?? 'beginner', playFormat: p.playFormat ?? 'both' }
    })
    try {
      const res = await apiPost<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
        '/auth/register', { name, email, password, gender, cityId, sportProfiles }
      )
      login({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user)
      router.push('/descobrir')
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { error?: unknown } }
      if (err.status === 409) setSubmitErr('Este email já está cadastrado')
      else {
        const msg = err.data?.error
        setSubmitErr(typeof msg === 'string' ? msg : 'Erro ao criar conta. Verifique os dados.')
      }
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Conta', 'Perfil', 'Esporte', 'Nível']

  function PickerRow({ label, options, selected, onSelect }: {
    label: string
    options: { label: string; value: string }[]
    selected: string
    onSelect: (v: string) => void
  }) {
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: C.inkSoft, fontFamily: BODY, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {options.map(({ label: l, value: v }) => (
            <button key={v} onClick={() => onSelect(v)}
              style={{ flex: options.length <= 3 ? 1 : undefined, padding: '9px 12px', borderRadius: 10,
                fontFamily: BODY, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                background: selected === v ? C.ink : C.card, color: selected === v ? C.cream : C.inkSoft,
                border: `1.5px solid ${selected === v ? C.ink : C.line}` }}>
              {l}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <PageWrapper>
      <PhoneShell>
        <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ width: 36, height: 36, borderRadius: 36, background: C.cream,
                  border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronLeft size={18} color={C.ink} />
              </button>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: C.inkSoft, fontFamily: BODY }}>
                Passo {step} de 4
              </div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: C.ink, letterSpacing: '-0.02em' }}>
                {steps[step - 1]}
              </div>
            </div>
          </div>

          {/* progress */}
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 4,
                background: i < step ? C.ink : C.line, transition: 'background 0.3s' }} />
            ))}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Nome completo" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" error={nameErr} />
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" error={emailErr} />
              <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" error={passErr} />
              <Btn fullWidth onClick={() => { if (validateStep1()) setStep(2) }}>Continuar</Btn>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 14, color: C.inkSoft, fontFamily: BODY }}>Já tem conta? </span>
                <button onClick={() => router.push('/login')}
                  style={{ fontSize: 14, fontWeight: 700, color: C.ink, background: 'none', border: 'none', cursor: 'pointer', fontFamily: BODY }}>
                  Entrar
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>
                  Gênero
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['male', 'Masculino'], ['female', 'Feminino'], ['other', 'Outro']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setGender(val)}
                      style={{ flex: 1, padding: '10px 4px', borderRadius: 12, fontFamily: BODY, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        background: gender === val ? C.ink : C.card, color: gender === val ? C.cream : C.inkSoft,
                        border: `1.5px solid ${gender === val ? C.ink : C.line}` }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>
                  Cidade
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {cities.map(c => (
                    <button key={c.id} onClick={() => setCityId(c.id)}
                      style={{ padding: '12px 16px', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: cityId === c.id ? C.ink : C.card, cursor: 'pointer',
                        border: `1.5px solid ${cityId === c.id ? C.ink : C.line}` }}>
                      <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: cityId === c.id ? C.cream : C.ink }}>
                        {c.name}, {c.state}
                      </span>
                      {cityId === c.id && <Check size={16} color={C.lime} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
              <Btn fullWidth onClick={() => setStep(3)} disabled={!gender || !cityId}>Continuar</Btn>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, color: C.inkSoft, fontFamily: BODY }}>Selecione pelo menos um esporte</div>
              {(Object.entries(SPORTS_INFO) as [Sport, { label: string; color: string }][]).map(([key, s]) => {
                const on = sports.includes(key)
                return (
                  <button key={key} onClick={() => toggleSport(key)}
                    style={{ padding: 16, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                      background: on ? `${s.color}12` : C.card, border: `1.5px solid ${on ? s.color : C.line}` }}>
                    <div style={{ width: 12, height: 12, borderRadius: 12, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 15, color: C.ink, flex: 1, textAlign: 'left' }}>{s.label}</span>
                    {on && <Check size={18} color={s.color} strokeWidth={3} />}
                  </button>
                )
              })}
              <Btn fullWidth onClick={() => setStep(4)} disabled={sports.length === 0}>Continuar</Btn>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sports.map(s => {
                const info = SPORTS_INFO[s]
                const p = profiles[s] ?? {}
                return (
                  <div key={s}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 10, background: info.color }} />
                      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: C.ink }}>{info.label}</span>
                    </div>
                    {(s === 'padel' || s === 'beach_tennis') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <PickerRow label="Categoria" options={PADEL_CATS} selected={p.category ?? ''} onSelect={v => setProfile(s, 'category', v)} />
                        <PickerRow label="Lado" options={PADEL_SIDES} selected={p.sidePreference ?? ''} onSelect={v => setProfile(s, 'sidePreference', v)} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <PickerRow label="Nível" options={TENNIS_LEVELS} selected={p.skillLevel ?? ''} onSelect={v => setProfile(s, 'skillLevel', v)} />
                        <PickerRow label="Formato" options={TENNIS_FORMATS} selected={p.playFormat ?? ''} onSelect={v => setProfile(s, 'playFormat', v)} />
                      </div>
                    )}
                  </div>
                )
              })}
              {submitErr && (
                <div style={{ padding: '12px 16px', borderRadius: 12, background: `${C.coral}1A`,
                  color: C.coral, fontSize: 13, fontFamily: BODY, textAlign: 'center' }}>
                  {submitErr}
                </div>
              )}
              <Btn fullWidth onClick={submit} disabled={loading}>
                {loading ? 'Criando conta…' : 'Criar conta'}
              </Btn>
            </div>
          )}
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
