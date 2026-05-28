'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { PageWrapper, PhoneShell, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { Compass, Plus, User, CalendarDays, Users, Star, ChevronRight, X, Send, ArrowLeft, UserPlus, Share2 } from 'lucide-react'

const SPORTS_INFO: Record<string, { label: string; color: string }> = {
  padel:        { label: 'Padel',        color: '#2E6F9E' },
  beach_tennis: { label: 'Beach Tennis', color: '#D4880A' },
  tennis:       { label: 'Tênis',        color: '#B03A2E' },
}

interface Group { id: string; name: string; sport: string | null; memberCount: number; isAdmin: boolean; lastMessage: string | null; lastMessageAt: string | null }
interface GroupDetail { id: string; name: string; sport: string | null; isAdmin: boolean; members: Member[] }
interface Member { id: string; name: string; avatarUrl: string | null; role: string }
interface GroupMessage { id: string; content: string; createdAt: string; userId: string; name: string | null }
interface SportProfile { sport: string; category: string | null; skillLevel: string | null }
interface RecentPlayer { id: string; name: string; sportProfiles: SportProfile[]; lastGameAt: string; isFavorite: boolean }
interface FavoritePlayer { id: string; name: string; sportProfiles: SportProfile[] }
interface FavoritesData { recentPlayers: RecentPlayer[]; favorites: FavoritePlayer[] }
interface GroupInvite { id: string; group_id: string; group_name: string; group_sport: string | null; inviter_name: string; member_count: number; created_at: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const hue = name.charCodeAt(0) * 37 % 360
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: `hsl(${hue},50%,42%)`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, fontFamily: DISPLAY, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── NavBar ──────────────────────────────────────────────────────────────────
function NavBar() {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 4px 20px',
      background: C.card, borderTop: `1.5px solid ${C.line}` }}>
      {([
        ['descobrir',  Compass,      'Descobrir'],
        ['meus-jogos', CalendarDays, 'Meus jogos'],
        ['criar',      Plus,         'Criar'],
        ['comunidade', Users,        'Comunidade'],
        ['perfil',     User,         'Perfil'],
      ] as const).map(([key, Icon, label]) => {
        const isCenter = key === 'criar', on = key === 'comunidade'
        if (isCenter) return (
          <button key={key} onClick={() => router.push('/criar')}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 40, borderRadius: 13, background: C.lime,
              boxShadow: `0 6px 14px -4px ${C.lime}99`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} strokeWidth={3} color={C.ink} />
            </div>
          </button>
        )
        return (
          <button key={key} onClick={() => router.push(
            key === 'descobrir' ? '/descobrir' : key === 'meus-jogos' ? '/meus-jogos' :
            key === 'comunidade' ? '/comunidade' : '/perfil'
          )} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, border: 'none', background: 'none', cursor: 'pointer', padding: '2px 0' }}>
            <Icon size={19} strokeWidth={on ? 2.8 : 2.2} color={on ? C.ink : C.inkSoft} />
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: BODY, color: on ? C.ink : C.inkSoft, whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ width: 14, height: 3, borderRadius: 3, background: on ? C.lime : 'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

// ─── InviteModal ──────────────────────────────────────────────────────────────
function InviteModal({ group, onClose }: { group: GroupDetail; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [connections, setConnections] = useState<RecentPlayer[]>([])
  const [inGroup] = useState<Set<string>>(new Set(group.members.map(m => m.id)))
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      apiPost<{ code: string; link: string }>(`/community/groups/${group.id}/invite`, {}),
      apiGet<FavoritesData>('/community/favorites'),
    ]).then(([inv, fav]) => {
      setCode(inv.code)
      setLink(inv.link)
      const all = [
        ...fav.favorites,
        ...fav.recentPlayers.filter(r => !fav.favorites.find(f => f.id === r.id)),
      ]
      setConnections(all as RecentPlayer[])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [group.id])

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    if (!link) return
    if (navigator.share) {
      await navigator.share({ title: group.name, text: `Entre no grupo "${group.name}"! Código: ${code}`, url: link })
    } else { copyLink() }
  }

  async function invite(targetId: string) {
    setInviting(targetId)
    setInviteError(null)
    try {
      await apiPost(`/community/groups/${group.id}/invite-user`, { targetUserId: targetId })
      setInvited(prev => new Set([...prev, targetId]))
    } catch (e: any) {
      setInviteError(e?.message ?? 'Erro ao enviar convite')
    } finally { setInviting(null) }
  }

  const s = group.sport ? SPORTS_INFO[group.sport] : null

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(26,24,19,0.6)', borderRadius: 'inherit', padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: C.cream, borderRadius: 24,
          padding: '20px 16px', maxHeight: '80%', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: C.ink }}>Convidar para o grupo</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color={C.inkSoft} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY, padding: '32px 0' }}>Carregando…</div>
        ) : (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* invite code */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em',
                color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Link de convite</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12,
                  padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: C.ink, letterSpacing: 4 }}>{code}</span>
                </div>
                <button onClick={share}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 12,
                    border: 'none', background: s?.color ?? C.ink, color: '#fff',
                    fontFamily: BODY, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                  <Share2 size={14} /> {copied ? 'Copiado!' : 'Compartilhar'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: BODY, marginTop: 6 }}>
                Qualquer pessoa com este código pode entrar no grupo.
              </div>
            </div>

            {/* connections */}
            {connections.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em',
                  color: C.inkSoft, fontFamily: BODY, marginBottom: 10 }}>Suas conexões</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {inviteError && (
                    <div style={{ fontSize: 12, color: C.coral, fontFamily: BODY, marginBottom: 8 }}>{inviteError}</div>
                  )}
                  {connections.map(c => {
                    const alreadyIn = inGroup.has(c.id)
                    const wasInvited = invited.has(c.id)
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                        <Avatar name={c.name} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>{c.name}</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                            {c.sportProfiles.map((sp, i) => {
                              const si = SPORTS_INFO[sp.sport]
                              return si ? (
                                <span key={i} style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
                                  color: si.color, background: `${si.color}18`, padding: '1px 6px', borderRadius: 5 }}>
                                  {si.label}
                                </span>
                              ) : null
                            })}
                          </div>
                        </div>
                        {alreadyIn ? (
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: BODY,
                            color: C.inkSoft, background: C.card, border: `1px solid ${C.line}`,
                            padding: '5px 10px', borderRadius: 999 }}>No grupo</span>
                        ) : wasInvited ? (
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: BODY,
                            color: s?.color ?? C.ink, background: s ? `${s.color}18` : `${C.lime}33`,
                            padding: '5px 10px', borderRadius: 999 }}>Convite enviado ✓</span>
                        ) : (
                          <button onClick={() => invite(c.id)} disabled={inviting === c.id}
                            style={{ fontSize: 12, fontWeight: 700, fontFamily: BODY,
                              color: '#fff', background: s?.color ?? C.ink, border: 'none',
                              padding: '6px 12px', borderRadius: 10,
                              cursor: inviting === c.id ? 'default' : 'pointer',
                              flexShrink: 0, opacity: inviting === c.id ? 0.6 : 1 }}>
                            {inviting === c.id ? '…' : 'Convidar'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {connections.length === 0 && (
              <div style={{ textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY, lineHeight: 1.5 }}>
                Você ainda não tem conexões. Jogue com alguém para poder convidá-los!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── GroupChat ────────────────────────────────────────────────────────────────
function GroupChat({ group: initialGroup, userId, onBack }: { group: GroupDetail; userId: string; onBack: () => void }) {
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail>(initialGroup)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)
  const s = group.sport ? SPORTS_INFO[group.sport] : null

  async function removeMember(memberId: string) {
    setRemovingId(memberId)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/community/groups/${group.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('racket_access_token')}` },
      })
      setGroup(prev => ({ ...prev, members: prev.members.filter(m => m.id !== memberId) }))
    } catch { /* ignore */ } finally { setRemovingId(null) }
  }

  const loadMessages = useCallback(async () => {
    try { setMessages(await apiGet<GroupMessage[]>(`/community/groups/${group.id}/messages`)) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [group.id])

  useEffect(() => { loadMessages() }, [loadMessages])
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await apiPost(`/community/groups/${group.id}/messages`, { content: text.trim() })
      setText('')
      await loadMessages()
    } catch { /* ignore */ } finally { setSending(false) }
  }

  return (
    <PageWrapper>
      <PhoneShell bottomBar={<NavBar />}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>

          {/* header */}
          <div style={{ background: s?.color ?? C.ink, padding: '14px 16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none',
                borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer' }}>
                <ArrowLeft size={16} color="#fff" />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.15em', color: 'rgba(255,255,255,0.7)', fontFamily: BODY }}>
                  {s?.label ?? 'Grupo'}
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: '#fff' }}>
                  {group.name}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: BODY,
                color: 'rgba(255,255,255,0.8)' }}>
                {group.members.length} membros
              </div>
            </div>

            {/* member avatars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex' }}>
                {group.members.slice(0, 5).map((m, i) => (
                  <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0,
                    width: 28, height: 28, borderRadius: 28,
                    background: `hsl(${m.name.charCodeAt(0) * 37 % 360},50%,42%)`,
                    border: `2px solid ${s?.color ?? C.ink}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: DISPLAY }}>
                    {m.name[0].toUpperCase()}
                  </div>
                ))}
              </div>
              {group.members.length > 5 && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: BODY }}>
                  +{group.members.length - 5}
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => setShowInvite(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.4)',
                    background: 'transparent', cursor: 'pointer',
                    color: '#fff', fontFamily: BODY, fontWeight: 700, fontSize: 12 }}>
                  <UserPlus size={13} strokeWidth={2.5} /> Convidar
                </button>
                {group.isAdmin && (
                  <button onClick={() => setShowMembers(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 10, border: 'none',
                      background: 'rgba(255,255,255,0.2)', cursor: 'pointer',
                      color: '#fff', fontFamily: BODY, fontWeight: 700, fontSize: 12 }}>
                    <Users size={13} strokeWidth={2.5} /> Membros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && (
              <div style={{ textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY, padding: '20px 0' }}>
                Carregando…
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16, color: C.ink, marginBottom: 6 }}>
                  Ninguém falou ainda
                </div>
                <div style={{ fontFamily: BODY, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>
                  Seja o primeiro a mandar uma mensagem!
                </div>
              </div>
            )}
            {messages.map(m => {
              const isMe = m.userId === userId
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft,
                      fontFamily: BODY, marginBottom: 3, marginLeft: 4 }}>
                      {m.name}
                    </span>
                  )}
                  <div style={{ maxWidth: '78%', padding: '9px 13px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMe ? C.ink : C.cream,
                    border: isMe ? 'none' : `1.5px solid ${C.line}`,
                    color: isMe ? C.cream : C.ink }}>
                    <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.4 }}>{m.content}</div>
                  </div>
                  <span style={{ fontSize: 10, color: C.inkSoft, fontFamily: BODY, marginTop: 2,
                    marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>
                    {timeAgo(m.createdAt)}
                  </span>
                </div>
              )
            })}
            <div ref={msgEndRef} />
          </div>

          {/* input */}
          <div style={{ padding: '10px 14px 12px', borderTop: `1.5px solid ${C.line}`,
            display: 'flex', gap: 8, background: C.cream }}>
            <input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Mensagem…"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 14, border: `1.5px solid ${C.line}`,
                background: C.card, fontFamily: BODY, fontSize: 14, color: C.ink, outline: 'none' }} />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{ width: 42, height: 42, borderRadius: 13, border: 'none',
                background: text.trim() ? C.ink : C.line, cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} color={text.trim() ? C.cream : C.inkSoft} />
            </button>
          </div>

          {showInvite && <InviteModal group={group} onClose={() => setShowInvite(false)} />}

          {/* members modal */}
          {showMembers && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'rgba(26,24,19,0.6)', borderRadius: 'inherit', padding: 16 }}
              onClick={() => setShowMembers(false)}>
              <div onClick={e => e.stopPropagation()}
                style={{ width: '100%', background: C.cream, borderRadius: 24, padding: '20px 16px',
                  maxHeight: '80%', display: 'flex', flexDirection: 'column',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: C.ink }}>
                    Membros ({group.members.length})
                  </span>
                  <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} color={C.inkSoft} />
                  </button>
                </div>
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {group.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                      <Avatar name={m.name} size={38} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>{m.name}</div>
                        {m.role === 'admin' && (
                          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
                            background: `${C.lime}44`, color: C.ink, padding: '1px 6px', borderRadius: 5 }}>
                            Admin
                          </span>
                        )}
                      </div>
                      {m.id !== userId && m.role !== 'admin' && (
                        <button onClick={() => removeMember(m.id)} disabled={removingId === m.id}
                          style={{ fontSize: 12, fontWeight: 700, fontFamily: BODY,
                            color: C.coral, background: `${C.coral}18`, border: `1px solid ${C.coral}44`,
                            padding: '5px 10px', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
                          {removingId === m.id ? '…' : 'Remover'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}

// ─── NewGroupModal ────────────────────────────────────────────────────────────
function NewGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function create() {
    if (!name.trim()) { setErr('Digite um nome'); return }
    setSaving(true); setErr('')
    try {
      await apiPost('/community/groups', { name: name.trim(), sport: sport || null })
      onCreated()
    } catch { setErr('Erro ao criar grupo') } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(26,24,19,0.55)', padding: '0 24px' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, background: C.cream, borderRadius: 28,
          padding: '28px 24px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: C.ink }}>Novo grupo</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color={C.inkSoft} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em',
              color: C.inkSoft, fontFamily: BODY, marginBottom: 8 }}>Nome</div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Galera do Padel" onKeyDown={e => e.key === 'Enter' && create()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14,
                fontFamily: BODY, border: `1.5px solid ${C.line}`, background: C.card,
                color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em',
              color: C.inkSoft, fontFamily: BODY, marginBottom: 8 }}>Esporte (opcional)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['', 'Geral'], ...Object.entries(SPORTS_INFO).map(([k, v]) => [k, v.label])].map(([val, label]) => {
                const on = sport === val
                return (
                  <button key={val} onClick={() => setSport(val)}
                    style={{ padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                      border: `1.5px solid ${on ? C.ink : C.line}`,
                      background: on ? C.ink : C.card, color: on ? C.cream : C.inkSoft,
                      fontFamily: BODY, fontWeight: 700, fontSize: 13 }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {err && <div style={{ fontSize: 13, color: C.coral, fontFamily: BODY }}>{err}</div>}
          <button onClick={create} disabled={saving || !name.trim()}
            style={{ width: '100%', padding: '14px', borderRadius: 16, border: 'none',
              background: !name.trim() ? C.line : C.lime, color: !name.trim() ? C.inkSoft : C.ink,
              fontFamily: DISPLAY, fontWeight: 800, fontSize: 15,
              cursor: !name.trim() ? 'default' : 'pointer' }}>
            {saving ? 'Criando…' : 'Criar grupo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ComunidadePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tab, setTab] = useState<'grupos' | 'conexoes'>('grupos')
  const [groups, setGroups] = useState<Group[]>([])
  const [favData, setFavData] = useState<FavoritesData>({ recentPlayers: [], favorites: [] })
  const [invites, setInvites] = useState<GroupInvite[]>([])
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<GroupDetail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, f, inv] = await Promise.all([
        apiGet<Group[]>('/community/groups').catch(() => [] as Group[]),
        apiGet<FavoritesData>('/community/favorites').catch(() => ({ recentPlayers: [], favorites: [] })),
        apiGet<GroupInvite[]>('/community/invites').catch(() => [] as GroupInvite[]),
      ])
      setGroups(g)
      setFavData(f)
      setInvites(inv)
    } finally { setLoading(false) }
  }, [])

  async function respondInvite(inviteId: string, action: 'accept' | 'decline') {
    setRespondingId(inviteId)
    try {
      await apiPost(`/community/invites/${inviteId}/${action}`)
      await load()
    } catch { /* ignore */ } finally { setRespondingId(null) }
  }

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    load()
  }, [user, router, load])

  async function openGroupDetail(id: string) {
    const detail = await apiGet<GroupDetail>(`/community/groups/${id}`)
    setOpenGroup(detail)
  }

  async function toggleFavorite(playerId: string, isFav: boolean) {
    if (isFav) {
      await apiPut(`/community/favorites/${playerId}`, {}).catch(() => {})
      // use delete via apiPost workaround — we'll call delete directly
    } else {
      await apiPost(`/community/favorites/${playerId}`).catch(() => {})
    }
    load()
  }

  if (!user) return null
  if (openGroup) return <GroupChat group={openGroup} userId={user.id} onBack={() => { setOpenGroup(null); load() }} />

  const { recentPlayers, favorites } = favData

  return (
    <PageWrapper>
      {newGroupOpen && (
        <NewGroupModal onClose={() => setNewGroupOpen(false)} onCreated={() => { setNewGroupOpen(false); load() }} />
      )}
      <PhoneShell bottomBar={<NavBar />}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* header */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.2em', color: C.inkSoft, fontFamily: BODY }}>
              {user.name.split(' ')[0]}
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26,
              color: C.ink, letterSpacing: '-.02em', marginTop: 2 }}>
              Comunidade
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, fontFamily: BODY, marginTop: 3 }}>
              Conectar pessoas é o nosso propósito
            </div>

            {/* tabs */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 4 }}>
              {([['grupos', 'Grupos', groups.length + invites.length], ['conexoes', 'Conexões', recentPlayers.length + favorites.length]] as const).map(([t, label, count]) => {
                const on = tab === t
                return (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 999,
                    border: 'none', background: on ? C.ink : C.card, color: on ? C.cream : C.inkSoft,
                    fontFamily: BODY, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                    {label}
                    {count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800,
                        background: on ? `${C.lime}44` : C.line, color: on ? C.lime : C.inkSoft,
                        padding: '1px 6px', borderRadius: 999 }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: C.inkSoft, fontSize: 13, fontFamily: BODY }}>Carregando…</div>}

            {/* ── GRUPOS ── */}
            {!loading && tab === 'grupos' && (
              <>
                {/* Convites pendentes */}
                {invites.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.15em', color: C.inkSoft, fontFamily: BODY, padding: '4px 4px 0' }}>
                      Convites pendentes
                    </div>
                    {invites.map(inv => {
                      const s = inv.group_sport ? SPORTS_INFO[inv.group_sport] : null
                      return (
                        <div key={inv.id} style={{ background: C.cream, border: `1.5px solid ${s?.color ?? C.line}`,
                          borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                              background: s ? `${s.color}18` : `${C.lime}33`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Users size={18} color={s ? s.color : C.ink} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>{inv.group_name}</div>
                              <div style={{ fontFamily: BODY, fontSize: 12, color: C.inkSoft }}>
                                {inv.inviter_name} te convidou · {inv.member_count} {inv.member_count === 1 ? 'membro' : 'membros'}
                                {s ? ` · ${s.label}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => respondInvite(inv.id, 'decline')} disabled={respondingId === inv.id}
                              style={{ flex: 1, padding: '9px', borderRadius: 12, border: `1.5px solid ${C.line}`,
                                background: 'transparent', color: C.inkSoft, fontFamily: BODY, fontWeight: 700,
                                fontSize: 13, cursor: 'pointer' }}>
                              Recusar
                            </button>
                            <button onClick={() => respondInvite(inv.id, 'accept')} disabled={respondingId === inv.id}
                              style={{ flex: 2, padding: '9px', borderRadius: 12, border: 'none',
                                background: s?.color ?? C.ink, color: '#fff', fontFamily: DISPLAY, fontWeight: 800,
                                fontSize: 13, cursor: 'pointer' }}>
                              {respondingId === inv.id ? '…' : 'Entrar no grupo'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                <button onClick={() => setNewGroupOpen(true)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 18,
                    border: `1.5px dashed ${C.line}`, background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: `${C.lime}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} strokeWidth={2.5} color={C.ink} />
                  </div>
                  <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>
                    Criar novo grupo
                  </span>
                </button>

                {groups.length === 0 && (
                  <div style={{ background: C.cream, borderRadius: 20, border: `1.5px solid ${C.line}`,
                    padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    textAlign: 'center', gap: 10 }}>
                    <div style={{ fontSize: 32 }}>👥</div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: C.ink }}>Nenhum grupo ainda</div>
                    <div style={{ fontFamily: BODY, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>
                      Crie um grupo para conversar e marcar jogos com seus parceiros
                    </div>
                  </div>
                )}

                {groups.map(g => {
                  const s = g.sport ? SPORTS_INFO[g.sport] : null
                  return (
                    <button key={g.id} onClick={() => openGroupDetail(g.id)}
                      style={{ width: '100%', textAlign: 'left', background: C.cream,
                        border: `1.5px solid ${C.line}`, borderRadius: 20, padding: '14px 16px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 15, flexShrink: 0,
                        background: s ? `${s.color}18` : `${C.lime}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} color={s ? s.color : C.ink} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>
                            {g.name}
                          </span>
                          {g.isAdmin && (
                            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
                              background: `${C.lime}44`, color: C.ink, padding: '2px 7px', borderRadius: 999 }}>
                              Admin
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: BODY, fontSize: 12, color: C.inkSoft,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.lastMessage ?? `${g.memberCount} ${g.memberCount === 1 ? 'membro' : 'membros'}${s ? ` · ${s.label}` : ''}`}
                        </div>
                        {g.lastMessageAt && (
                          <div style={{ fontFamily: BODY, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                            {timeAgo(g.lastMessageAt)}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} color={C.inkSoft} />
                    </button>
                  )
                })}
              </>
            )}

            {/* ── CONEXÕES ── */}
            {!loading && tab === 'conexoes' && (
              <>
                {/* Favoritos */}
                {favorites.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.15em', color: C.inkSoft, fontFamily: BODY, padding: '4px 4px 0' }}>
                      ⭐ Favoritos
                    </div>
                    {favorites.map(f => {
                      return (
                        <div key={f.id} style={{ background: C.cream, border: `1.5px solid ${C.line}`,
                          borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={f.name} size={44} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>{f.name}</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                              {f.sportProfiles.map((sp, i) => {
                                const s = SPORTS_INFO[sp.sport]
                                return s ? (
                                  <span key={i} style={{ fontSize: 11, fontWeight: 700, fontFamily: BODY,
                                    color: s.color, background: `${s.color}18`, padding: '2px 7px', borderRadius: 6 }}>
                                    {s.label}{sp.category ? ` · Cat. ${sp.category}` : ''}
                                  </span>
                                ) : null
                              })}
                            </div>
                          </div>
                          <button onClick={async () => {
                            await fetch(`http://localhost:3001/community/favorites/${f.id}`, {
                              method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('racket_access_token')}` }
                            }); load()
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
                            <Star size={18} color={C.coral} fill={C.coral} />
                          </button>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Jogadores recentes */}
                {recentPlayers.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.15em', color: C.inkSoft, fontFamily: BODY, padding: '4px 4px 0', marginTop: 4 }}>
                      🎾 Com quem você jogou
                    </div>
                    {recentPlayers.map(p => {
                      return (
                        <div key={p.id} style={{ background: C.cream, border: `1.5px solid ${C.line}`,
                          borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={p.name} size={44} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>{p.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              {p.sportProfiles.map((sp, i) => {
                                const s = SPORTS_INFO[sp.sport]
                                return s ? (
                                  <span key={i} style={{ fontSize: 11, fontWeight: 700, fontFamily: BODY,
                                    color: s.color, background: `${s.color}18`, padding: '2px 7px', borderRadius: 6 }}>
                                    {s.label}{sp.category ? ` · Cat. ${sp.category}` : ''}
                                  </span>
                                ) : null
                              })}
                              <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: BODY }}>
                                {timeAgo(p.lastGameAt)}
                              </span>
                            </div>
                          </div>
                          <button onClick={async () => {
                            if (p.isFavorite) {
                              await fetch(`http://localhost:3001/community/favorites/${p.id}`, {
                                method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('racket_access_token')}` }
                              })
                            } else {
                              await apiPost(`/community/favorites/${p.id}`)
                            }
                            load()
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
                            <Star size={18} color={C.coral} fill={p.isFavorite ? C.coral : 'transparent'} />
                          </button>
                        </div>
                      )
                    })}
                  </>
                )}

                {recentPlayers.length === 0 && favorites.length === 0 && (
                  <div style={{ background: C.cream, borderRadius: 20, border: `1.5px solid ${C.line}`,
                    padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    textAlign: 'center', gap: 10 }}>
                    <div style={{ fontSize: 32 }}>🤝</div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: C.ink }}>
                      Nenhuma conexão ainda
                    </div>
                    <div style={{ fontFamily: BODY, fontSize: 13, color: C.inkSoft, lineHeight: 1.5, maxWidth: 220 }}>
                      Participe de jogos para conectar com outros jogadores e criar vínculos
                    </div>
                    <button onClick={() => router.push('/descobrir')}
                      style={{ marginTop: 4, padding: '10px 20px', borderRadius: 999, border: 'none',
                        background: C.lime, color: C.ink, fontFamily: DISPLAY, fontWeight: 800,
                        fontSize: 13, cursor: 'pointer' }}>
                      Descobrir jogos
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
