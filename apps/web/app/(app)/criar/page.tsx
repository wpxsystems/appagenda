'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { PageWrapper, PhoneShell, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { Compass, Plus, User, ChevronLeft, ChevronRight, Check, MapPin, Info } from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────
interface Venue { id: string; name: string; address: string; sports: string[] }
interface Court { id: string; name: string; sport: string; surface: string | null; isIndoor: boolean }

// ─── data ────────────────────────────────────────────────────────────────────
const SPORTS = [
  { value: 'padel',        label: 'Padel',        color: '#2E6F9E', bg: '#E8F1F8', icon: '🏓' },
  { value: 'beach_tennis', label: 'Beach Tennis', color: '#D4880A', bg: '#FDF3DC', icon: '🎾' },
  { value: 'tennis',       label: 'Tênis',        color: '#B03A2E', bg: '#FAEDEB', icon: '🎾' },
] as const

const GENDER_TYPES = [['mixed','Misto'],['male','Masculino'],['female','Feminino']] as const
const DURATIONS    = [[60,'1h'],[90,'1h30'],[120,'2h']] as const
const RACKET_CATS  = ['C','B','A','Open'] as const
const SIDES        = [['left','Esq.'],['right','Dir.'],['both','Ambos']] as const
const LEVELS       = [['beginner','Iniciante'],['intermediate','Intermediário'],['advanced','Avançado'],['competitive','Competitivo']] as const
const FORMATS      = [['singles','Simples'],['doubles','Duplas'],['both','Ambos']] as const

// ─── date helpers ─────────────────────────────────────────────────────────────
const PT_WEEKDAY = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const PT_MONTH   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function buildDays(count = 45) {
  const days = []
  for (let i = 0; i < count; i++) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}
function toISO(d: Date) { return d.toISOString().slice(0,10) }
function scheduledAt(d: Date, h: number, m: number) {
  const pad = (n: number) => String(n).padStart(2,'0')
  return `${toISO(d)}T${pad(h)}:${pad(m)}:00.000Z`
}

async function apiFetch<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('racket_access_token') : null
  const res = await fetch(`http://localhost:3001${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw json
  return json
}

// ─── small components ────────────────────────────────────────────────────────
function Pill({ label, active, onClick, small }: { label: string; active: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '6px 12px' : '8px 16px',
      borderRadius: 999,
      border: `1.5px solid ${active ? C.ink : C.line}`,
      background: active ? C.ink : C.cream,
      color: active ? C.cream : C.inkSoft,
      fontSize: small ? 12 : 13, fontWeight: 700, fontFamily: BODY, cursor: 'pointer',
      transition: 'all .15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.18em', color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>{children}</div>
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
      background: on ? C.lime : '#D1D0CB', transition: 'background .2s', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20,
        borderRadius: 10, background: '#fff', boxShadow: '0 1px 4px #0002', transition: 'left .2s' }} />
    </button>
  )
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 4, borderRadius: 4,
          width: i === step - 1 ? 22 : 8,
          background: i < step ? C.lime : '#D1D0CB',
          transition: 'all .25s',
        }} />
      ))}
    </div>
  )
}

function NavBar({ active }: { active: string }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px 20px',
      background: C.card, borderTop: `1.5px solid ${C.line}` }}>
      {([['descobrir', Compass, 'Descobrir'], ['criar', Plus, 'Criar'], ['perfil', User, 'Perfil']] as const).map(([key, Icon, label]) => {
        const isCenter = key === 'criar'
        const on = key === active
        if (isCenter) return (
          <button key={key} onClick={() => router.push('/criar')}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
            <div style={{ width: 50, height: 44, borderRadius: 14, background: C.lime,
              boxShadow: `0 6px 18px -4px ${C.lime}99`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={22} strokeWidth={3} color={C.ink} />
            </div>
          </button>
        )
        return (
          <button key={key}
            onClick={() => router.push(key === 'descobrir' ? '/descobrir' : '/perfil')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, border: 'none', background: 'none', cursor: 'pointer' }}>
            <Icon size={21} strokeWidth={on ? 2.8 : 2.2} color={on ? C.ink : C.inkSoft} />
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: BODY, color: on ? C.ink : C.inkSoft }}>{label}</span>
            <div style={{ width: 18, height: 3, borderRadius: 3, background: on ? C.lime : 'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

// ─── DateStrip ───────────────────────────────────────────────────────────────
function DateStrip({ selected, onChange }: { selected: Date | null; onChange: (d: Date) => void }) {
  const days = buildDays(45)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selIdx = selected ? days.findIndex(d => toISO(d) === toISO(selected)) : -1

  useEffect(() => {
    if (scrollRef.current && selIdx >= 0) {
      const el = scrollRef.current.children[selIdx] as HTMLElement
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selIdx])

  return (
    <div ref={scrollRef} style={{
      display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6,
      scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {days.map((d, i) => {
        const on = i === selIdx
        const isToday = i === 0
        return (
          <button key={i} onClick={() => onChange(d)} style={{
            flexShrink: 0, width: 52, borderRadius: 18, padding: '10px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: on ? C.ink : C.cream,
            border: `1.5px solid ${on ? C.ink : isToday ? C.inkSoft : C.line}`,
            cursor: 'pointer', transition: 'all .15s',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
              color: on ? `${C.cream}88` : C.inkSoft }}>
              {isToday ? 'Hoje' : PT_WEEKDAY[d.getDay()]}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: DISPLAY,
              color: on ? C.lime : C.ink, lineHeight: 1 }}>
              {d.getDate()}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, fontFamily: BODY,
              color: on ? `${C.cream}66` : C.inkSoft }}>
              {PT_MONTH[d.getMonth()]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── TimePicker ──────────────────────────────────────────────────────────────
function TimePicker({ hour, minute, onHour, onMinute }: {
  hour: number; minute: number; onHour: (h: number) => void; onMinute: (m: number) => void
}) {
  const HOURS   = Array.from({ length: 18 }, (_, i) => i + 6)
  const MINUTES = [0, 15, 30, 45]
  const hourRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = hourRef.current
    if (!el) return
    const child = el.children[hour - 6] as HTMLElement | undefined
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [hour])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* hours */}
      <div ref={hourRef} style={{ display: 'flex', gap: 6, overflowX: 'auto',
        paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {HOURS.map(h => {
          const on = hour === h
          return (
            <button key={h} onClick={() => onHour(h)} style={{
              flexShrink: 0, width: 44, borderRadius: 14, padding: '8px 0',
              background: on ? C.ink : C.cream,
              border: `1.5px solid ${on ? C.ink : C.line}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16,
                color: on ? C.lime : C.ink, lineHeight: 1 }}>
                {String(h).padStart(2,'0')}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: BODY,
                color: on ? `${C.cream}66` : C.inkSoft }}>
                {h < 12 ? 'am' : 'pm'}
              </span>
            </button>
          )
        })}
      </div>
      {/* minutes */}
      <div style={{ display: 'flex', gap: 6 }}>
        {MINUTES.map(m => {
          const on = minute === m
          return (
            <button key={m} onClick={() => onMinute(m)} style={{
              flex: 1, borderRadius: 14, padding: '8px 0',
              background: on ? C.ink : C.cream,
              border: `1.5px solid ${on ? C.ink : C.line}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16,
                color: on ? C.lime : C.ink, lineHeight: 1 }}>
                :{String(m).padStart(2,'0')}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: BODY,
                color: on ? `${C.cream}66` : C.inkSoft }}>min</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────
export default function CriarPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep]         = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState('')
  const [validErr, setValidErr]     = useState('')

  // step 1
  const [sport,      setSport]     = useState('')
  const [selDay,     setSelDay]    = useState<Date | null>(null)
  const [hour,       setHour]      = useState(9)
  const [minute,     setMinute]    = useState(0)
  const [duration,   setDuration]  = useState(90)
  const [vacancies,  setVacancies] = useState(4) // 4 total = 3 vagas abertas (duplas)
  const [genderType, setGender]    = useState('mixed')

  // step 2
  const [venues,        setVenues]       = useState<Venue[]>([])
  const [venueId,       setVenueId]      = useState('')
  const [courts,        setCourts]       = useState<Court[]>([])
  const [courtId,       setCourtId]      = useState('')
  const [courtReserved, setCReserved]    = useState(false)
  const [venueSearch,   setVenueSearch]  = useState('')
  const [loadingVenues, setLoadingVenues]= useState(false)

  // step 3
  const [useFilters,      setUseFilters]  = useState(false)
  const [targetCategory,  setTCat]       = useState('')
  const [targetSide,      setTSide]      = useState('')
  const [targetSkillLevel,setTLevel]     = useState('')
  const [targetPlayFormat,setTFormat]    = useState('')
  const [notes,           setNotes]      = useState('')

  useEffect(() => { if (!user) router.push('/login') }, [user, router])

  const loadVenues = useCallback(async () => {
    setLoadingVenues(true)
    try { setVenues(await apiFetch<Venue[]>('/venues')) }
    catch { /* ignore */ } finally { setLoadingVenues(false) }
  }, [])

  useEffect(() => { if (step === 2) loadVenues() }, [step, loadVenues])

  useEffect(() => {
    if (!venueId) { setCourts([]); setCourtId(''); return }
    apiFetch<Court[]>(`/venues/${venueId}/courts`).then(data => {
      setCourts(sport ? data.filter(c => c.sport === sport) : data)
      setCourtId('')
    }).catch(() => setCourts([]))
  }, [venueId, sport])

  function validate() {
    if (!sport) { setValidErr('Selecione um esporte'); return false }
    if (!selDay) { setValidErr('Selecione uma data'); return false }
    setValidErr(''); return true
  }

  function next() {
    if (!validate()) return
    setStep(s => s + 1)
  }

  async function submit() {
    if (!validate()) return
    setSubmitting(true); setSubmitErr('')
    try {
      const payload: Record<string, unknown> = {
        sport,
        scheduledAt: scheduledAt(selDay!, hour, minute),
        durationMinutes: duration,
        vacanciesTotal: vacancies,
        genderType, courtReserved,
      }
      if (venueId)  payload['venueId']  = venueId
      if (courtId)  payload['courtId']  = courtId
      if (notes.trim()) payload['notes'] = notes.trim()
      if (useFilters) {
        if (targetCategory)  payload['targetCategory']   = targetCategory
        if (targetSide)      payload['targetSide']        = targetSide
        if (targetSkillLevel)payload['targetSkillLevel']  = targetSkillLevel
        if (targetPlayFormat)payload['targetPlayFormat']  = targetPlayFormat
      }
      await apiFetch('/games', 'POST', payload)
      router.push('/descobrir')
    } catch {
      setSubmitErr('Erro ao criar jogo. Tente novamente.')
      setSubmitting(false)
    }
  }

  if (!user) return null
  const sportObj = SPORTS.find(s => s.value === sport)
  const isTennis = sport === 'tennis'
  const filteredVenues = venueSearch
    ? venues.filter(v => v.name.toLowerCase().includes(venueSearch.toLowerCase()))
    : venues
  const selVenue = venues.find(v => v.id === venueId)

  return (
    <PageWrapper>
      <PhoneShell bottomBar={<NavBar active="criar" />}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* ── header ── */}
          <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: `1.5px solid ${C.line}` }}>
            {step > 1 && (
              <button onClick={() => { setStep(s => s - 1); setValidErr('') }}
                style={{ width: 36, height: 36, borderRadius: 12, background: C.cream,
                  border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <ChevronLeft size={18} color={C.ink} />
              </button>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20,
                color: C.ink, letterSpacing: '-.02em', lineHeight: 1.2 }}>
                {step === 1 ? 'Criar jogo' : step === 2 ? 'Onde vai jogar?' : 'Finalizar'}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: BODY, marginTop: 2 }}>
                {step === 1 ? 'Esporte · Data · Horário' : step === 2 ? 'Local e quadra (opcional)' : 'Filtros e observações'}
              </div>
            </div>
            <StepDots step={step} total={3} />
          </div>

          {/* ── scrollable content ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>

            {/* ════ STEP 1 ════ */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* esporte */}
                <div>
                  <SectionLabel>Esporte</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {SPORTS.map(s => {
                      const on = sport === s.value
                      return (
                        <button key={s.value} onClick={() => setSport(s.value)} style={{
                          borderRadius: 20, padding: '0', display: 'flex', alignItems: 'stretch',
                          background: on ? C.ink : C.cream,
                          border: `2px solid ${on ? C.ink : C.line}`,
                          cursor: 'pointer', overflow: 'hidden', transition: 'all .15s',
                        }}>
                          {/* color bar */}
                          <div style={{ width: 6, background: s.color, flexShrink: 0 }} />
                          {/* icon */}
                          <div style={{ width: 56, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: on ? `${s.color}33` : s.bg, fontSize: 24 }}>
                            {s.icon}
                          </div>
                          {/* label */}
                          <div style={{ flex: 1, padding: '14px 14px', textAlign: 'left' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: DISPLAY,
                              color: on ? C.cream : C.ink, letterSpacing: '-.01em' }}>{s.label}</div>
                          </div>
                          {/* check */}
                          <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {on
                              ? <div style={{ width: 22, height: 22, borderRadius: 22, background: C.lime,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Check size={13} color={C.ink} strokeWidth={3} />
                                </div>
                              : <div style={{ width: 22, height: 22, borderRadius: 22,
                                  border: `1.5px solid ${C.line}`, background: C.cream }} />
                            }
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* data */}
                <div>
                  <SectionLabel>Data</SectionLabel>
                  <DateStrip selected={selDay} onChange={d => { setSelDay(d); setValidErr('') }} />
                  {selDay && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10,
                      background: `${C.lime}33`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={12} color={C.ink} strokeWidth={3} />
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: BODY, color: C.ink }}>
                        {PT_WEEKDAY[selDay.getDay()]}, {selDay.getDate()} de {PT_MONTH[selDay.getMonth()]}
                      </span>
                    </div>
                  )}
                </div>

                {/* horário */}
                <div>
                  <SectionLabel>Horário</SectionLabel>
                  <TimePicker hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />
                </div>

                {/* duração */}
                <div>
                  <SectionLabel>Duração</SectionLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {DURATIONS.map(([val, lbl]) => (
                      <Pill key={val} label={lbl} active={duration === val} onClick={() => setDuration(val)} />
                    ))}
                  </div>
                </div>

                {/* vagas */}
                <div>
                  <SectionLabel>Vagas abertas</SectionLabel>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3].map(open => {
                      const total = open + 1
                      const on = vacancies === total
                      return (
                        <button key={open} onClick={() => setVacancies(total)} style={{
                          flex: 1, borderRadius: 14, padding: '8px 0',
                          background: on ? C.ink : C.cream,
                          border: `1.5px solid ${on ? C.ink : C.line}`,
                          cursor: 'pointer', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 2,
                        }}>
                          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18,
                            color: on ? C.lime : C.ink, lineHeight: 1 }}>{open}</span>
                          <span style={{ fontSize: 9, fontWeight: 600, fontFamily: BODY,
                            color: on ? `${C.cream}66` : C.inkSoft }}>
                            vaga{open > 1 ? 's' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: C.inkSoft, fontFamily: BODY }}>
                    Você já está dentro — total de {vacancies} jogadores
                  </div>
                </div>

                {/* tipo */}
                <div>
                  <SectionLabel>Tipo</SectionLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {GENDER_TYPES.map(([v, l]) => (
                      <Pill key={v} label={l} active={genderType === v} onClick={() => setGender(v)} />
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ════ STEP 2 ════ */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                <div style={{ borderRadius: 14, padding: '12px 14px', background: `${C.lime}22`,
                  border: `1.5px solid ${C.lime}55`, display: 'flex', gap: 10 }}>
                  <Info size={14} color={C.ink} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: C.ink, fontFamily: BODY, lineHeight: 1.55 }}>
                    Local é opcional. Você pode criar o jogo sem quadra reservada.
                  </span>
                </div>

                {/* busca */}
                <div>
                  <SectionLabel>Arena / Clube</SectionLabel>
                  <input placeholder="Buscar local…" value={venueSearch}
                    onChange={e => setVenueSearch(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12,
                      border: `1.5px solid ${C.line}`, background: C.cream, color: C.ink,
                      fontSize: 14, fontFamily: BODY, outline: 'none',
                      marginBottom: 8, boxSizing: 'border-box' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* sem local */}
                    <button onClick={() => { setVenueId(''); setCourtId('') }} style={{
                      borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                      background: !venueId ? C.ink : C.cream,
                      border: `1.5px solid ${!venueId ? C.ink : C.line}`,
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                      <MapPin size={15} color={!venueId ? C.cream : C.inkSoft} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: BODY,
                        color: !venueId ? C.cream : C.inkSoft }}>A definir / sem local fixo</span>
                      {!venueId && <Check size={14} color={C.lime} />}
                    </button>

                    {loadingVenues
                      ? <div style={{ padding: 14, textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY }}>
                          Carregando…
                        </div>
                      : filteredVenues.map(v => {
                          const on = venueId === v.id
                          return (
                            <button key={v.id} onClick={() => setVenueId(v.id)} style={{
                              borderRadius: 14, padding: '12px 14px', display: 'flex',
                              alignItems: 'center', gap: 10, textAlign: 'left',
                              background: on ? C.ink : C.cream,
                              border: `1.5px solid ${on ? C.ink : C.line}`, cursor: 'pointer',
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: BODY,
                                  color: on ? C.cream : C.ink }}>{v.name}</div>
                                <div style={{ fontSize: 11, fontFamily: BODY, marginTop: 2,
                                  color: on ? `${C.cream}88` : C.inkSoft }}>{v.address}</div>
                              </div>
                              {on && <Check size={14} color={C.lime} />}
                            </button>
                          )
                        })
                    }
                  </div>
                </div>

                {/* quadras */}
                {venueId && courts.length > 0 && (
                  <div>
                    <SectionLabel>Quadra (opcional)</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => setCourtId('')} style={{
                        borderRadius: 12, padding: '10px 14px', textAlign: 'left',
                        background: !courtId ? C.ink : C.cream,
                        border: `1.5px solid ${!courtId ? C.ink : C.line}`, cursor: 'pointer',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: BODY,
                          color: !courtId ? C.cream : C.inkSoft }}>Não especificar</span>
                      </button>
                      {courts.map(c => {
                        const on = courtId === c.id
                        return (
                          <button key={c.id} onClick={() => setCourtId(c.id)} style={{
                            borderRadius: 12, padding: '10px 14px', display: 'flex',
                            alignItems: 'center', gap: 8, textAlign: 'left',
                            background: on ? C.ink : C.cream,
                            border: `1.5px solid ${on ? C.ink : C.line}`, cursor: 'pointer',
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: BODY,
                                color: on ? C.cream : C.ink }}>{c.name}</div>
                              <div style={{ fontSize: 11, fontFamily: BODY,
                                color: on ? `${C.cream}88` : C.inkSoft }}>
                                {c.isIndoor ? 'Coberta' : 'Descoberta'}{c.surface ? ` · ${c.surface}` : ''}
                              </div>
                            </div>
                            {on && <Check size={14} color={C.lime} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* reservado */}
                <div style={{ borderRadius: 16, padding: '14px 16px', background: C.cream,
                  border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: BODY, color: C.ink }}>
                      Quadra já reservada
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: BODY, marginTop: 2 }}>
                      Você já garantiu o horário na arena
                    </div>
                  </div>
                  <Toggle on={courtReserved} onChange={() => setCReserved(v => !v)} />
                </div>

              </div>
            )}

            {/* ════ STEP 3 ════ */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* resumo do jogo */}
                <div style={{ borderRadius: 20, overflow: 'hidden', border: `1.5px solid ${C.line}` }}>
                  {/* color header */}
                  <div style={{ background: sportObj?.color ?? C.ink, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{sportObj?.icon}</span>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17,
                      color: '#fff', letterSpacing: '-.01em' }}>{sportObj?.label}</div>
                  </div>
                  <div style={{ background: C.cream, padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      selDay ? `📅  ${PT_WEEKDAY[selDay.getDay()]}, ${selDay.getDate()} de ${PT_MONTH[selDay.getMonth()]}` : '',
                      `🕐  ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} · ${DURATIONS.find(d=>d[0]===duration)?.[1]}`,
                      `👥  ${vacancies} jogadores · ${GENDER_TYPES.find(g=>g[0]===genderType)?.[1]}`,
                      selVenue ? `📍  ${selVenue.name}` : '📍  Local a definir',
                    ].filter(Boolean).map((line, i) => (
                      <div key={i} style={{ fontSize: 13, fontWeight: 600, fontFamily: BODY, color: C.ink }}>{line}</div>
                    ))}
                  </div>
                </div>

                {/* filtro por perfil */}
                <div style={{ borderRadius: 16, padding: '14px 16px', background: C.cream,
                  border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: BODY, color: C.ink }}>
                      Filtrar jogadores por nível
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: BODY, marginTop: 2 }}>
                      Definir categoria / nível esperado
                    </div>
                  </div>
                  <Toggle on={useFilters} onChange={() => setUseFilters(v => !v)} />
                </div>

                {useFilters && !isTennis && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <SectionLabel>Categoria alvo</SectionLabel>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Pill small label="Qualquer" active={!targetCategory} onClick={() => setTCat('')} />
                        {RACKET_CATS.map(c => <Pill small key={c} label={`Cat. ${c}`} active={targetCategory===c} onClick={() => setTCat(c)} />)}
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Lado alvo</SectionLabel>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Pill small label="Qualquer" active={!targetSide} onClick={() => setTSide('')} />
                        {SIDES.map(([v,l]) => <Pill small key={v} label={l} active={targetSide===v} onClick={() => setTSide(v)} />)}
                      </div>
                    </div>
                  </div>
                )}

                {useFilters && isTennis && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <SectionLabel>Nível alvo</SectionLabel>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Pill small label="Qualquer" active={!targetSkillLevel} onClick={() => setTLevel('')} />
                        {LEVELS.map(([v,l]) => <Pill small key={v} label={l} active={targetSkillLevel===v} onClick={() => setTLevel(v)} />)}
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Formato alvo</SectionLabel>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Pill small label="Qualquer" active={!targetPlayFormat} onClick={() => setTFormat('')} />
                        {FORMATS.map(([v,l]) => <Pill small key={v} label={l} active={targetPlayFormat===v} onClick={() => setTFormat(v)} />)}
                      </div>
                    </div>
                  </div>
                )}

                {/* notas */}
                <div>
                  <SectionLabel>Observações (opcional)</SectionLabel>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500}
                    placeholder="Ex: Nível intermediário, traga raquete extra, vai rolar churrasco depois…"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 14,
                      border: `1.5px solid ${C.line}`, background: C.cream, color: C.ink,
                      fontSize: 13, fontFamily: BODY, lineHeight: 1.55,
                      resize: 'none', minHeight: 88, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: C.inkSoft, textAlign: 'right', fontFamily: BODY }}>{notes.length}/500</div>
                </div>

                {submitErr && (
                  <div style={{ padding: '10px 14px', borderRadius: 12,
                    background: '#FEE', border: `1px solid ${C.coral}44`,
                    fontSize: 13, color: C.coral, fontFamily: BODY }}>
                    {submitErr}
                  </div>
                )}
              </div>
            )}

            {/* bottom padding */}
            <div style={{ height: 16 }} />
          </div>

          {/* ── footer ── */}
          <div style={{ padding: '10px 20px 6px', borderTop: `1.5px solid ${C.line}` }}>
            {/* validation error */}
            {validErr && (
              <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 10,
                background: '#FEF3C7', border: '1px solid #F59E0B55',
                fontSize: 12, fontWeight: 600, color: '#92400E', fontFamily: BODY }}>
                ⚠️ {validErr}
              </div>
            )}
            <button
              onClick={step < 3 ? next : submit}
              disabled={submitting}
              style={{
                width: '100%', borderRadius: 18, padding: '15px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: submitting ? C.line : C.lime,
                border: 'none', cursor: submitting ? 'default' : 'pointer',
                fontSize: 15, fontWeight: 800, fontFamily: DISPLAY, color: C.ink,
                transition: 'background .2s',
              }}>
              {step < 3
                ? <>Continuar <ChevronRight size={18} strokeWidth={3} /></>
                : submitting ? 'Publicando…' : '🎾 Publicar jogo'
              }
            </button>
          </div>

        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
