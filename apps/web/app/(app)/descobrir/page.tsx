'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiGet, apiPost } from '@/lib/api'
import { PageWrapper, PhoneShell, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { MapPin, Bell, ChevronRight, Clock, Plus, Compass, User, Send, MessageCircle, Star, CalendarDays } from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────
const SPORTS_INFO: Record<string, { label: string; color: string }> = {
  padel:        { label: 'Padel',        color: '#2E6F9E' },
  beach_tennis: { label: 'Beach Tennis', color: '#D4880A' },
  tennis:       { label: 'Tênis',        color: '#B03A2E' },
}
const CAT_LABEL: Record<string, string>    = { C:'C', B:'B', A:'A', Open:'Open' }
const SIDE_LABEL: Record<string, string>   = { left:'Lado esquerdo', right:'Lado direito', both:'Ambos os lados' }
const LEVEL_LABEL: Record<string, string>  = { beginner:'Iniciante', intermediate:'Intermediário', advanced:'Avançado', competitive:'Competitivo' }
const FORMAT_LABEL: Record<string, string> = { singles:'Simples', doubles:'Duplas', both:'Ambos' }
const GENDER_LABEL: Record<string, string> = { mixed:'Misto', male:'Masculino', female:'Feminino' }

interface Game {
  id: string; sport: string; scheduledAt: string
  vacanciesTotal: number; openSpots: number; participantCount: number
  venueName: string | null; venueAddress: string | null
  targetCategory: string | null; courtReserved: boolean
  status: string; creatorName: string | null; durationMinutes?: number
}
interface Participant { userId: string; name: string | null; status: string }
interface GameDetail extends Game {
  participants: Participant[]
  notes: string | null; durationMinutes: number
  targetSkillLevel: string | null; targetSide: string | null
  targetPlayFormat: string | null; genderType: string
  creatorId: string
  isCreator: boolean
  alreadyJoined: boolean
}
interface Message { id: string; content: string; createdAt: string; userId: string; name: string | null }

// ─── helpers ─────────────────────────────────────────────────────────────────
function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function formatDay(dt: string) {
  const d = new Date(dt), today = new Date()
  const tom = new Date(today); tom.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === tom.toDateString()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}
function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60)   return 'agora'
  if (diff < 3600) return `${Math.floor(diff/60)}min`
  if (diff < 86400)return `${Math.floor(diff/3600)}h`
  return new Date(dt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, dashed }: { name?: string; size?: number; dashed?: boolean }) {
  if (dashed) return (
    <div style={{ width: size, height: size, borderRadius: size, flexShrink: 0,
      border: `2px dashed ${C.line}`, background: 'transparent' }} />
  )
  const n = name ?? '?'
  const initials = n.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
  const hue = n.charCodeAt(0) * 37 % 360
  return (
    <div style={{ width: size, height: size, borderRadius: size, flexShrink: 0,
      background: `hsl(${hue},50%,42%)`, color:'#fff', display:'flex',
      alignItems:'center', justifyContent:'center',
      fontSize: size * 0.36, fontWeight: 700, fontFamily: DISPLAY }}>
      {initials}
    </div>
  )
}

// ─── NavBar ──────────────────────────────────────────────────────────────────
function NavBar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const router = useRouter()
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'8px 12px 20px',
      background: C.card, borderTop:`1.5px solid ${C.line}` }}>
      {([
        ['descobrir', Compass,      'Descobrir'],
        ['meus-jogos', CalendarDays, 'Meus jogos'],
        ['criar',      Plus,        'Criar'],
        ['perfil',     User,        'Perfil'],
      ] as const).map(([key, Icon, label]) => {
        const center = key === 'criar', on = tab === key
        if (center) return (
          <button key={key} onClick={() => router.push('/criar')}
            style={{ flex:1, display:'flex', justifyContent:'center', border:'none', background:'none', cursor:'pointer' }}>
            <div style={{ width:46, height:40, borderRadius:13, background:C.lime,
              boxShadow:`0 6px 14px -4px ${C.lime}99`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Plus size={20} strokeWidth={3} color={C.ink} />
            </div>
          </button>
        )
        return (
          <button key={key} onClick={() => {
            if (key === 'perfil') router.push('/perfil')
            else if (key === 'meus-jogos') router.push('/meus-jogos')
            else setTab(key)
          }}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              border:'none', background:'none', cursor:'pointer' }}>
            <Icon size={19} strokeWidth={on?2.8:2.2} color={on?C.ink:C.inkSoft} />
            <span style={{ fontSize:10, fontWeight:700, fontFamily:BODY, color:on?C.ink:C.inkSoft, whiteSpace:'nowrap' }}>{label}</span>
            <div style={{ width:16, height:3, borderRadius:3, background:on?C.lime:'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

// ─── GameDetailView ──────────────────────────────────────────────────────────
function GameDetailView({ game, userId, onBack }: {
  game: GameDetail; userId: string; onBack: () => void
}) {
  const router = useRouter()
  const [joining,       setJoining]       = useState(false)
  const [joinMsg,       setJoinMsg]       = useState('')
  const [detail,        setDetail]        = useState(game)
  const [chatOpen,      setChatOpen]      = useState(false)
  const [messages,      setMessages]      = useState<Message[]>([])
  const [msgText,       setMsgText]       = useState('')
  const [sending,       setSending]       = useState(false)
  const [loadingMsg,    setLoadingMsg]    = useState(false)
  const [sportModal,    setSportModal]    = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    setLoadingMsg(true)
    try { setMessages(await apiGet<Message[]>(`/games/${game.id}/messages`)) }
    catch { /* ignore */ } finally { setLoadingMsg(false) }
  }, [game.id])

  useEffect(() => {
    if (chatOpen) loadMessages()
  }, [chatOpen, loadMessages])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleJoinClick() {
    try {
      const profiles = await apiGet<{ sport: string }[]>('/users/me/sport-profiles')
      const hasSport = profiles.some(p => p.sport === detail.sport)
      if (!hasSport) { setSportModal(true); return }
    } catch { /* if fetch fails, proceed anyway */ }
    joinGame()
  }

  async function joinGame() {
    setJoining(true)
    try {
      await apiPost(`/games/${detail.id}/join`)
      const refreshed = await apiGet<GameDetail>(`/games/${detail.id}`)
      const openSpots = refreshed.vacanciesTotal - (refreshed.participants?.length ?? 0)
      setDetail({ ...refreshed, openSpots, participantCount: refreshed.participants?.length ?? 0 })
      setJoinMsg('Você entrou no jogo! 🎉')
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string }
      setJoinMsg(err?.data?.error ?? err?.message ?? 'Erro ao entrar')
    } finally { setJoining(false) }
  }

  async function sendMessage() {
    if (!msgText.trim() || sending) return
    setSending(true)
    try {
      await apiPost(`/games/${detail.id}/messages`, { content: msgText.trim() })
      setMsgText('')
      await loadMessages()
    } catch { /* ignore */ } finally { setSending(false) }
  }

  const isCreator = detail.isCreator
  const alreadyIn = detail.isCreator || detail.alreadyJoined
  const lastMsg    = messages[messages.length - 1]

  // level line
  const levelParts: string[] = []
  if (detail.targetCategory)  levelParts.push(`Categoria ${CAT_LABEL[detail.targetCategory] ?? detail.targetCategory}`)
  if (detail.targetSkillLevel) levelParts.push(LEVEL_LABEL[detail.targetSkillLevel] ?? detail.targetSkillLevel)
  if (detail.targetSide)       levelParts.push(SIDE_LABEL[detail.targetSide] ?? detail.targetSide)
  if (detail.targetPlayFormat) levelParts.push(FORMAT_LABEL[detail.targetPlayFormat] ?? detail.targetPlayFormat)
  if (detail.genderType && detail.genderType !== 'mixed') levelParts.push(GENDER_LABEL[detail.genderType])

  const s = SPORTS_INFO[detail.sport] ?? { label: detail.sport, color: '#888' }

  return (
    <PageWrapper>
      {sportModal && (
        <div style={{ position:'fixed', inset:0, zIndex:999, display:'flex', alignItems:'center',
          justifyContent:'center', background:'rgba(26,24,19,0.55)', padding:'0 24px' }}
          onClick={() => setSportModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:360, background:C.cream, borderRadius:28,
              padding:'32px 24px 24px', boxShadow:'0 24px 60px rgba(0,0,0,0.22)',
              display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:20, background:`${s.color}15`,
              display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20,
              border:`1.5px solid ${s.color}25` }}>
              <span style={{ fontSize:30 }}>
                {detail.sport === 'beach_tennis' ? '🏖️' : '🎾'}
              </span>
            </div>
            <div style={{ fontFamily:DISPLAY, fontWeight:800, fontSize:20, color:C.ink,
              letterSpacing:'-.01em', marginBottom:10 }}>
              Você não joga {s.label}
            </div>
            <div style={{ fontFamily:BODY, fontSize:14, color:C.inkSoft, lineHeight:1.6,
              marginBottom:28, maxWidth:260 }}>
              Seu perfil não tem {s.label} cadastrado. Adicione este esporte para entrar neste jogo.
            </div>
            <button onClick={() => { setSportModal(false); router.push(`/perfil?addSport=${detail.sport}`) }}
              style={{ width:'100%', padding:'15px', borderRadius:16, border:'none',
                background:C.ink, color:C.cream, fontFamily:DISPLAY, fontWeight:800,
                fontSize:15, cursor:'pointer', marginBottom:10,
                boxShadow:`0 8px 20px -6px rgba(26,24,19,0.3)` }}>
              Adicionar {s.label} ao perfil
            </button>
            <button onClick={() => setSportModal(false)}
              style={{ width:'100%', padding:'13px', borderRadius:16,
                border:`1.5px solid ${C.line}`, background:'transparent',
                color:C.inkSoft, fontFamily:BODY, fontWeight:700,
                fontSize:14, cursor:'pointer' }}>
              Agora não
            </button>
          </div>
        </div>
      )}
      <PhoneShell bottomBar={
        <div style={{ padding: '10px 16px 20px', background: C.cream, borderTop: `1.5px solid ${C.line}` }}>
          {joinMsg ? (
            <div style={{ padding:'13px', borderRadius:16, textAlign:'center', fontFamily:BODY,
              fontSize:14, fontWeight:600,
              background: joinMsg.includes('🎉') ? `${C.lime}33` : `${C.coral}1A`,
              color: joinMsg.includes('🎉') ? C.ink : C.coral }}>
              {joinMsg}
            </div>
          ) : alreadyIn ? (
            <div style={{ padding:'13px', borderRadius:16, textAlign:'center', fontFamily:BODY,
              fontSize:13, fontWeight:700, background:`${C.lime}22`, color:C.ink }}>
              {isCreator ? '⚡ Você criou este jogo' : '✓ Você está neste jogo'}
            </div>
          ) : (
            <button onClick={handleJoinClick} disabled={joining || detail.openSpots === 0}
              style={{ width:'100%', padding:'15px', borderRadius:18, border:'none',
                background: detail.openSpots === 0 ? C.line : C.lime,
                color: detail.openSpots === 0 ? C.inkSoft : C.ink,
                fontFamily:DISPLAY, fontWeight:800, fontSize:15,
                cursor: detail.openSpots === 0 ? 'default' : 'pointer',
                boxShadow: detail.openSpots === 0 ? 'none' : `0 8px 20px -6px ${C.lime}99` }}>
              {joining ? 'Entrando…' : detail.openSpots === 0 ? 'Jogo lotado' : 'Entrar no jogo'}
            </button>
          )}
        </div>
      }>

        {/* ── color header ── */}
        <div style={{ background: s.color, padding: '14px 16px 32px' }}>
          <button onClick={onBack}
            style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,.18)',
              border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronRight size={18} color="#fff" style={{ transform:'rotate(180deg)' }} />
          </button>
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.18em', color:'rgba(255,255,255,.7)', fontFamily:BODY }}>
              Partida de {s.label}
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:4 }}>
              <span style={{ fontFamily:DISPLAY, fontSize:44, fontWeight:800,
                color:'#fff', letterSpacing:'-.03em', lineHeight:1 }}>
                {formatTime(detail.scheduledAt)}
              </span>
              <span style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,.85)' }}>
                {formatDay(detail.scheduledAt)}
              </span>
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:BODY, marginTop:4 }}>
              {detail.durationMinutes} min
              {detail.genderType ? ` · ${GENDER_LABEL[detail.genderType] ?? detail.genderType}` : ''}
            </div>
          </div>
        </div>

        {/* ── cards ── */}
        <div style={{ padding:'0 14px', marginTop:-18, display:'flex', flexDirection:'column', gap:10 }}>

          {/* QUADRA */}
          <div style={{ background:C.cream, borderRadius:20, padding:'14px 16px',
            border:`1.5px solid ${C.line}`, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:`${s.color}14`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <MapPin size={17} color={s.color} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'.15em', color:C.inkSoft, fontFamily:BODY }}>Quadra</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.ink, fontFamily:BODY, marginTop:2 }}>
                {detail.venueName ?? 'A definir'}
              </div>
              {detail.venueAddress && (
                <div style={{ fontSize:12, color:C.inkSoft, fontFamily:BODY, marginTop:1 }}>
                  {detail.venueAddress}
                </div>
              )}
            </div>
            <div style={{ flexShrink:0, padding:'4px 10px', borderRadius:999, fontSize:11,
              fontWeight:700, fontFamily:BODY,
              background: detail.courtReserved ? '#E8F4EE' : `${C.coral}15`,
              color: detail.courtReserved ? '#1A7A45' : C.coral }}>
              {detail.courtReserved ? '✓ Reservada' : 'A reservar'}
            </div>
          </div>

          {/* NÍVEL E PERFIL */}
          {levelParts.length > 0 && (
            <div style={{ background:C.cream, borderRadius:20, padding:'14px 16px',
              border:`1.5px solid ${C.line}`, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:12, background:`${s.color}14`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Star size={17} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'.15em', color:C.inkSoft, fontFamily:BODY }}>Nível e Perfil</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.ink, fontFamily:BODY, marginTop:2 }}>
                  {levelParts[0]}
                </div>
                {levelParts.slice(1).map((p,i) => (
                  <div key={i} style={{ fontSize:12, color:C.inkSoft, fontFamily:BODY, marginTop:1 }}>{p}</div>
                ))}
              </div>
            </div>
          )}

          {/* JOGADORES */}
          <div style={{ background:C.cream, borderRadius:20, padding:'14px 16px',
            border:`1.5px solid ${C.line}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ fontSize:14, fontWeight:800, color:C.ink, fontFamily:DISPLAY }}>Jogadores</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.inkSoft, fontFamily:BODY }}>
                {detail.participantCount} de {detail.vacanciesTotal}
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {detail.participants.map((p) => {
                const isOrg = p.userId === detail.creatorId
                const isMe  = p.userId === userId || (isCreator && isOrg)
                const displayName = isMe ? 'Você' : (p.name ?? 'Jogador')
                return (
                  <div key={p.userId} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <Avatar name={p.name ?? '?'} size={38} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:C.ink, fontFamily:BODY }}>
                          {displayName}
                        </span>
                        {isOrg && (
                          <span style={{ fontSize:10, fontWeight:700, fontFamily:BODY,
                            background:`${s.color}18`, color:s.color,
                            padding:'2px 7px', borderRadius:999 }}>Org.</span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:C.inkSoft, fontFamily:BODY, marginTop:1 }}>
                        {isOrg ? 'Organizador' : 'Confirmado'}
                        {levelParts[0] ? ` · ${levelParts[0]}` : ''}
                      </div>
                    </div>
                    {isOrg && (
                      <div style={{ width:8, height:8, borderRadius:8, background:'#22C55E' }} />
                    )}
                  </div>
                )
              })}
              {Array.from({ length: detail.openSpots }).map((_, i) => (
                <div key={`open-${i}`} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar dashed size={38} />
                  <span style={{ fontSize:13, color:C.inkSoft, fontFamily:BODY }}>Vaga aberta</span>
                </div>
              ))}
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          {detail.notes && (
            <div style={{ background:C.cream, borderRadius:20, padding:'14px 16px',
              border:`1.5px solid ${C.line}` }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'.15em', color:C.inkSoft, fontFamily:BODY, marginBottom:6 }}>
                Observações
              </div>
              <div style={{ fontSize:13, color:C.ink, fontFamily:BODY, lineHeight:1.55 }}>
                {detail.notes}
              </div>
            </div>
          )}

          {/* CONVERSA */}
          <div style={{ background:C.cream, borderRadius:20, border:`1.5px solid ${C.line}`,
            overflow:'hidden', marginBottom: 8 }}>
            {/* header row */}
            <button onClick={() => setChatOpen(v => !v)}
              style={{ width:'100%', padding:'14px 16px', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
              <div style={{ width:38, height:38, borderRadius:12, background:`${s.color}14`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <MessageCircle size={17} color={s.color} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.ink, fontFamily:DISPLAY }}>
                  Conversa do jogo
                </div>
                {!chatOpen && (
                  <div style={{ fontSize:12, color:C.inkSoft, fontFamily:BODY, marginTop:1 }}>
                    {loadingMsg
                      ? '…'
                      : lastMsg
                        ? `"${lastMsg.content.slice(0,40)}${lastMsg.content.length>40?'…':''}"`
                        : 'Sem mensagens ainda'}
                  </div>
                )}
              </div>
              <ChevronRight size={16} color={C.inkSoft}
                style={{ transform: chatOpen ? 'rotate(90deg)' : 'none', transition:'transform .2s' }} />
            </button>

            {/* expanded chat */}
            {chatOpen && (
              <div style={{ borderTop:`1.5px solid ${C.line}` }}>
                {/* messages */}
                <div style={{ maxHeight:240, overflowY:'auto', padding:'12px 14px',
                  display:'flex', flexDirection:'column', gap:10 }}>
                  {loadingMsg && (
                    <div style={{ textAlign:'center', color:C.inkSoft, fontSize:12, fontFamily:BODY }}>
                      Carregando…
                    </div>
                  )}
                  {!loadingMsg && messages.length === 0 && (
                    <div style={{ textAlign:'center', color:C.inkSoft, fontSize:12, fontFamily:BODY, padding:'8px 0' }}>
                      Nenhuma mensagem ainda. Seja o primeiro!
                    </div>
                  )}
                  {messages.map(m => {
                    const mine = m.userId === userId
                    return (
                      <div key={m.id} style={{ display:'flex', gap:8,
                        flexDirection: mine ? 'row-reverse' : 'row', alignItems:'flex-end' }}>
                        {!mine && <Avatar name={m.name ?? '?'} size={26} />}
                        <div style={{ maxWidth:'75%' }}>
                          {!mine && (
                            <div style={{ fontSize:10, fontWeight:700, color:C.inkSoft,
                              fontFamily:BODY, marginBottom:3 }}>{m.name}</div>
                          )}
                          <div style={{ padding:'8px 12px', borderRadius: mine ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                            background: mine ? C.ink : `${s.color}18`,
                            fontSize:13, fontFamily:BODY, color: mine ? C.cream : C.ink, lineHeight:1.45 }}>
                            {m.content}
                          </div>
                          <div style={{ fontSize:10, color:C.inkSoft, fontFamily:BODY,
                            marginTop:3, textAlign: mine ? 'right' : 'left' }}>
                            {timeAgo(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={msgEndRef} />
                </div>

                {/* input */}
                {(alreadyIn || isCreator) ? (
                  <div style={{ padding:'10px 12px', borderTop:`1.5px solid ${C.line}`,
                    display:'flex', gap:8, alignItems:'center' }}>
                    <input
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Mensagem…"
                      style={{ flex:1, padding:'9px 12px', borderRadius:12, border:`1.5px solid ${C.line}`,
                        background:C.cream, color:C.ink, fontSize:13, fontFamily:BODY,
                        outline:'none' }} />
                    <button onClick={sendMessage} disabled={sending || !msgText.trim()}
                      style={{ width:36, height:36, borderRadius:12, border:'none',
                        background: msgText.trim() ? C.lime : C.line,
                        cursor: msgText.trim() ? 'pointer' : 'default',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Send size={15} color={C.ink} />
                    </button>
                  </div>
                ) : (
                  <div style={{ padding:'10px 14px', borderTop:`1.5px solid ${C.line}`,
                    textAlign:'center', fontSize:12, color:C.inkSoft, fontFamily:BODY }}>
                    Entre no jogo para participar da conversa
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </PhoneShell>
    </PageWrapper>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────
export default function DescobrirPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [games, setGames]       = useState<Game[]>([])
  const [filter, setFilter]     = useState('Todos')
  const [tab, setTab]           = useState('descobrir')
  const [selected, setSelected] = useState<GameDetail | null>(null)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    apiGet<Game[]>('/games').then(setGames).catch(() => {})
    const gameId = searchParams.get('gameId')
    if (gameId) {
      apiGet<GameDetail>(`/games/${gameId}`).then(detail => {
        const openSpots = detail.vacanciesTotal - (detail.participants?.length ?? 0)
        setSelected({ ...detail, openSpots, participantCount: detail.participants?.length ?? 0 })
      }).catch(() => {})
    }
  }, [user, router, searchParams])

  async function openGame(id: string) {
    const detail = await apiGet<GameDetail>(`/games/${id}`)
    const openSpots = detail.vacanciesTotal - (detail.participants?.length ?? 0)
    setSelected({ ...detail, openSpots, participantCount: detail.participants?.length ?? 0 })
  }

  if (selected) {
    return (
      <GameDetailView
        game={selected}
        userId={user?.id ?? ''}
        onBack={() => setSelected(null)}
      />
    )
  }

  const filtered = games.filter(g => filter === 'Todos' || SPORTS_INFO[g.sport]?.label === filter)
  const firstName = user?.name?.split(' ')[0] ?? ''

  return (
    <PageWrapper>
      <PhoneShell bottomBar={<NavBar tab={tab} setTab={setTab} />}>
        <div style={{ paddingBottom: 16 }}>

          {/* topbar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px 4px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, color:C.inkSoft }}>
              <MapPin size={14} strokeWidth={2.6} />
              <span style={{ fontSize:13, fontWeight:600, fontFamily:BODY }}>Joinville, SC</span>
            </div>
            <div style={{ position:'relative' }}>
              <Bell size={20} strokeWidth={2.4} color={C.ink} />
              <div style={{ position:'absolute', top:-2, right:-2, width:8, height:8,
                borderRadius:8, background:C.coral, border:`2px solid ${C.cream}` }} />
            </div>
          </div>

          {/* title */}
          <div style={{ padding:'4px 20px 12px' }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.2em', color:C.inkSoft, fontFamily:BODY }}>
              Oi, {firstName}
            </div>
            <div style={{ fontFamily:DISPLAY, fontWeight:800, fontSize:26, color:C.ink,
              letterSpacing:'-0.02em', lineHeight:1.1, marginTop:2 }}>
              Jogos perto de você
            </div>
          </div>

          {/* filter chips */}
          <div style={{ display:'flex', gap:8, padding:'0 20px 12px',
            overflowX:'auto', scrollbarWidth:'none' as const }}>
            {['Todos','Padel','Beach Tennis','Tênis'].map(f => {
              const on = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding:'7px 14px', borderRadius:999, fontSize:13, fontWeight:700,
                    whiteSpace:'nowrap', cursor:'pointer', fontFamily:BODY,
                    background: on ? C.ink : C.card,
                    color: on ? C.cream : C.inkSoft,
                    border:`1.5px solid ${on ? C.ink : C.line}` }}>
                  {f}
                </button>
              )
            })}
          </div>

          {/* game cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 16px' }}>
            {filtered.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontFamily:DISPLAY, fontWeight:700, fontSize:18, color:C.ink }}>
                  Nenhum jogo aberto
                </div>
                <div style={{ fontSize:14, color:C.inkSoft, fontFamily:BODY, marginTop:6 }}>
                  Seja o primeiro a criar um jogo!
                </div>
              </div>
            )}
            {filtered.map((g, i) => {
              const s = SPORTS_INFO[g.sport] ?? { label: g.sport, color:'#888' }
              const urgent = g.openSpots === 1
              return (
                <button key={g.id} onClick={() => openGame(g.id)}
                  style={{ textAlign:'left', borderRadius:22, overflow:'hidden', display:'flex',
                    background:C.card, border:`1.5px solid ${C.line}`, cursor:'pointer',
                    boxShadow:'0 4px 14px -8px rgba(20,20,15,.2)',
                    animationDelay:`${i*50}ms` }}>
                  <div style={{ width:5, background:s.color, flexShrink:0 }} />
                  <div style={{ flex:1, padding:'14px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6,
                        textTransform:'uppercase', letterSpacing:'.05em', fontFamily:BODY,
                        color:s.color, background:`${s.color}18` }}>{s.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'4px 9px', borderRadius:999,
                        fontFamily:BODY,
                        background: urgent ? `${C.coral}1A` : C.cream,
                        color: urgent ? C.coral : C.inkSoft }}>
                        {g.openSpots === 1 ? 'falta 1 vaga' : `${g.openSpots} vagas`}
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:8 }}>
                      <span style={{ fontFamily:DISPLAY, fontWeight:800, fontSize:24,
                        color:C.ink, letterSpacing:'-0.02em' }}>
                        {formatTime(g.scheduledAt)}
                      </span>
                      <span style={{ fontSize:13, fontWeight:600, color:C.inkSoft, fontFamily:BODY }}>
                        · {formatDay(g.scheduledAt)}
                      </span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.ink, fontFamily:BODY, marginTop:2 }}>
                      {g.venueName ?? 'Quadra a definir'}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
                      <Clock size={11} strokeWidth={2.5} color={C.inkSoft} />
                      <span style={{ fontSize:11, color:C.inkSoft, fontFamily:BODY }}>
                        {g.durationMinutes ?? 90} min
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
