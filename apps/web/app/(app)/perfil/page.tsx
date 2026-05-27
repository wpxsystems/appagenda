'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiGet } from '@/lib/api'
import { PageWrapper, PhoneShell, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { MapPin, ChevronRight, Compass, Plus, User, LogOut, Camera, X, Check, CalendarDays } from 'lucide-react'

interface SportProfile {
  id: string; sport: string; category: string | null
  sidePreference: string | null; skillLevel: string | null; playFormat: string | null
}
type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
interface DaySlot { active: boolean; from: string; to: string }
type Availability = Partial<Record<DayKey, DaySlot>>

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
]
const SPORTS_INFO: Record<string, { label: string; color: string }> = {
  padel: { label: 'Padel', color: '#2E6F9E' },
  beach_tennis: { label: 'Beach Tennis', color: '#E0A12C' },
  tennis: { label: 'Tênis', color: '#C0492B' },
}
const SIDE_LABELS: Record<string, string> = { left: 'Lado esquerdo', right: 'Lado direito', both: 'Ambos os lados' }
const LEVEL_LABELS: Record<string, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado', competitive: 'Competitivo' }
const FORMAT_LABELS: Record<string, string> = { singles: 'Simples', doubles: 'Duplas', both: 'Ambos' }

const RACKET_CATEGORIES = ['C', 'B', 'A', 'Open'] as const
const SIDES = [['left', 'Esquerdo'], ['right', 'Direito'], ['both', 'Ambos']] as const
const LEVELS = [['beginner', 'Iniciante'], ['intermediate', 'Intermediário'], ['advanced', 'Avançado'], ['competitive', 'Competitivo']] as const
const FORMATS = [['singles', 'Simples'], ['doubles', 'Duplas'], ['both', 'Ambos']] as const
const ALL_SPORTS = ['padel', 'beach_tennis', 'tennis'] as const

async function apiFetch<T>(path: string, method: string, data?: unknown): Promise<T> {
  const token = localStorage.getItem('racket_access_token')
  const res = await fetch(`http://localhost:3001${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw json
  return json
}

function SegmentedPicker({ options, value, onChange }: {
  options: readonly (readonly [string, string])[]
  value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(([v, label]) => {
        const on = value === v
        return (
          <button key={v} onClick={() => onChange(v)}
            style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${on ? C.ink : C.line}`,
              background: on ? C.ink : C.card, color: on ? C.cream : C.inkSoft,
              fontSize: 13, fontWeight: 700, fontFamily: BODY, cursor: 'pointer' }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

interface SportModalProps {
  sport: string | null        // null = picking sport (add mode)
  existing: SportProfile | null
  onClose: () => void
  onSaved: (profile: SportProfile) => void
}

function SportModal({ sport: initialSport, existing, onClose, onSaved }: SportModalProps) {
  const [sport, setSport] = useState(initialSport ?? '')
  const [category, setCategory] = useState(existing?.category ?? 'C')
  const [side, setSide] = useState(existing?.sidePreference ?? 'right')
  const [level, setLevel] = useState(existing?.skillLevel ?? 'beginner')
  const [format, setFormat] = useState(existing?.playFormat ?? 'doubles')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const isAdd = !existing
  const isTennis = sport === 'tennis'

  async function save() {
    if (!sport) { setErr('Selecione um esporte'); return }
    setSaving(true); setErr('')
    try {
      const payload = isTennis
        ? { skillLevel: level, playFormat: format }
        : { category, sidePreference: side }
      let result: SportProfile
      if (isAdd) {
        result = await apiFetch<SportProfile>('/users/me/sport-profiles', 'POST', { sport, ...payload })
      } else {
        result = await apiFetch<SportProfile>(`/users/me/sport-profiles/${sport}`, 'PUT', payload)
      }
      onSaved(result)
    } catch (e: unknown) {
      const msg = (e as { error?: string })?.error
      setErr(msg === 'Sport already registered' ? 'Esporte já cadastrado' : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column',
      background: C.cream, borderRadius: 'inherit', overflowY: 'auto' }}>
      {/* header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: C.ink }}>
          {existing ? `Editar ${SPORTS_INFO[sport]?.label ?? sport}` : sport ? `Adicionar ${SPORTS_INFO[sport]?.label ?? sport}` : 'Adicionar esporte'}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={22} color={C.inkSoft} />
        </button>
      </div>

      <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* sport picker (add mode without pre-selected sport only) */}
        {isAdd && !initialSport && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
              color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Esporte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALL_SPORTS.map(s => {
                const info = SPORTS_INFO[s]
                const on = sport === s
                return (
                  <button key={s} onClick={() => setSport(s)}
                    style={{ borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                      background: on ? C.ink : C.card, border: `2px solid ${on ? C.ink : C.line}`, cursor: 'pointer' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 10, background: info.color }} />
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: BODY, color: on ? C.cream : C.ink }}>
                      {info.label}
                    </span>
                    {on && <Check size={16} color={C.lime} style={{ marginLeft: 'auto' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* fields for non-tennis */}
        {sport && !isTennis && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
                color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Categoria</div>
              <SegmentedPicker options={RACKET_CATEGORIES.map(c => [c, c] as const)} value={category} onChange={setCategory} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
                color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Lado preferido</div>
              <SegmentedPicker options={SIDES} value={side} onChange={setSide} />
            </div>
          </>
        )}

        {/* fields for tennis */}
        {sport && isTennis && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
                color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Nível</div>
              <SegmentedPicker options={LEVELS} value={level} onChange={setLevel} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
                color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Formato</div>
              <SegmentedPicker options={FORMATS} value={format} onChange={setFormat} />
            </div>
          </>
        )}

        {err && <div style={{ fontSize: 13, color: C.coral, fontFamily: BODY, fontWeight: 600 }}>{err}</div>}

        {sport && (
          <button onClick={save} disabled={saving}
            style={{ borderRadius: 18, padding: '15px 16px', background: C.lime, border: 'none', cursor: saving ? 'default' : 'pointer',
              fontSize: 15, fontWeight: 800, fontFamily: DISPLAY, color: C.ink, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        )}
      </div>
    </div>
  )
}

function NavBar({ onNavigate }: { onNavigate: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px 20px',
      background: C.card, borderTop: `1.5px solid ${C.line}` }}>
      {([
        ['descobrir',  Compass,      'Descobrir'],
        ['meus-jogos', CalendarDays, 'Meus jogos'],
        ['criar',      Plus,         'Criar'],
        ['perfil',     User,         'Perfil'],
      ] as const).map(([key, Icon, label]) => {
        const center = key === 'criar'
        const on = key === 'perfil'
        if (center) return (
          <button key={key} onClick={() => onNavigate('/criar')}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 40, borderRadius: 13, background: C.lime,
              boxShadow: `0 6px 14px -4px ${C.lime}99`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} strokeWidth={3} color={C.ink} />
            </div>
          </button>
        )
        return (
          <button key={key} onClick={() => onNavigate(key === 'descobrir' ? '/descobrir' : key === 'meus-jogos' ? '/meus-jogos' : '/perfil')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              border: 'none', background: 'none', cursor: 'pointer' }}>
            <Icon size={19} strokeWidth={on ? 2.8 : 2.2} color={on ? C.ink : C.inkSoft} />
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY, color: on ? C.ink : C.inkSoft, whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ width: 16, height: 3, borderRadius: 3, background: on ? C.lime : 'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

export default function PerfilPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, login, logout } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sportProfiles, setSportProfiles] = useState<SportProfile[]>([])
  const [availability, setAvailability] = useState<Availability>({})
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [savingAvail, setSavingAvail] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // modal state: null = closed, 'add' = adding new, sport string = editing that sport
  const [modalSport, setModalSport] = useState<string | null | 'add'>('add' as never)
  const [modalOpen, setModalOpen] = useState(false)

  function openEdit(sport: string) { setModalSport(sport); setModalOpen(true) }
  function openAdd() { setModalSport(null); setModalOpen(true) }
  function closeModal() { setModalOpen(false) }

  const availableSportsToAdd = ALL_SPORTS.filter(s => !sportProfiles.find(p => p.sport === s))

  const load = useCallback(async () => {
    try {
      const [profiles, avail, me] = await Promise.all([
        apiGet<SportProfile[]>('/users/me/sport-profiles'),
        apiGet<Availability>('/users/me/availability'),
        apiGet<{ id: string; name: string; email: string; avatarUrl: string | null; role: string }>('/users/me'),
      ])
      setSportProfiles(profiles)
      setAvailability(avail ?? {})
      if (me.avatarUrl) setAvatarUrl(me.avatarUrl)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    load().then(() => {
      const addSport = searchParams.get('addSport')
      if (addSport) {
        setModalSport(addSport)
        setModalOpen(true)
        router.replace('/perfil')
      }
    })
  }, [user, router, load, searchParams])

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setAvatarUrl(base64)
      try {
        const updated = await apiFetch<{ avatarUrl: string }>('/users/me', 'PATCH', { avatarUrl: base64 })
        if (user) login(
          { accessToken: localStorage.getItem('racket_access_token')!, refreshToken: localStorage.getItem('racket_refresh_token')! },
          { ...user, avatarUrl: updated.avatarUrl } as typeof user & { avatarUrl: string }
        )
      } catch {}
    }
    reader.readAsDataURL(file)
  }

  function toggleDay(key: DayKey) {
    setAvailability(prev => {
      const cur = prev[key]
      return { ...prev, [key]: { active: !cur?.active, from: cur?.from ?? '08:00', to: cur?.to ?? '22:00' } }
    })
  }

  function setTime(key: DayKey, field: 'from' | 'to', value: string) {
    setAvailability(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { active: true, from: '08:00', to: '22:00' }), [field]: value },
    }))
  }

  async function saveAvailability() {
    setSavingAvail(true)
    try {
      await apiFetch('/users/me/availability', 'PATCH', availability)
      setSavedMsg('Salvo!')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch {} finally { setSavingAvail(false) }
  }

  function handleSportSaved(profile: SportProfile) {
    setSportProfiles(prev => {
      const idx = prev.findIndex(p => p.sport === profile.sport)
      if (idx >= 0) { const next = [...prev]; next[idx] = profile; return next }
      return [...prev, profile]
    })
    closeModal()
  }

  if (!user) return null

  const editingProfile = typeof modalSport === 'string' && modalSport !== 'add'
    ? sportProfiles.find(p => p.sport === modalSport) ?? null
    : null

  return (
    <PageWrapper>
      <PhoneShell bottomBar={<NavBar onNavigate={router.push} />}>
        <div style={{ position: 'relative', paddingBottom: 16 }}>

          {/* sport edit/add modal */}
          {modalOpen && (
            <SportModal
              sport={modalSport === 'add' ? null : (modalSport as string | null)}
              existing={editingProfile}
              onClose={closeModal}
              onSaved={handleSportSaved}
            />
          )}

          {/* foto + nome */}
          <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 68, height: 68, borderRadius: 68, overflow: 'hidden',
                background: avatarUrl ? 'transparent' : `hsl(${user.name.charCodeAt(0) * 37 % 360}, 50%, 45%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${C.line}` }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: DISPLAY }}>
                    {user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <button onClick={() => fileRef.current?.click()}
                style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 24,
                  background: C.lime, border: `2px solid ${C.cream}`, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={12} color={C.ink} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: C.ink, letterSpacing: '-0.02em' }}>
                {user.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: C.inkSoft }}>
                <MapPin size={13} strokeWidth={2.6} />
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: BODY }}>Joinville, SC</span>
              </div>
            </div>
          </div>

          {/* stats */}
          <div style={{ display: 'flex', gap: 10, padding: '0 16px 16px' }}>
            {[['0', 'Jogos'], ['0', 'Parceiros'], ['—', 'Comparec.']].map(([n, l]) => (
              <div key={l} style={{ flex: 1, borderRadius: 16, padding: '12px 8px', textAlign: 'center',
                background: C.card, border: `1.5px solid ${C.line}` }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: C.ink }}>{n}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, fontFamily: BODY }}>{l}</div>
              </div>
            ))}
          </div>

          {/* esportes */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em',
                color: C.inkSoft, fontFamily: BODY }}>
                Seus esportes
              </div>
              {availableSportsToAdd.length > 0 && (
                <button onClick={openAdd}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.lime, border: 'none',
                    borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                  <Plus size={13} color={C.ink} strokeWidth={3} />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: BODY, color: C.ink }}>Adicionar</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sportProfiles.length === 0 && (
                <div style={{ padding: 16, borderRadius: 16, background: C.card, border: `1.5px dashed ${C.line}`,
                  textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY }}>
                  Nenhum esporte cadastrado
                </div>
              )}
              {sportProfiles.map(p => {
                const s = SPORTS_INFO[p.sport] ?? { label: p.sport, color: '#888' }
                const detail = p.category
                  ? `Cat. ${p.category}${p.sidePreference ? ' · ' + SIDE_LABELS[p.sidePreference] : ''}`
                  : p.skillLevel
                    ? `${LEVEL_LABELS[p.skillLevel] ?? p.skillLevel}${p.playFormat ? ' · ' + FORMAT_LABELS[p.playFormat] : ''}`
                    : ''
                return (
                  <button key={p.id} onClick={() => openEdit(p.sport)}
                    style={{ borderRadius: 18, padding: '14px 16px', display: 'flex',
                      alignItems: 'center', gap: 12, background: C.card, border: `1.5px solid ${C.line}`,
                      cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: `${s.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 14, background: s.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: BODY }}>{s.label}</div>
                      {detail && <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: BODY, marginTop: 2 }}>{detail}</div>}
                    </div>
                    <ChevronRight size={18} color={C.inkSoft} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* disponibilidade */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em',
                color: C.inkSoft, fontFamily: BODY }}>
                Disponibilidade
              </div>
              <button onClick={saveAvailability} disabled={savingAvail}
                style={{ fontSize: 12, fontWeight: 700, color: savedMsg ? '#10B981' : C.ink, fontFamily: BODY,
                  background: savedMsg ? '#10B98118' : C.lime, border: 'none', borderRadius: 999,
                  padding: '5px 12px', cursor: 'pointer' }}>
                {savedMsg || (savingAvail ? 'Salvando…' : 'Salvar')}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {DAYS.map(({ key, label }) => {
                const slot = availability[key]
                const on = slot?.active ?? false
                return (
                  <button key={key} onClick={() => toggleDay(key)}
                    style={{ flex: 1, borderRadius: 12, padding: '8px 2px', cursor: 'pointer',
                      background: on ? C.ink : C.card, border: `1.5px solid ${on ? C.ink : C.line}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
                      color: on ? 'rgba(243,239,230,0.7)' : C.inkSoft }}>{label}</div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 14,
                      color: on ? C.lime : C.ink, marginTop: 1 }}>{on ? '✓' : '—'}</div>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAYS.filter(d => availability[d.key]?.active).map(({ key, label }) => {
                const slot = availability[key]!
                return (
                  <div key={key} style={{ borderRadius: 16, padding: '12px 14px', background: C.card,
                    border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${C.lime}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.ink, fontFamily: DISPLAY }}>{label}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, fontFamily: BODY }}>das</span>
                        <input type="time" value={slot.from} onChange={e => setTime(key, 'from', e.target.value)}
                          style={{ border: `1.5px solid ${C.line}`, borderRadius: 8, padding: '4px 8px',
                            fontSize: 13, fontFamily: BODY, color: C.ink, background: C.cream, outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, fontFamily: BODY }}>até</span>
                        <input type="time" value={slot.to} onChange={e => setTime(key, 'to', e.target.value)}
                          style={{ border: `1.5px solid ${C.line}`, borderRadius: 8, padding: '4px 8px',
                            fontSize: 13, fontFamily: BODY, color: C.ink, background: C.cream, outline: 'none' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              {Object.values(availability).every(v => !v?.active) && (
                <div style={{ padding: '12px 16px', borderRadius: 14, background: C.card,
                  border: `1.5px dashed ${C.line}`, textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY }}>
                  Toque nos dias que você costuma jogar
                </div>
              )}
            </div>
          </div>

          {/* sair */}
          <div style={{ padding: '0 16px' }}>
            <button onClick={() => { logout(); router.push('/login') }}
              style={{ width: '100%', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center',
                gap: 12, background: 'transparent', border: `1.5px solid ${C.line}`, cursor: 'pointer' }}>
              <LogOut size={18} color={C.coral} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.coral, fontFamily: BODY }}>Sair da conta</span>
            </button>
          </div>
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
