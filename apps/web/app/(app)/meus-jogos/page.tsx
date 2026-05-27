'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiGet } from '@/lib/api'
import { PageWrapper, PhoneShell, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { Compass, Plus, User, CalendarDays, MapPin, Clock, ChevronRight, Zap, Users } from 'lucide-react'

const SPORTS: Record<string, { label: string; color: string }> = {
  padel:        { label: 'Padel',        color: '#2E6F9E' },
  beach_tennis: { label: 'Beach Tennis', color: '#D4880A' },
  tennis:       { label: 'Tênis',        color: '#B03A2E' },
}

interface MyGame {
  id: string; sport: string; scheduledAt: string
  durationMinutes: number; vacanciesTotal: number; openSpots: number
  participantCount: number; status: string
  venueName: string | null; venueAddress: string | null
  isCreator: boolean; courtReserved: boolean
}

function formatDate(dt: string) {
  const d = new Date(dt)
  const today = new Date(); today.setHours(0,0,0,0)
  const tom   = new Date(today); tom.setDate(tom.getDate()+1)
  const game  = new Date(d);     game.setHours(0,0,0,0)
  if (game.getTime() === today.getTime()) return 'Hoje'
  if (game.getTime() === tom.getTime())   return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' })
}
function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}

function NavBar() {
  const router = useRouter()
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'8px 8px 20px',
      background:C.card, borderTop:`1.5px solid ${C.line}` }}>
      {([
        ['descobrir',  Compass,      'Descobrir'],
        ['meus-jogos', CalendarDays, 'Meus jogos'],
        ['criar',      Plus,         'Criar'],
        ['comunidade', Users,        'Comunidade'],
        ['perfil',     User,         'Perfil'],
      ] as const).map(([key, Icon, label]) => {
        const isCenter = key === 'criar'
        const on = key === 'meus-jogos'
        if (isCenter) return (
          <button key={key} onClick={() => router.push('/criar')}
            style={{ flex:1, display:'flex', justifyContent:'center', border:'none', background:'none', cursor:'pointer' }}>
            <div style={{ width:46, height:40, borderRadius:13, background:C.lime,
              boxShadow:`0 6px 14px -4px ${C.lime}99`,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Plus size={20} strokeWidth={3} color={C.ink} />
            </div>
          </button>
        )
        return (
          <button key={key}
            onClick={() => router.push(
              key === 'descobrir' ? '/descobrir' :
              key === 'meus-jogos' ? '/meus-jogos' :
              key === 'comunidade' ? '/comunidade' : '/perfil'
            )}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
              gap:2, border:'none', background:'none', cursor:'pointer', padding:'2px 0' }}>
            <Icon size={18} strokeWidth={on?2.8:2.2} color={on?C.ink:C.inkSoft} />
            <span style={{ fontSize:9, fontWeight:700, fontFamily:BODY,
              color:on?C.ink:C.inkSoft, whiteSpace:'nowrap' }}>{label}</span>
            <div style={{ width:14, height:3, borderRadius:3, background:on?C.lime:'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

function GameCard({ g, onClick }: { g: MyGame; onClick: () => void }) {
  const s       = SPORTS[g.sport] ?? { label: g.sport, color:'#888' }
  const isPast  = new Date(g.scheduledAt) < new Date()
  const isFull  = g.openSpots <= 0

  return (
    <button onClick={onClick} style={{
      width:'100%', textAlign:'left', borderRadius:20, overflow:'hidden',
      display:'flex', background: isPast ? '#F7F6F2' : C.cream,
      border:`1.5px solid ${C.line}`, cursor:'pointer',
      opacity: isPast ? 0.72 : 1,
    }}>
      {/* sport bar */}
      <div style={{ width:5, background: isPast ? '#C0BDB4' : s.color, flexShrink:0 }} />

      <div style={{ flex:1, padding:'14px 14px' }}>
        {/* top row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6,
              fontFamily:BODY, textTransform:'uppercase', letterSpacing:'.05em',
              color: isPast ? C.inkSoft : s.color,
              background: isPast ? `${C.line}` : `${s.color}18` }}>
              {s.label}
            </span>
            {g.isCreator && (
              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:10,
                fontWeight:700, fontFamily:BODY, color: isPast ? C.inkSoft : C.ink,
                background: isPast ? C.line : `${C.lime}55`,
                padding:'3px 7px', borderRadius:6 }}>
                <Zap size={9} strokeWidth={3} />Org.
              </span>
            )}
          </div>
          <span style={{ fontSize:11, fontWeight:700, fontFamily:BODY,
            color: isPast ? C.inkSoft : (isFull ? '#1A7A45' : C.inkSoft) }}>
            {isPast ? 'Encerrado' : isFull ? 'Completo' : `${g.openSpots} vaga${g.openSpots>1?'s':''}`}
          </span>
        </div>

        {/* time + date */}
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{ fontFamily:DISPLAY, fontWeight:800, fontSize:22,
            color: isPast ? C.inkSoft : C.ink, letterSpacing:'-.02em' }}>
            {formatTime(g.scheduledAt)}
          </span>
          <span style={{ fontSize:13, fontWeight:600, color:C.inkSoft, fontFamily:BODY }}>
            · {formatDate(g.scheduledAt)}
          </span>
        </div>

        {/* venue */}
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:6 }}>
          <MapPin size={11} strokeWidth={2.5} color={C.inkSoft} />
          <span style={{ fontSize:12, fontWeight:600, fontFamily:BODY, color:C.inkSoft }}>
            {g.venueName ?? 'Quadra a definir'}
          </span>
          {g.courtReserved && (
            <span style={{ fontSize:10, fontWeight:700, fontFamily:BODY,
              color:'#1A7A45', background:'#E8F4EE', padding:'1px 6px', borderRadius:999 }}>
              ✓ Res.
            </span>
          )}
        </div>

        {/* players + duration */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ display:'flex' }}>
              {Array.from({ length: g.participantCount }).map((_, i) => (
                <div key={i} style={{ width:18, height:18, borderRadius:18,
                  background:`hsl(${i*67},50%,42%)`, border:`1.5px solid ${C.cream}`,
                  marginLeft: i>0 ? -6 : 0 }} />
              ))}
              {Array.from({ length: g.openSpots }).map((_, i) => (
                <div key={`o${i}`} style={{ width:18, height:18, borderRadius:18,
                  border:`1.5px dashed ${C.line}`, background:'transparent',
                  marginLeft: (g.participantCount+i)>0 ? -6 : 0 }} />
              ))}
            </div>
            <span style={{ fontSize:11, color:C.inkSoft, fontFamily:BODY }}>
              {g.participantCount}/{g.vacanciesTotal}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={11} strokeWidth={2.5} color={C.inkSoft} />
            <span style={{ fontSize:11, color:C.inkSoft, fontFamily:BODY }}>{g.durationMinutes} min</span>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', paddingRight:12 }}>
        <ChevronRight size={16} color={C.inkSoft} />
      </div>
    </button>
  )
}

export default function MeusJogosPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const [myGames, setMyGames] = useState<MyGame[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'proximos'|'passados'>('proximos')

  const load = useCallback(async () => {
    setLoading(true)
    try { setMyGames(await apiGet<MyGame[]>('/users/me/games')) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    load()
  }, [user, router, load])

  if (!user) return null

  const now      = new Date()
  const proximos = myGames.filter(g => new Date(g.scheduledAt) >= now)
  const passados = myGames.filter(g => new Date(g.scheduledAt) <  now).reverse()
  const list     = tab === 'proximos' ? proximos : passados

  return (
    <PageWrapper>
      <PhoneShell bottomBar={<NavBar />}>
        <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

          {/* header */}
          <div style={{ padding:'20px 20px 0' }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.2em', color:C.inkSoft, fontFamily:BODY }}>
              {user.name.split(' ')[0]}
            </div>
            <div style={{ fontFamily:DISPLAY, fontWeight:800, fontSize:26,
              color:C.ink, letterSpacing:'-.02em', lineHeight:1.1, marginTop:2 }}>
              Meus jogos
            </div>

            {/* tabs */}
            <div style={{ display:'flex', gap:8, marginTop:16, marginBottom:4 }}>
              {(['proximos','passados'] as const).map(t => {
                const on = tab === t
                const count = t === 'proximos' ? proximos.length : passados.length
                return (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding:'8px 16px', borderRadius:999, border:'none',
                    background: on ? C.ink : C.card,
                    color: on ? C.cream : C.inkSoft,
                    fontFamily:BODY, fontWeight:700, fontSize:13, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                    {t === 'proximos' ? 'Próximos' : 'Histórico'}
                    {count > 0 && (
                      <span style={{ fontSize:11, fontWeight:800,
                        background: on ? `${C.lime}44` : C.line,
                        color: on ? C.lime : C.inkSoft,
                        padding:'1px 6px', borderRadius:999 }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* list */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 8px',
            display:'flex', flexDirection:'column', gap:10 }}>

            {loading && (
              <div style={{ padding:'40px 0', textAlign:'center',
                color:C.inkSoft, fontSize:13, fontFamily:BODY }}>
                Carregando…
              </div>
            )}

            {!loading && list.length === 0 && (
              <div style={{ padding:'40px 20px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>
                  {tab === 'proximos' ? '🎾' : '📋'}
                </div>
                <div style={{ fontFamily:DISPLAY, fontWeight:800, fontSize:17, color:C.ink }}>
                  {tab === 'proximos' ? 'Nenhum jogo próximo' : 'Sem histórico ainda'}
                </div>
                <div style={{ fontSize:13, color:C.inkSoft, fontFamily:BODY, marginTop:6, lineHeight:1.5 }}>
                  {tab === 'proximos'
                    ? 'Crie um jogo ou entre em um na aba Descobrir'
                    : 'Seus jogos finalizados aparecerão aqui'}
                </div>
                {tab === 'proximos' && (
                  <button onClick={() => router.push('/criar')} style={{
                    marginTop:16, padding:'12px 24px', borderRadius:999,
                    background:C.lime, border:'none', cursor:'pointer',
                    fontFamily:DISPLAY, fontWeight:800, fontSize:14, color:C.ink,
                  }}>
                    Criar jogo
                  </button>
                )}
              </div>
            )}

            {list.map(g => (
              <GameCard key={g.id} g={g} onClick={() => router.push(`/descobrir?gameId=${g.id}`)} />
            ))}

          </div>
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
